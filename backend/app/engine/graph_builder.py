from langgraph.graph import StateGraph, START, END
from .state import AgentState
from app.engine.nodes import retrieve, generate_proof, verify_proof

# Initialize the graph with our state schema
workflow = StateGraph(AgentState)

# Add our nodes
workflow.add_node("retrieve_math", retrieve)
workflow.add_node("draft_proof", generate_proof)

# Define the flow (Edges)
workflow.add_edge(START, "retrieve_math")
workflow.add_edge("retrieve_math", "draft_proof")
workflow.add_edge("draft_proof", END)

# Compile it into an executable app
axlerate_app = workflow.compile()