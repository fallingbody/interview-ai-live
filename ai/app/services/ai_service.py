# app/services/ai_service.py

import os
import json
import google.generativeai as genai
from app.llm.prompts import SYSTEM_QUESTION_TEMPLATE, HUMAN_QUESTION_TEMPLATE
from app.core.logger import get_logger
from app.core.config import settings

logger = get_logger(__name__)

class AIService:
    def __init__(self):
        api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
        if api_key:
            genai.configure(api_key=api_key)
        self.model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        self.temperature = getattr(settings, "GROQ_TEMPERATURE", 0.5)

    def fallback_question(self, role, question_no=1, total_questions=6):
        if question_no == 1:
            return "Tell me about yourself and your most relevant experience."
        if question_no == 2:
            return f"What strengths make you suitable for this {role} role?"
        if question_no >= total_questions:
            return "Why should we consider you for this position?"
        fallback_questions = [
            f"Describe a recent {role} project you worked on.",
            "What was the hardest technical problem you solved recently?",
            "How do you debug issues when your first approach fails?",
            "Which skill from your resume are you strongest in, and why?",
            "Tell me about a time you improved a process or result."
        ]
        return fallback_questions[(question_no - 3) % len(fallback_questions)]

    def generate_next_dynamic_question(self, role, resume_text, previous_interactions, level, question_no=1, total_questions=6):
        logger.info(f"Dynamic Question layer is running. Level: {level}, Question No: {question_no}/{total_questions}")

        # Normalize level
        level = level.lower()

        # Apply language rules based on candidate level
        if level == "beginner":
            language_rule = "Use VERY SIMPLE language, avoid complex technical jargon. Keep it easy to understand."
        elif level == "intermediate":
            language_rule = "Use simple and clear English, focus on practical coding applications."
        else:
            language_rule = "Use professional and technical language. Focus on system design and deep concepts."

        # Add question sequencing rules
        if question_no == 1:
            sequence_rule = "This is the FIRST question. Ask a general HR question about the candidate (e.g., 'Tell me about yourself'). DO NOT ask technical questions."
        elif question_no == 2:
            sequence_rule = "This is the SECOND question. Ask a general HR question (e.g., about their strengths or weaknesses). DO NOT ask technical questions."
        elif question_no == total_questions:
            sequence_rule = "This is the LAST question. Ask a closing HR question (e.g., 'Why should we hire you?' or 'How would you rate yourself out of 5?'). DO NOT ask technical questions."
        else:
            sequence_rule = "This is a TECHNICAL phase question. Drill down into technical skills, specific project details, and core competencies from the resume."

        # Combine the system template with your dynamic level rules
        system_prompt = SYSTEM_QUESTION_TEMPLATE + f"\n\n# LEVEL-SPECIFIC RULES:\n- Candidate Level: {level}\n- {language_rule}\n\n# INTERVIEW STAGE RULES:\n- {sequence_rule}"

        # Format the human prompt with current interview context
        human_prompt = HUMAN_QUESTION_TEMPLATE.format(
            role=role,
            previous_interactions=previous_interactions,
            resume_text=resume_text
        )

        try:
            model = genai.GenerativeModel(self.model_name)
            prompt = system_prompt + "\n\n" + human_prompt
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    response_mime_type="application/json"
                )
            )

            output = response.text
            logger.info("Generated dynamic question payload", extra={"payload": output})
            
            # Robust JSON extraction to handle <think> blocks and markdown
            cleaned_output = output.strip()
            start_idx = cleaned_output.find("{")
            end_idx = cleaned_output.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                cleaned_output = cleaned_output[start_idx : end_idx + 1]
                
            parsed = json.loads(cleaned_output)
            question = str(parsed.get("question") or "").strip()
            if parsed.get("action") == "terminate" or not question:
                return {"question": self.fallback_question(role, question_no, total_questions)}
            return {"question": question}
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Gemini LLM: {str(e)}", extra={"error": str(e), "output": locals().get("output")})
            return {"question": self.fallback_question(role, question_no, total_questions)}
        except Exception as e:
            logger.error(f"An unexpected error occurred during question generation: {type(e).__name__} - {str(e)}")
            return {"question": self.fallback_question(role, question_no, total_questions)}

ai_service = AIService()
