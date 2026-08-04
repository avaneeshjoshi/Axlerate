from typing import List, TypedDict

class AgentState(TypedDict):
    # The user's question
    question: str
    # The proof drafted by the LLM
    proof: str
    # A boolean to check if the proof is valid
    is_compliant: bool
    # How many drafts we've generated (caps the verify->draft retry loop)
    attempts: int
    # Mathlib lemmas retrieved for grounding and Lean proving
    mathlib_context: List[dict]
    # The question autoformalized into a Lean theorem header ("" if none)
    lean_statement: str
    # The tactic block Lean accepted ("" if unproved)
    lean_proof: str
    # True only when the Lean compiler accepted a proof of lean_statement
    lean_verified: bool
    # "lean-verified" | "ai-reviewed" | "unverified"
    verification: str