from typing import Annotated, List, TypedDict
from langchain_core.documents import Document

class AgentState(TypedDict):
    # The user's question
    question: str
    # The math concepts retrieved from your DB
    context: List[Document]
    # The proof drafted by the LLM
    proof: str
    # A boolean to check if the proof is valid
    is_compliant: bool