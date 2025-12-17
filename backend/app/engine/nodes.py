import os
from .state import AgentState
from langchain_groq import ChatGroq
# Import the search function you built earlier
from app.database.vector_store import search_db

# 1. Retrieval Node: NOW FETCHING REAL DATA
def retrieve(state: AgentState):
    print("---RETRIEVING FROM CHROMA DB---")
    question = state["question"]
    
    # We search for the 2 most relevant definitions/theorems
    retrieved_docs = search_db(question, k=2)
    
    # If the DB is empty or fails, we provide a fallback list so the app doesn't crash
    context = retrieved_docs if retrieved_docs else ["No specific context found in database."]
    
    return {"context": context}

# 2. Drafting Node: Remains mostly the same, but uses real context
def generate_proof(state: AgentState):
    print("---GENERATING PROOF (LLAMA 3.3)---")
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
    
    # We format the list of docs into one string for the prompt
    context_str = "\n".join(state["context"])
    
    prompt = f"""
    You are an expert math tutor.
    Context: {context_str}
    Student Question: {state['question']}
    
    Task: Write a rigorous proof. If the context is insufficient, state what is missing.
    Format: Use LaTeX for all math.
    """
    
    response = llm.invoke(prompt)
    return {"proof": response.content}

# 3. Verification Node: The "Grader" (No changes needed)
def verify_proof(state: AgentState):
    print("---VERIFYING PROOF---")
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
    
    verification_prompt = f"""
    Compare this Proof to the provided Context.
    
    Proof: {state['proof']}
    Context: {state['context']}
    
    Does the proof rely ONLY on the definitions provided in the context? 
    Respond with exactly one word: 'YES' or 'NO'.
    """
    
    response = llm.invoke(verification_prompt)
    is_valid = "YES" in response.content.upper()
    
    return {"is_compliant": is_valid}