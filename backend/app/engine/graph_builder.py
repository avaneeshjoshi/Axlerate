from langgraph.graph import StateGraph, START, END
from .state import AgentState
from app.engine.nodes import retrieve, formalize_and_prove, generate_proof, verify_proof

# 1. Initialize the graph
workflow = StateGraph(AgentState)

# 2. Add the nodes
workflow.add_node("retrieve_math", retrieve)
workflow.add_node("formalize_prove", formalize_and_prove)
workflow.add_node("draft_proof", generate_proof)
workflow.add_node("verify_math", verify_proof)

# 3. Define the linear start. The Lean attempt runs once, before drafting,
# so the LaTeX retry loop never re-pays the compiler cost.
workflow.add_edge(START, "retrieve_math")
workflow.add_edge("retrieve_math", "formalize_prove")
workflow.add_edge("formalize_prove", "draft_proof")
workflow.add_edge("draft_proof", "verify_math") # Point draft to verify

# 4. Define Conditional Logic (The Router)
MAX_DRAFT_ATTEMPTS = 3

def decide_to_finish(state: AgentState):
    if state["is_compliant"]:
        return "complete"
    # Give up after a few drafts: return the best effort with
    # is_compliant=False instead of looping until the recursion limit.
    if state.get("attempts", 0) >= MAX_DRAFT_ATTEMPTS:
        return "complete"
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