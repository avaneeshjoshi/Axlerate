"""Sketch-then-prove: close complex theorems by decomposition.

For proofs too hard to land in one tactic block, Claude first writes a proof
SKELETON — a structured tactic block (`have`/`induction`/`constructor`/...)
with `sorry` in place of each nontrivial subproof. The warm Lean REPL reports
the exact goal state at every sorry; each hole is then closed independently
(cheap tactics first, Haiku draft next, Sonnet drafts after that), verified
per-hole via the REPL's proof-state tactic mode. Finally the filled-in proof
is re-checked whole by `check_proof` — the compiler remains the only oracle.

Each hole is a (goal, proof) node — the same structure the planned ProofLab
collaborative graph view is built on.
"""
from __future__ import annotations

import re

from app.engine.lean_repl import LeanRepl
from app.engine.lean_runner import (
    FORBIDDEN_TOKENS,
    LeanResult,
    build_attempt_source,
    check_proof,
)
from app.engine.llm import get_llm, text_of

MAX_SKETCH_ATTEMPTS = 2
MAX_HOLE_LLM_ATTEMPTS = 3

# Broader than the flat loop's list — per-hole checks are ~instant on the
# warm REPL, so casting a wide net is nearly free. `exact?` (Mathlib-wide
# lemma search) goes last: slower than the rest, but no LLM call needed.
HOLE_CANDIDATES = [
    "simp", "omega", "ring", "norm_num", "aesop", "positivity",
    "nlinarith", "simp_arith", "tauto", "decide", "exact?",
]

CODE_FENCE_RE = re.compile(r"```(?:lean4?|lean)?\s*\n(.*?)```", re.DOTALL)
SORRY_RE = re.compile(r"\bsorry\b")


def _emit(on_event, event_type: str, **data) -> None:
    if on_event is not None:
        on_event({"type": event_type, **data})


def _strip_answer(raw: str) -> str:
    text = raw.strip()
    fence = CODE_FENCE_RE.search(text)
    if fence:
        text = fence.group(1).strip()
    if text.startswith("by\n"):
        text = text[3:]
    elif text.startswith("by "):
        text = text[3:]
    return text.strip()


def _errors_in(response: dict) -> list[str]:
    errors = []
    for message in response.get("messages", []):
        if message.get("severity") == "error":
            errors.append(message.get("data", ""))
    # tactic mode reports some failures as a bare top-level message string
    if isinstance(response.get("message"), str):
        errors.append(response["message"])
    return errors


def _draft_skeleton(statement: str, lemmas: list[dict], failures: list[tuple[str, str]]) -> str:
    llm = get_llm()  # smart tier — structure is the hard part

    lemma_lines = "\n".join(f"- {lemma['name']}: {lemma['statement']}" for lemma in lemmas) or "(none)"
    failure_lines = ""
    for skeleton, error in failures:
        failure_lines += f"\nFAILED SKELETON (do NOT repeat):\n{skeleton}\nLEAN ERRORS:\n{error}\n"

    prompt = f"""You are a Lean 4 proof assistant working in a Mathlib project.

Write a PROOF SKELETON for this theorem. Everything after `by` is yours:

{statement}

A skeleton structures the proof into intermediate steps — `have` statements,
`induction`, `obtain`, `constructor`, `cases` — with `sorry` standing in for
each nontrivial subproof. The Lean compiler will report the goal at every
sorry, and each will be closed separately.

Possibly relevant Mathlib lemmas:
{lemma_lines}
{failure_lines}
Rules:
- Respond with ONLY the tactic block after `by`. No markdown, no explanation.
- Everything except the `sorry`s must elaborate: valid Lean 4 + current Mathlib.
- Use `sorry` alone (never `exact sorry`) for each hole; aim for 1-6 holes.
- Trivial steps may be closed inline; keep sorries for the genuinely hard parts.
- If the whole proof is simple enough to write directly, write it with no sorries.
"""
    return _strip_answer(text_of(llm.invoke(prompt)))


def _draft_hole(goal: str, lemmas: list[dict], failures: list[tuple[str, str]], attempt: int) -> str:
    # First LLM attempt on the cheap tier; escalate to Sonnet after that.
    llm = get_llm(tier="fast" if attempt == 1 else "smart")

    lemma_lines = "\n".join(f"- {lemma['name']}: {lemma['statement']}" for lemma in lemmas) or "(none)"
    failure_lines = ""
    for tactic, error in failures:
        failure_lines += f"\nFAILED ATTEMPT (do NOT repeat):\n{tactic}\nLEAN ERROR:\n{error}\n"

    prompt = f"""You are a Lean 4 proof assistant working in a Mathlib project.

Close this goal (it is one hole inside a larger, already-validated proof):

{goal}

Possibly relevant Mathlib lemmas:
{lemma_lines}
{failure_lines}
Rules:
- Respond with ONLY the tactic(s) that close the goal. No markdown, no `by`, no explanation.
- Prefer a single tactic or a short `;`-separated sequence, e.g. `intro h; simp [h]`.
- This is Lean 4 + current Mathlib syntax, not Lean 3.
- Never use `sorry` or `admit`.
"""
    return _strip_answer(text_of(llm.invoke(prompt)))


def _tactic_closes(repl: LeanRepl, proof_state: int, tactic_block: str) -> tuple[bool, str, dict]:
    """Test one candidate against a hole's proof state.
    Returns (closed, error, raw REPL response)."""
    lowered = tactic_block.lower()
    for token in FORBIDDEN_TOKENS:
        if token in lowered:
            return False, f"forbidden token: {token.strip()}", {}

    # collapse to one parenthesized sequence so it applies as a single tactic
    joined = "; ".join(line.strip() for line in tactic_block.strip().splitlines() if line.strip())
    try:
        response = repl.run_tactic(proof_state, f"({joined})")
    except Exception as exc:
        return False, f"REPL unavailable: {exc}", {}

    errors = _errors_in(response)
    if errors:
        return False, errors[0], response
    if response.get("sorries"):
        return False, "tactic introduced a sorry", response
    goals = response.get("goals", [])
    if goals:
        return False, "unsolved goals:\n" + "\n\n".join(goals[:2]), response
    return True, "", response


def _close_hole(
    repl: LeanRepl,
    goal: str,
    proof_state: int,
    lemmas: list[dict],
    on_event=None,
    label: str = "statement",
) -> str | None:
    from app.engine.proof_agent import SUGGESTION_RE

    for candidate in HOLE_CANDIDATES:
        closed, _, response = _tactic_closes(repl, proof_state, candidate)
        if closed:
            if candidate == "exact?":
                # prefer the concrete lemma over the search tactic
                for message in response.get("messages", []):
                    match = SUGGESTION_RE.search(message.get("data", ""))
                    if match:
                        suggestion = match.group(1).splitlines()[0].strip()
                        ok, _, _ = _tactic_closes(repl, proof_state, suggestion)
                        if ok:
                            return suggestion
                        break
            return candidate

    failures: list[tuple[str, str]] = []
    for attempt in range(1, MAX_HOLE_LLM_ATTEMPTS + 1):
        tactic_block = _draft_hole(goal, lemmas, failures, attempt)
        print(f"    hole attempt {attempt}: {tactic_block!r} ... ", end="", flush=True)
        closed, error, _ = _tactic_closes(repl, proof_state, tactic_block)
        print("closed" if closed else "rejected")
        _emit(on_event, "hole_attempt", target=label, tactic=tactic_block, closed=closed)
        if closed:
            return tactic_block
        failures.append((tactic_block, error.splitlines()[0] if error else ""))

    return None


def _fill_holes(skeleton: str, hole_proofs: list[str]) -> str:
    """Substitute each `sorry` (in order) with its parenthesized proof."""
    filled = skeleton
    for proof in hole_proofs:
        joined = "; ".join(line.strip() for line in proof.strip().splitlines() if line.strip())
        filled = SORRY_RE.sub(f"({joined})", filled, count=1)
    return filled


def sketch_and_prove(
    statement: str,
    lemmas: list[dict],
    on_event=None,
    label: str = "statement",
    preamble: str = "",
) -> tuple[str, LeanResult] | None:
    """Decompose a hard theorem into holes and close them one by one.

    Requires the warm REPL (per-hole proof states only exist there). Returns
    (tactic_block, result) once the fully assembled proof passes check_proof,
    None when the sketch or any hole resists closing.
    """
    repl = LeanRepl.get()
    if not repl.available():
        return None

    sketch_failures: list[tuple[str, str]] = []
    for sketch_attempt in range(1, MAX_SKETCH_ATTEMPTS + 1):
        skeleton = _draft_skeleton(statement, lemmas, sketch_failures)
        print(f"  sketch attempt {sketch_attempt}:\n{skeleton}")
        _emit(on_event, "sketch_drafted", target=label, skeleton=skeleton)

        source = build_attempt_source(statement, skeleton, include_import=False, preamble=preamble)
        try:
            response = repl.check(source)
        except Exception as exc:
            print(f"  REPL failed during sketch check ({exc})")
            return None

        errors = _errors_in(response)
        if errors:
            print(f"  skeleton rejected: {errors[0].splitlines()[0]}")
            sketch_failures.append((skeleton, "\n".join(errors[:3])))
            continue

        sorries = response.get("sorries", [])
        if not sorries:
            # the model wrote a complete proof — let the oracle confirm it
            result = check_proof(statement, skeleton, preamble=preamble)
            if result.accepted:
                return skeleton, result
            sketch_failures.append((skeleton, "\n".join(result.errors[:3])))
            continue

        print(f"  skeleton accepted with {len(sorries)} hole(s)")
        _emit(on_event, "sketch_accepted", target=label, holes=[s.get("goal", "") for s in sorries])

        hole_proofs: list[str] = []
        all_closed = True
        for index, sorry in enumerate(sorries, start=1):
            goal = sorry.get("goal", "")
            print(f"  hole {index}/{len(sorries)}: {goal.splitlines()[-1] if goal else '?'}")
            proof = _close_hole(
                repl, goal, sorry["proofState"], lemmas, on_event=on_event, label=label
            )
            if proof is None:
                print(f"  hole {index} resisted all attempts")
                _emit(on_event, "hole_failed", target=label, goal=goal)
                all_closed = False
                break
            hole_proofs.append(proof)
            _emit(on_event, "hole_closed", target=label, goal=goal, proof=proof)

        if not all_closed:
            sketch_failures.append((skeleton, "a hole could not be closed; try a different decomposition"))
            continue

        filled = _fill_holes(skeleton, hole_proofs)
        result = check_proof(statement, filled, preamble=preamble)
        if result.accepted:
            print("  assembled proof ACCEPTED")
            return filled, result
        print(f"  assembled proof rejected: {result.errors[:1]}")
        sketch_failures.append((filled, "\n".join(result.errors[:3])))

    return None
