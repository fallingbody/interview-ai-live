from typing import Dict

from app.core.logger import get_logger
from app.llm.client import LLMClient
from app.llm.prompts import REPORT_PROMPT
from langchain_core.prompts import ChatPromptTemplate

logger = get_logger(__name__)


class ScoringService:
    def __init__(self):
        self.llm = LLMClient()

    def _count_value(self, value) -> int:
        try:
            return int(float(value or 0))
        except (TypeError, ValueError):
            return 0

    def _score_from_report(self, report: Dict) -> float:
        overall = report.get("overall_performance") or {}
        score = overall.get("average_score", overall.get("score"))
        try:
            return round(float(score), 1)
        except (TypeError, ValueError):
            pass

        section = report.get("section_wise_evaluation") or {}
        scores = []
        for key in ("Technical", "technical", "HR", "hr", "General", "general"):
            value = section.get(key)
            if isinstance(value, dict):
                raw_score = value.get("average_score", value.get("score"))
                try:
                    scores.append(float(raw_score))
                except (TypeError, ValueError):
                    continue

        return round(sum(scores) / len(scores), 1) if scores else 0.0

    def _normalize_face_analysis(self, face_analysis: Dict) -> Dict:
        if not isinstance(face_analysis, dict):
            return {}

        normalized = dict(face_analysis)
        summary = dict(normalized.get("cheating_summary") or {})
        reason_counts = dict(summary.get("reason_counts") or normalized.get("cheating_reason_counts") or {})
        reason_seconds = dict(summary.get("reason_seconds") or normalized.get("cheating_reason_seconds") or {})

        events = sum(self._count_value(value) for value in reason_counts.values())
        serious_reasons = {"phone_detected", "multiple_faces", "face_mismatch", "fullscreen_exited"}
        serious_events = sum(self._count_value(reason_counts.get(reason)) for reason in serious_reasons)

        if serious_events >= 3 or self._count_value(reason_counts.get("phone_detected")) > 0:
            severity = "serious"
            status = "cheating"
        elif events > 0:
            severity = "warning"
            status = "suspicious"
        else:
            severity = "clean"
            status = "clean"

        primary_reason = None
        if reason_counts:
            primary_reason = max(reason_counts.items(), key=lambda item: self._count_value(item[1]))[0]

        summary.update(
            {
                "cheating_events": events,
                "status": status,
                "severity": severity,
                "primary_reason": primary_reason,
                "reason_counts": reason_counts,
                "reason_seconds": reason_seconds,
            }
        )
        normalized["cheating_summary"] = summary
        normalized["cheating_reason_counts"] = reason_counts
        normalized["cheating_reason_seconds"] = reason_seconds
        normalized["proctoring_severity"] = severity
        if not normalized.get("behavior_assessment"):
            normalized["behavior_assessment"] = "Identity and environment verification reviewed."
        return normalized

    def _normalize_recommendation(self, report: Dict) -> Dict:
        score = self._score_from_report(report)
        face_analysis = self._normalize_face_analysis(report.get("face_analysis") or {})
        summary = face_analysis.get("cheating_summary") or {}

        is_serious_proctoring = (summary.get("severity") == "serious")

        if is_serious_proctoring:
            if score >= 8.0:
                decision = "Consider with Flag"
                justification = f"Recommended based on strong interview performance with an overall score of {score}/10, but flagged for manual review due to integrity warnings (no automatic rejection based on speech quality)."
            elif score >= 6.5:
                decision = "Consider with Training & Flag"
                justification = f"Workable role fit with an overall score of {score}/10, but flagged for manual review due to integrity warnings."
            else:
                decision = "Rejected - Suspicious Activity"
                justification = f"Rejected due to low answer quality (score: {score}/10) coupled with serious proctoring integrity issues."
        elif score >= 8.0:
            decision = "Hire"
            justification = f"Recommended based on strong interview performance with an overall score of {score}/10."
        elif score >= 6.5:
            decision = "Consider with Training"
            justification = f"Candidate showed workable role fit with an overall score of {score}/10; some areas need follow-up."
        else:
            decision = "Not Recommended"
            justification = f"Not recommended based on interview answer quality and an overall score of {score}/10."

        report["face_analysis"] = face_analysis
        report.setdefault("overall_performance", {})["average_score"] = score
        report["final_recommendation"] = {
            "decision": decision,
            "justification": justification,
        }
        return report

    def score_interview(self, interview_session: Dict) -> Dict:
        FINAL_REPORT_PROMPT = ChatPromptTemplate.from_messages(REPORT_PROMPT)
        logger.info("Scoring interview via LLM")
        face_analysis = interview_session.get("face_analysis", {})
        report = self.llm.generate_report(
            FINAL_REPORT_PROMPT,
            interview_session['role'],
            interview_session['data'],
            face_analysis,
        )
        if isinstance(report, dict):
            return self._normalize_recommendation(report)
        return report
