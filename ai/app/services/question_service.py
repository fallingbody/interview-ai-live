
from app.llm.client import LLMClient
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from app.llm.prompts import HUMAN_QUESTION_TEMPLATE,SYSTEM_QUESTION_TEMPLATE

class QuestionService:
    def __init__(self):
        self.llm = LLMClient()

    def generate_question(
        self,
        role: str,
        resume_text: str,
        previous_interactions: list[dict],
    ) -> str:
        
        previous_context = "None"
        if previous_interactions:
            previous_context = "\n\n".join(
                f"Q: {item['question']}\nA: {item['answer']}" for item in previous_interactions
            )

        chat_prompt = ChatPromptTemplate.from_messages([
            HumanMessagePromptTemplate.from_template(SYSTEM_QUESTION_TEMPLATE + "\n\n" + HUMAN_QUESTION_TEMPLATE)
        ])

        return self.llm.generate_question(chat_prompt, role, previous_context, resume_text)
