import os
import google.generativeai as genai
from app.core.logger import get_logger

logger = get_logger(__name__)

def classify_candidate(resume_text: str) -> str:
    """
    Classifies a candidate's experience level based on their resume text.

    Args:
        resume_text: The text content of the candidate's resume.

    Returns:
        A string indicating the level: 'beginner', 'intermediate', or 'advanced'.
    """
    prompt = f"""
Analyze the following resume text and classify the candidate's experience level.
Your response must be one of these three words ONLY: 'beginner', 'intermediate', 'advanced'.

- 'beginner': 0-2 years of experience, familiar with concepts but limited practical application.
- 'intermediate': 2-5 years of experience, solid practical skills, has worked on multiple projects.
- 'advanced': 5+ years of experience, deep expertise, leadership, or architectural skills.

Do not provide any explanation or other text.

Resume Text:
---
{resume_text}
---

Classification:"""

    try:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY is not configured. Falling back to intermediate level.")
            return "intermediate"

        genai.configure(api_key=api_key)
        
        from app.core.config import settings
        model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.1)
        )
        level = response.text.strip().lower().replace("'", "")
        return level if level in ['beginner', 'intermediate', 'advanced'] else 'intermediate'
    except Exception as e:
        logger.error(f"Error during candidate classification: {type(e).__name__} - {str(e)}")
        return 'intermediate'
