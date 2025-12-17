from .state import AgentState
from langchain_groq import ChatGroq
from app.database.vector_store import search_db

def retrieve(state: AgentState):
    print("---RETRIEVING FROM CHROMA DB---")
    question = state["question"]
    # Now returns List[Document]
    retrieved_docs = search_db(question, k=3)
    return {"context": retrieved_docs}

def generate_proof(state: AgentState):
    print("---GENERATING PROOF (LLAMA 3.3)---")
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
    
    # Extract text from Document objects for the prompt
    context_str = "\n\n".join([doc.page_content for doc in state["context"]])
    
    prompt = f"""
    You are an expert math tutor.
    Context: {context_str}
    Student Question: {state['question']}
    
    Task: Write a rigorous proof. If the context is insufficient, state what is missing.
    Format: Use LaTeX for all math.
    """
    response = llm.invoke(prompt)
    return {"proof": response.content}

def verify_proof(state: AgentState):
    print("---VERIFYING PROOF---")
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
    context_str = "\n\n".join([doc.page_content for doc in state["context"]])
    
    verification_prompt = f"""
    You are a math professor grading a student's proof.
    
    CONTEXT PROVIDED TO STUDENT:
    {context_str}
    
    STUDENT'S PROOF:
    {state['proof']}
    
    CRITERIA:
    1. Does the proof reach the correct mathematical conclusion?
    2. Does the proof use definitions or theorems NOT found in the context? (Allow basic algebraic properties).
    
    If the proof is basically correct and logically sound based on the context, respond with 'YES'.
    If the student invents a theorem or definition that contradicts or isn't in the context, respond with 'NO'.
    
    Respond with exactly one word: YES or NO.
    """
    
    response = llm.invoke(verification_prompt)
    # This logic converts the LLM's "YES" or "NO" into a Boolean
    is_valid = "YES" in response.content.upper()
    
    # IMPORTANT: You must return the dictionary to update the AgentState
    return {"is_compliant": is_valid}