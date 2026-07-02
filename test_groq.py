import os
from dotenv import load_dotenv
load_dotenv('ai/.env')

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatGroq(
    api_key=os.environ.get("GROQ_API_KEY"),
    model_name="openai/gpt-oss-120b",
    temperature=1,
    max_tokens=8192,
)

prompt = ChatPromptTemplate.from_messages([
    ("human", "You are an AI. Data: {data}")
])

chain = prompt | llm | StrOutputParser()

try:
    print(chain.invoke({"data": "test data"}))
except Exception as e:
    print("Error:", e)
