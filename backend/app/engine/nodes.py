from .state import AgentState
from app.engine.llm import get_llm, text_of
from app.database.mathlib_store import search_mathlib
from app.engine.formalizer import formalize_question
from app.engine.proof_agent import prove_statement

# The interactive Q&A keeps the Lean loop short: every check pays the full
# `import Mathlib` elaboration cost, so fewer, broader tactics than the
# offline proof-lab run.
QA_CANDIDATES = ["simp", "omega", "aesop"]
QA_MAX_LLM_ATTEMPTS = 2

def retrieve(state: AgentState):
    print("---RETRIEVING (MATHLIB)---")
    return {"mathlib_context": search_mathlib(state["question"], k=5)}

def formalize_and_prove(state: AgentState):
    """Try to turn the question into a Lean theorem and let the compiler
    prove it. Failure here is fine — we just fall back to AI review."""
    print("---FORMALIZING FOR LEAN---")
    lemmas = state.get("mathlib_context", [])
    statement = formalize_question(state["question"], lemmas)
    if statement is None:
        print("not formalizable — falling back to AI review")
        return {"lean_statement": "", "lean_proof": "", "lean_verified": False}

    print(f"formalized: {statement}")
    outcome = prove_statement(
        statement,
        lemmas,
        label="question",
        candidates=QA_CANDIDATES,
        max_llm_attempts=QA_MAX_LLM_ATTEMPTS,
    )
    if outcome is None:
        print("Lean rejected all attempts — falling back to AI review")
        return {"lean_statement": statement, "lean_proof": "", "lean_verified": False}

    tactic_block, _ = outcome
    print(f"LEAN VERIFIED with {tactic_block!r}")
    return {"lean_statement": statement, "lean_proof": tactic_block, "lean_verified": True}

def generate_proof(state: AgentState):
    print("---GENERATING PROOF (LLAMA 3.3)---")
    llm = get_llm()

    lemma_lines = "\n".join(
        f"- {lemma['name']}: {lemma['statement']}" for lemma in state.get("mathlib_context", [])
    ) or "(none)"

    lean_section = ""
    if state.get("lean_verified"):
        lean_section = f"""
    This statement was already machine-verified by the Lean 4 compiler:
    {state['lean_statement']}
      {state['lean_proof']}
    Your written proof must reach the same conclusion; mirror the structure of
    the verified proof where it helps.
    """

    prompt = f"""
    You are an expert mathematician writing for a textbook.
    Relevant Mathlib lemmas (background reference only — never cite them by name):
    {lemma_lines}
    {lean_section}
    Student Question: {state['question']}

    Task: Write a rigorous, well-presented proof using standard results at
    the appropriate course level; if the claim is false or under-specified,
    say so instead of proving something else.

    Format requirements:
    - Use LaTeX for all math ($...$ inline, $$...$$ display).
    - Structure the answer EXACTLY as:
      **Theorem.** <one precise statement of the claim>
      **Proof.** <the proof>
    - Write the proof as flowing mathematical prose, the way a published
      textbook would. NEVER use "Step 1", "Step 2" scaffolding or numbered
      step headings. Use structural phrases instead: "We proceed by induction
      on $n$.", "For the base case, ...", "Suppose now that ...",
      "It remains to show ...".
    - When a machine-verified Lean proof is given above, mirror its logical
      structure: each intermediate claim in the Lean proof should appear as a
      claim in your prose.
    - The prose must read like a published mathematics text: NEVER mention
      Lean, Mathlib, tactics, or code identifiers (names like
      `Continuous.comp` or `Nat.dvd_antisymm`). Cite results by their
      mathematical content in plain English instead — e.g. "by the
      characterization of continuity in terms of open preimages", "by
      antisymmetry of divisibility".
    - End the proof with $\\blacksquare$.
    - If the question asks for an explanation rather than a proof, answer it
      well without the Theorem/Proof scaffold.
    """
    response = llm.invoke(prompt)
    return {"proof": text_of(response), "attempts": state.get("attempts", 0) + 1}

def verify_proof(state: AgentState):
    print("---VERIFYING PROOF---")
    if state.get("lean_verified"):
        # The Lean compiler already accepted a proof of this exact statement;
        # no LLM judge can add or subtract from that.
        return {"is_compliant": True, "verification": "lean-verified"}

    # cheap tier: a YES/NO grading call doesn't need the smart model
    llm = get_llm(tier="fast")

    verification_prompt = f"""
    You are a math professor grading a proof.

    QUESTION:
    {state['question']}

    PROOF:
    {state['proof']}

    CRITERIA:
    1. Does the proof answer the question asked and reach the correct
       mathematical conclusion?
    2. Is every step logically sound? Standard, correctly-stated results may
       be used freely, but invented or misstated theorems fail the proof.

    If the proof is correct and logically sound, respond with 'YES'.
    If it has a genuine mathematical error or proves something other than
    what was asked, respond with 'NO'.

    Respond with exactly one word: YES or NO.
    """

    response = llm.invoke(verification_prompt)
    # This logic converts the LLM's "YES" or "NO" into a Boolean
    is_valid = "YES" in text_of(response).upper()

    # IMPORTANT: You must return the dictionary to update the AgentState
    return {"is_compliant": is_valid, "verification": "ai-reviewed" if is_valid else "unverified"}
