import os

import json
import re
from app.core.logger import get_logger
from app.core.exceptions import ApplicationError
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

logger = get_logger(__name__)

import requests
import os
import google.generativeai as genai
from app.core.config import settings



class LLMClient:

    def __init__(self):

        # self.llm=HuggingFaceEndpoint(
        # repo_id="mistralai/Mistral-7B-Instruct-v0.2",
        # temperature=0,
        # huggingfacehub_api_token=os.getenv('HUGGINGFACE_API_KEY')

        # )
        # self.model=ChatHuggingFace(llm=self.llm)
        api_key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
        if api_key:
            genai.configure(api_key=api_key)
        self.model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        
        self.output_parser = StrOutputParser()
        # if not self.api_key:
        #     raise ApplicationError("HUGGINGFACE_API_KEY is not set")

        # self.client = InferenceClient(
        #     model=self.model,
        #     token=self.api_key,
        # )

        # logger.info(
        #     "LLM client initialized",
        #     extra={"model": self.model},
        # )

    def _coerce_response_text(self, response) -> str:
        if response is None:
            return ""
        if isinstance(response, str):
            return response
        if isinstance(response, dict):
            return json.dumps(response)

        # LangChain message objects usually carry `.content`.
        content = getattr(response, "content", None)
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            try:
                chunks = []
                for item in content:
                    if isinstance(item, str):
                        chunks.append(item)
                    elif isinstance(item, dict):
                        chunks.append(str(item.get("text") or item.get("content") or ""))
                    else:
                        chunks.append(str(item))
                return "\n".join([c for c in chunks if c]).strip()
            except Exception:
                pass

        text_attr = getattr(response, "text", None)
        if isinstance(text_attr, str):
            return text_attr

        return str(response)

    def _extract_json_text(self, text: str) -> str:
        if not text:
            return text

        cleaned = text.strip()
        cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.IGNORECASE).strip()

        # Fallback: if wrapper text exists, extract the first JSON object.
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = cleaned[start : end + 1].strip()
            if candidate:
                return candidate

        return cleaned

    def generate_question(self, prompt, role, previous_interactions, resume_text) -> str:

        try:

            chain = prompt | self.llm | self.output_parser
            response = chain.invoke(
                {
                    "role": role,
                    "previous_interactions": previous_interactions,
                    "resume_text": resume_text,
                }
            )

            if not response:
                raise ApplicationError("Empty response from LLM")
            print(f"This is the response: {response}")
            try:
                # Check if response is already a dict
                if isinstance(response, dict):
                    return response.get("question", response)
                # Try to parse as JSON string
                data = json.loads(str(response))
                return data["question"]
            except (json.JSONDecodeError, KeyError, TypeError):
                # If JSON parsing fails, return the raw text when it looks like a question.
                response_text = str(response).strip()
                if response_text:
                    if "question" in response_text.lower() or response_text.endswith("?"):
                        return response_text
                    if len(response_text.split()) <= 25:
                        return response_text
                raise

        except Exception as e:
            print(f"error is :{e}")
            logger.exception(
                "LLM generation failed",
                extra={"error": str(e)},
            )
            raise ApplicationError("LLM generation failed")

    def generate_report(self, prompt, role, data, face_analysis=None) -> str:
        try:
            # Format the Langchain prompt into a single message string
            langchain_messages = prompt.format_messages(role=role, session_data=data, face_analysis=face_analysis or {})
            combined_content = "\n\n".join([m.content for m in langchain_messages])
            
            model = genai.GenerativeModel(self.model_name)
            
            response = model.generate_content(
                combined_content,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    response_mime_type="application/json"
                )
            )
            
            response_text = response.text
            if not response_text:
                raise ApplicationError("Empty response from LLM")
                
            print(f"Raw report text length: {len(response_text)}")
            
            try:
                # Try to parse as JSON string using robust extraction
                json_text = self._extract_json_text(response_text)
                parsed = json.loads(json_text)
                print(f"The parsed report is: {parsed}")
                return parsed
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.exception("Json loading error", extra={"error": str(e)})
                print(f"JSON parsing error is: {e}")
                return self._extract_json_text(response_text)

        except Exception as e:
            logger.exception("LLM generation failed", extra={"error": str(e)})
            raise ApplicationError("LLM generation failed")
