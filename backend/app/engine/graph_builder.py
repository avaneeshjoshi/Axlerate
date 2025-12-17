from langgraph.graph import StateGraph, START, END
from .state import AgentState
from app.engine.nodes import retrieve, generate_proof, verify_proof

# 1. Initialize the graph
workflow = StateGraph(AgentState)

# 2. Add all three nodes
workflow.add_node("retrieve_math", retrieve)
workflow.add_node("draft_proof", generate_proof)
workflow.add_node("verify_math", verify_proof) # Added this

# 3. Define the linear start
workflow.add_edge(START, "retrieve_math")
workflow.add_edge("retrieve_math", "draft_proof")
workflow.add_edge("draft_proof", "verify_math") # Point draft to verify

# 4. Define Conditional Logic (The Router)
def decide_to_finish(state: AgentState):
    if state["is_compliant"]:
        return "complete"
    else:
        return "retry"

# 5. Add the Conditional Edge
workflow.add_conditional_edges(
    "verify_math",
    decide_to_finish,
    {
        "complete": END,
        "retry": "draft_proof" # If it fails, send it back to the drafting node!
    }
)

# 6. Compile
axlerate_app = workflow.compile()