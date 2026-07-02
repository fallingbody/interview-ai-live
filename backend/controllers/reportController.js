import mongoose from "mongoose";
import FinalReport from "../models/FinalReport.js";
import InterviewSchedule from "../models/InterviewSchedule.js";
import Campaign from "../models/Campaign.js";
import User from "../models/User.js";
import { sendCandidateEmail } from "../utils/emailService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeFinalReportPayload = (input) => {
  if (!input) return null;
  if (typeof input === "object") return input;
  if (typeof input !== "string") return null;

  let raw = input.trim();
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch (error) {
    return null;
  }
};

const normalizeFaceAnalysis = (input = {}) => {
  const faceAnalysis = input && typeof input === "object" ? { ...input } : {};
  const summary = { ...(faceAnalysis.cheating_summary || {}) };
  const reasonCounts = { ...(summary.reason_counts || faceAnalysis.cheating_reason_counts || {}) };
  const reasonSeconds = { ...(summary.reason_seconds || faceAnalysis.cheating_reason_seconds || {}) };

  const cheatingEvents = Object.values(reasonCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const seriousEvents = ["phone_detected", "multiple_faces", "face_mismatch", "fullscreen_exited"]
    .reduce((sum, reason) => sum + Number(reasonCounts[reason] || 0), 0);
  const severity = Number(reasonCounts.phone_detected || 0) > 0 || seriousEvents >= 3
    ? "serious"
    : cheatingEvents > 0
      ? "warning"
      : "clean";
  const status = severity === "serious" ? "cheating" : severity === "warning" ? "suspicious" : "clean";
  const primaryReason = Object.entries(reasonCounts)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0]?.[0] || null;

  faceAnalysis.cheating_reason_counts = reasonCounts;
  faceAnalysis.cheating_reason_seconds = reasonSeconds;
  faceAnalysis.proctoring_severity = severity;
  faceAnalysis.cheating_summary = {
    ...summary,
    cheating_events: cheatingEvents,
    status,
    severity,
    primary_reason: primaryReason,
    reason_counts: reasonCounts,
    reason_seconds: reasonSeconds,
  };

  return faceAnalysis;
};

// POST /create-report
export const createReport = async (req, res) => {
  try {
    const { sessionId, name, email, yearOfStudy, interviewerId, userId } = req.body;
    const requesterId = req.user?.id;

    if (!isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid sessionId" });
    }

    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Missing required fields: name, email" });
    }

    const session = await InterviewSchedule.findById(sessionId).select("interviewerId candidateEmails");
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const allowedEmails = (session.candidateEmails || [])
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter(Boolean);

    const emailIndex = allowedEmails.indexOf(normalizedEmail);

    if (emailIndex === -1) {
      return res.status(403).json({ success: false, message: "Email is not registered for this session" });
    }

    // Calculate groupCode based on the email index (matches campaign generation logic)
    const batchSize = 50;
    const groupIndex = Math.floor(emailIndex / batchSize);
    const groupCode = String.fromCharCode(65 + groupIndex);

    if (requesterId && String(requesterId) !== String(session.interviewerId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (interviewerId && String(interviewerId) !== String(session.interviewerId)) {
      return res.status(400).json({ success: false, message: "Invalid interviewerId for this session" });
    }

    const existingReport = await FinalReport.findOne({
      sessionId,
      "candidate_overview.email": normalizedEmail,
    }).select("_id");

    if (existingReport) {
      return res.status(200).json({
        success: true,
        message: "Report already exists",
        reportId: existingReport._id,
      });
    }

    const report = new FinalReport({
      sessionId,
      interviewerId: session.interviewerId,
      candidateId: userId ? String(userId) : null,
      candidate_overview: {
        name,
        email: normalizedEmail,

        yearOfStudy,
        group: groupCode
      }
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      reportId: report._id
    });

  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /update-report/:reportId
export const updateReport = async (req, res) => {
  const report = req.body;
  const { reportId } = req.params;
  const requesterId = req.user?.id;

  try {
    console.log("Update report payload:", JSON.stringify(report, null, 2));
    if (!isValidObjectId(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid reportId" });
    }

    const existingReport = await FinalReport.findById(reportId).select("interviewerId candidateId");
    if (!existingReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const payload = normalizeFinalReportPayload(report.final_report || report);
    if (!payload) {
      return res.status(400).json({ success: false, message: "Invalid final report payload format." });
    }
    console.log("Normalized payload:", JSON.stringify(payload, null, 2));

    const section = payload.section_wise_evaluation || {};
    const general = section.General || section.general || {};
    const technical = section.Technical || section.technical || {};
    const hr = section.HR || section.hr || {};
    const overall = payload.overall_performance || {};

    // BUG FIX: face_analysis can be at the root of the request or inside final_report
    const faceAnalysis = normalizeFaceAnalysis(report.face_analysis || payload.face_analysis || {});

    const updates = {
      "candidate_overview.summary": payload.candidate_overview?.summary,
      "overall_performance.score": overall?.average_score ?? overall?.score,
      "overall_performance.performance_level": overall?.performance_level,
      "overall_performance.summary": overall?.summary,
      strengths: payload.strengths,
      weaknesses: payload.weaknesses,
      "section_wise_evaluation.hr.score": hr?.average_score ?? hr?.score,
      "section_wise_evaluation.hr.feedback": hr?.feedback,
      "section_wise_evaluation.general.score": general?.average_score ?? general?.score,
      "section_wise_evaluation.general.feedback": general?.feedback,
      "section_wise_evaluation.technical.score": technical?.average_score ?? technical?.score,
      "section_wise_evaluation.technical.feedback": technical?.feedback,
      "face_analysis.confidence_score": faceAnalysis?.confidence_score,
      "face_analysis.dominant_emotion": faceAnalysis?.dominant_emotion,
      "face_analysis.last_emotion": faceAnalysis?.last_emotion ?? faceAnalysis?.dominant_emotion,
      "face_analysis.verification_rate": faceAnalysis?.verification_rate,
      "face_analysis.verification_status": faceAnalysis?.verification_status ?? faceAnalysis?.status,
      "face_analysis.behavior_assessment": faceAnalysis?.behavior_assessment,
      "face_analysis.behavior": faceAnalysis?.behavior,
      "face_analysis.proctoring_severity": faceAnalysis?.proctoring_severity ?? faceAnalysis?.cheating_summary?.severity,
      "face_analysis.verified_frames": faceAnalysis?.verified_frames,
      "face_analysis.total_frames": faceAnalysis?.total_frames ?? faceAnalysis?.frame_count,
      "face_analysis.frame_count": faceAnalysis?.frame_count ?? faceAnalysis?.total_frames,
      "face_analysis.cheating_reason_counts.phone_detected": faceAnalysis?.cheating_reason_counts?.phone_detected ?? faceAnalysis?.cheating_summary?.reason_counts?.phone_detected,
      "face_analysis.cheating_reason_counts.looking_away": faceAnalysis?.cheating_reason_counts?.looking_away ?? faceAnalysis?.cheating_summary?.reason_counts?.looking_away,
      "face_analysis.cheating_reason_counts.multiple_faces": faceAnalysis?.cheating_reason_counts?.multiple_faces ?? faceAnalysis?.cheating_summary?.reason_counts?.multiple_faces,
      "face_analysis.cheating_reason_counts.no_face": faceAnalysis?.cheating_reason_counts?.no_face ?? faceAnalysis?.cheating_summary?.reason_counts?.no_face,
      "face_analysis.cheating_reason_counts.face_mismatch": faceAnalysis?.cheating_reason_counts?.face_mismatch ?? faceAnalysis?.cheating_summary?.reason_counts?.face_mismatch,
      "face_analysis.cheating_reason_seconds.phone_detected": faceAnalysis?.cheating_reason_seconds?.phone_detected ?? faceAnalysis?.cheating_summary?.reason_seconds?.phone_detected,
      "face_analysis.cheating_reason_seconds.looking_away": faceAnalysis?.cheating_reason_seconds?.looking_away ?? faceAnalysis?.cheating_summary?.reason_seconds?.looking_away,
      "face_analysis.cheating_reason_seconds.multiple_faces": faceAnalysis?.cheating_reason_seconds?.multiple_faces ?? faceAnalysis?.cheating_summary?.reason_seconds?.multiple_faces,
      "face_analysis.cheating_reason_seconds.no_face": faceAnalysis?.cheating_reason_seconds?.no_face ?? faceAnalysis?.cheating_summary?.reason_seconds?.no_face,
      "face_analysis.cheating_reason_seconds.face_mismatch": faceAnalysis?.cheating_reason_seconds?.face_mismatch ?? faceAnalysis?.cheating_summary?.reason_seconds?.face_mismatch,
      "face_analysis.cheating_summary.cheating_events": faceAnalysis?.cheating_summary?.cheating_events,
      "face_analysis.cheating_summary.status": faceAnalysis?.cheating_summary?.status,
      "face_analysis.cheating_summary.severity": faceAnalysis?.cheating_summary?.severity ?? faceAnalysis?.proctoring_severity,
      "face_analysis.cheating_summary.primary_reason": faceAnalysis?.cheating_summary?.primary_reason,
      "face_analysis.cheating_summary.reason_counts.phone_detected": faceAnalysis?.cheating_summary?.reason_counts?.phone_detected ?? faceAnalysis?.cheating_reason_counts?.phone_detected,
      "face_analysis.cheating_summary.reason_counts.looking_away": faceAnalysis?.cheating_summary?.reason_counts?.looking_away ?? faceAnalysis?.cheating_reason_counts?.looking_away,
      "face_analysis.cheating_summary.reason_counts.multiple_faces": faceAnalysis?.cheating_summary?.reason_counts?.multiple_faces ?? faceAnalysis?.cheating_reason_counts?.multiple_faces,
      "face_analysis.cheating_summary.reason_counts.no_face": faceAnalysis?.cheating_summary?.reason_counts?.no_face ?? faceAnalysis?.cheating_reason_counts?.no_face,
      "face_analysis.cheating_summary.reason_counts.face_mismatch": faceAnalysis?.cheating_summary?.reason_counts?.face_mismatch ?? faceAnalysis?.cheating_reason_counts?.face_mismatch,
      "face_analysis.cheating_summary.reason_seconds.phone_detected": faceAnalysis?.cheating_summary?.reason_seconds?.phone_detected ?? faceAnalysis?.cheating_reason_seconds?.phone_detected,
      "face_analysis.cheating_summary.reason_seconds.looking_away": faceAnalysis?.cheating_summary?.reason_seconds?.looking_away ?? faceAnalysis?.cheating_reason_seconds?.looking_away,
      "face_analysis.cheating_summary.reason_seconds.multiple_faces": faceAnalysis?.cheating_summary?.reason_seconds?.multiple_faces ?? faceAnalysis?.cheating_reason_seconds?.multiple_faces,
      "face_analysis.cheating_summary.reason_seconds.no_face": faceAnalysis?.cheating_summary?.reason_seconds?.no_face ?? faceAnalysis?.cheating_reason_seconds?.no_face,
      "face_analysis.cheating_summary.reason_seconds.face_mismatch": faceAnalysis?.cheating_summary?.reason_seconds?.face_mismatch ?? faceAnalysis?.cheating_reason_seconds?.face_mismatch,
      "final_recommendation.decision": payload.final_recommendation?.decision,
      "final_recommendation.justification": payload.final_recommendation?.justification,
      "cheating_detected": payload.cheating_detected ?? report.final_report?.cheating_detected ?? report.cheating_detected ?? false,
      "cheating_reason": payload.cheating_reason ?? report.final_report?.cheating_reason ?? report.cheating_reason ?? null
    };

    // Store face analysis if present
    const faceData = payload.face_analysis ? normalizeFaceAnalysis(payload.face_analysis) : null;
    if (faceData && typeof faceData === "object") {
      updates["face_analysis.confidence_score"] = faceData.confidence_score ?? null;
      updates["face_analysis.dominant_emotion"] = faceData.dominant_emotion ?? null;
      updates["face_analysis.last_emotion"] = faceData.last_emotion ?? null;
      updates["face_analysis.verification_status"] = faceData.verification_status ?? null;
      updates["face_analysis.verification_rate"] = faceData.verification_rate ?? null;
      updates["face_analysis.total_frames"] = faceData.total_frames ?? null;
      updates["face_analysis.verified_frames"] = faceData.verified_frames ?? null;
      updates["face_analysis.behavior_assessment"] = faceData.behavior_assessment ?? null;
      updates["face_analysis.proctoring_severity"] = faceData.proctoring_severity ?? faceData.cheating_summary?.severity ?? null;
      updates["face_analysis.cheating_reason_counts.phone_detected"] = faceData.cheating_reason_counts?.phone_detected ?? faceData.cheating_summary?.reason_counts?.phone_detected ?? 0;
      updates["face_analysis.cheating_reason_counts.looking_away"] = faceData.cheating_reason_counts?.looking_away ?? faceData.cheating_summary?.reason_counts?.looking_away ?? 0;
      updates["face_analysis.cheating_reason_counts.multiple_faces"] = faceData.cheating_reason_counts?.multiple_faces ?? faceData.cheating_summary?.reason_counts?.multiple_faces ?? 0;
      updates["face_analysis.cheating_reason_counts.no_face"] = faceData.cheating_reason_counts?.no_face ?? faceData.cheating_summary?.reason_counts?.no_face ?? 0;
      updates["face_analysis.cheating_reason_counts.face_mismatch"] = faceData.cheating_reason_counts?.face_mismatch ?? faceData.cheating_summary?.reason_counts?.face_mismatch ?? 0;
      updates["face_analysis.cheating_reason_seconds.phone_detected"] = faceData.cheating_reason_seconds?.phone_detected ?? faceData.cheating_summary?.reason_seconds?.phone_detected ?? 0;
      updates["face_analysis.cheating_reason_seconds.looking_away"] = faceData.cheating_reason_seconds?.looking_away ?? faceData.cheating_summary?.reason_seconds?.looking_away ?? 0;
      updates["face_analysis.cheating_reason_seconds.multiple_faces"] = faceData.cheating_reason_seconds?.multiple_faces ?? faceData.cheating_summary?.reason_seconds?.multiple_faces ?? 0;
      updates["face_analysis.cheating_reason_seconds.no_face"] = faceData.cheating_reason_seconds?.no_face ?? faceData.cheating_summary?.reason_seconds?.no_face ?? 0;
      updates["face_analysis.cheating_reason_seconds.face_mismatch"] = faceData.cheating_reason_seconds?.face_mismatch ?? faceData.cheating_summary?.reason_seconds?.face_mismatch ?? 0;
      updates["face_analysis.cheating_summary.cheating_events"] = faceData.cheating_summary?.cheating_events ?? 0;
      updates["face_analysis.cheating_summary.status"] = faceData.cheating_summary?.status ?? null;
      updates["face_analysis.cheating_summary.severity"] = faceData.cheating_summary?.severity ?? faceData.proctoring_severity ?? null;
      updates["face_analysis.cheating_summary.primary_reason"] = faceData.cheating_summary?.primary_reason ?? null;
      updates["face_analysis.cheating_summary.reason_counts.phone_detected"] = faceData.cheating_summary?.reason_counts?.phone_detected ?? faceData.cheating_reason_counts?.phone_detected ?? 0;
      updates["face_analysis.cheating_summary.reason_counts.looking_away"] = faceData.cheating_summary?.reason_counts?.looking_away ?? faceData.cheating_reason_counts?.looking_away ?? 0;
      updates["face_analysis.cheating_summary.reason_counts.multiple_faces"] = faceData.cheating_summary?.reason_counts?.multiple_faces ?? faceData.cheating_reason_counts?.multiple_faces ?? 0;
      updates["face_analysis.cheating_summary.reason_counts.no_face"] = faceData.cheating_summary?.reason_counts?.no_face ?? faceData.cheating_reason_counts?.no_face ?? 0;
      updates["face_analysis.cheating_summary.reason_counts.face_mismatch"] = faceData.cheating_summary?.reason_counts?.face_mismatch ?? faceData.cheating_reason_counts?.face_mismatch ?? 0;
      updates["face_analysis.cheating_summary.reason_seconds.phone_detected"] = faceData.cheating_summary?.reason_seconds?.phone_detected ?? faceData.cheating_reason_seconds?.phone_detected ?? 0;
      updates["face_analysis.cheating_summary.reason_seconds.looking_away"] = faceData.cheating_summary?.reason_seconds?.looking_away ?? faceData.cheating_reason_seconds?.looking_away ?? 0;
      updates["face_analysis.cheating_summary.reason_seconds.multiple_faces"] = faceData.cheating_summary?.reason_seconds?.multiple_faces ?? faceData.cheating_reason_seconds?.multiple_faces ?? 0;
      updates["face_analysis.cheating_summary.reason_seconds.no_face"] = faceData.cheating_summary?.reason_seconds?.no_face ?? faceData.cheating_reason_seconds?.no_face ?? 0;
      updates["face_analysis.cheating_summary.reason_seconds.face_mismatch"] = faceData.cheating_summary?.reason_seconds?.face_mismatch ?? faceData.cheating_reason_seconds?.face_mismatch ?? 0;
    }

    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) delete updates[key];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid report fields provided to update." });
    }

    const updatedReport = await FinalReport.findByIdAndUpdate(
      reportId,
      { $set: updates },
      { new: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    return res.json({ success: true, message: "Report updated successfully", report: updatedReport });

  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /candidates/:userId
export const getCandidates = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user?.id;

    if (!requesterId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (String(requesterId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const allowedStatuses = new Set(["selected", "pending", "rejected", "completed"]);
    const reports = await FinalReport.find({ interviewerId: userId })
      .select(
        "decision_status candidate_overview company_name sessionId _id overall_performance section_wise_evaluation face_analysis strengths weaknesses final_recommendation decision_date decided_by interviewerId cheating_detected cheating_reason createdAt updatedAt"
      )
      .populate("decided_by", "name email")
      .lean();

    const candidates = reports.map((report) => {
      const decisionStatus = String(report.decision_status || "pending").toLowerCase();
      const resolvedDecider = report.decided_by || null;

      return {
        id: String(report._id),
        decision_status: allowedStatuses.has(decisionStatus) ? decisionStatus : "pending",
        candidate_overview: report.candidate_overview || {},
        company_name: report.company_name || "",
        sessionId: String(report.sessionId),
        overall_performance: report.overall_performance || null,
        section_wise_evaluation: report.section_wise_evaluation || null,
        face_analysis: report.face_analysis || null,
        strengths: Array.isArray(report.strengths) ? report.strengths : [],
        weaknesses: Array.isArray(report.weaknesses) ? report.weaknesses : [],
        final_recommendation: report.final_recommendation || null,
        decision_date: report.decision_date || null,
        createdAt: report.createdAt || null,
        updatedAt: report.updatedAt || null,
        decided_by: resolvedDecider
          ? {
            _id: String(resolvedDecider._id),
            name: resolvedDecider.name || null,
          }
          : null,
        cheating_detected: report.cheating_detected || false,
        cheating_reason: report.cheating_reason || null,
      };
    });

    return res.json({ success: true, candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /candidate-action
export const candidateAction = async (req, res) => {
  try {
    const {
      candidateId,
      candidateName,
      action,
      companyName,
      jobTitle,  // 🔑 Passed directly from frontend — no DB lookup needed
    } = req.body;
    const requesterId = req.user?.id;
    
    // Fetch user to get real company_name and username
    let recruiterName = "Talent Acquisition Team";
    let normalizedCompanyName = String(companyName || "").trim() || "Interview.ai";
    
    if (requesterId) {
      const userDoc = await User.findById(requesterId);
      if (userDoc) {
        recruiterName = userDoc.username || recruiterName;
        if (userDoc.company_name) {
          normalizedCompanyName = userDoc.company_name;
        }
      }
    }

    const role = String(jobTitle || "").trim() || "the position";

    if (!requesterId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!isValidObjectId(candidateId)) {
      return res.status(400).json({ success: false, message: "Invalid candidateId" });
    }

    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!normalizedAction || !["selected", "rejected"].includes(normalizedAction)) {
      return res.status(400).json({ success: false, message: "Invalid action. Allowed values: selected, rejected" });
    }

    const existingReport = await FinalReport.findById(candidateId).select("interviewerId candidate_overview sessionId");
    if (!existingReport) {
      return res.status(404).json({ success: false, message: "Candidate report not found" });
    }

    if (String(existingReport.interviewerId) !== String(requesterId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const candidateEmail = existingReport.candidate_overview?.email;
    const safeCandidateName = candidateName || existingReport.candidate_overview?.name || "Candidate";
    if (!candidateEmail) {
      return res.status(400).json({ success: false, message: "Candidate email not found in report" });
    }

    // 1️⃣ Update status in Database
    const updatedReport = await FinalReport.findByIdAndUpdate(
      candidateId,
      {
        decision_status: normalizedAction,
        company_name: normalizedCompanyName,
        decision_date: new Date(),
        decided_by: requesterId,
      },
      { new: true }
    );

    const populatedReport = await FinalReport.findById(updatedReport._id).populate(
      "decided_by",
      "username email"
    );

    // 2️⃣ Respond INSTANTLY — do not wait for email
    res.json({
      success: true,
      message: `Candidate ${normalizedAction} successfully.`,
      updatedReport: populatedReport,
    });

    // 3️⃣ Fire-and-forget email in background (does NOT block the response above)
    const emailSubject =
      normalizedAction === "selected"
        ? `🎉 Congratulations! You have been Selected by ${normalizedCompanyName}`
        : `Interview Update: Your Status with ${normalizedCompanyName}`;

    const emailBody =
      normalizedAction === "selected"
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #10b981; margin-top: 0;">Congratulations ${safeCandidateName}!</h2>
            <p>We are pleased to inform you that you have been <strong>SELECTED</strong> for the <strong>${role}</strong> position at <strong>${normalizedCompanyName}</strong>.</p>
            <p>Our team will contact you shortly with the next steps regarding your onboarding and offer details.</p>
            <br/>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">Best regards,<br/><strong>${recruiterName}</strong><br/>${normalizedCompanyName}</p>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #374151; margin-top: 0;">Interview Update</h2>
            <p>Dear ${safeCandidateName},</p>
            <p>Thank you for taking the time to interview with us for the <strong>${role}</strong> position at <strong>${normalizedCompanyName}</strong>.</p>
            <p>After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
            <p style="margin-bottom: 0;">We appreciate your interest and wish you the best of luck in your career search.</p>
            <br/>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">Best regards,<br/><strong>${recruiterName}</strong><br/>${normalizedCompanyName}</p>
          </div>
        `;

    sendCandidateEmail(candidateEmail, emailSubject, emailBody)
      .then(() => console.log(`[email] Outcome email sent to ${candidateEmail} (${normalizedAction})`))
      .catch((err) => console.error(`[email] Outcome email failed for ${candidateEmail}:`, err.message));

  } catch (error) {
    console.error("Error processing candidate action:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// POST /bulk-candidate-action
export const bulkCandidateAction = async (req, res) => {
  try {
    const { updates, companyName } = req.body;
    const requesterId = req.user?.id;

    if (!requesterId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: "No updates provided" });
    }

    let normalizedCompanyName = String(companyName || "").trim() || "Interview.ai";
    const userDoc = await User.findById(requesterId);
    if (userDoc?.company_name) {
      normalizedCompanyName = userDoc.company_name;
    }

    const bulkOps = updates.map(u => ({
      updateOne: {
        filter: { _id: u.candidateId, interviewerId: requesterId },
        update: {
          $set: {
            decision_status: u.action,
            company_name: normalizedCompanyName,
            decision_date: new Date(),
            decided_by: requesterId
          }
        }
      }
    }));

    await FinalReport.bulkWrite(bulkOps);

    res.json({ success: true, message: `Successfully updated ${updates.length} candidates.` });
  } catch (error) {
    console.error("Error in bulk candidate action:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
