import os
from .state import AgentState
from langchain_groq import ChatGroq

# 1. Retrieval Node: Fetch math from the DB
def retrieve(state: AgentState):
    print("---RETRIEVING CONTEXT---")
    # For now, we simulate. Soon, this will query ChromaDB.
    return {"context": ["Definition 1.19: A vector space is a set V with addition and scalar multiplication."]}

# 2. Drafting Node: Write the proof
def generate_proof(state: AgentState):
    print("---GENERATING PROOF (LLAMA 3.3)---")
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
    
    prompt = f"""
    You are an expert math tutor.
    Context: {state['context']}
    Student Question: {state['question']}
    
    Task: Write a rigorous proof. If the context is insufficient, state what is missing.
    Format: Use LaTeX for all math.
    """
    
    response = llm.invoke(prompt)
    return {"proof": response.content}

# 3. Verification Node: The "Grader"
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