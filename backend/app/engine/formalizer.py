"""Autoformalizer: natural-language question -> Lean 4 theorem statement.

The bridge between the chat RAG and the Lean proof loop. A question that
formalizes cleanly gets machine-verified by the compiler; anything else
falls back to the AI-reviewed path. A statement is only returned if Lean
itself confirms it elaborates (checked with a `sorry` body), so a garbled
translation can never be "proved".
"""
from __future__ import annotations

import re

from app.engine.lean_runner import check_statement

NOT_FORMALIZABLE = "NOT_FORMALIZABLE"
MAX_FORMALIZE_ATTEMPTS = 3

CODE_FENCE_RE = re.compile(r"```(?:lean4?|lean)?\s*\n(.*?)```", re.DOTALL)
STATEMENT_RE = re.compile(r"^theorem\s+\w[\s\S]*:=\s*by$")


def _strip_answer(raw: str) -> str:
    text = raw.strip()
    fence = CODE_FENCE_RE.search(text)
    if fence:
        text = fence.group(1).strip()
    return text.strip()


def formalize_question(question: str, lemmas: list[dict], theorem_name: str = "user_question") -> str | None:
    """Translate a question into a Lean theorem header ending in `:= by`.

    Retries with the compiler's elaboration errors fed back, the same way the
    proof loop retries failed tactics. Returns None when the question isn't a
    single provable statement or no attempt elaborates — callers then fall
    back to AI review.
    """
    from app.engine.llm import get_llm, text_of

    llm = get_llm()

    lemma_lines = "\n".join(f"- {lemma['name']}: {lemma['statement']}" for lemma in lemmas) or "(none)"

    failures: list[tuple[str, str]] = []
    for attempt in range(1, MAX_FORMALIZE_ATTEMPTS + 1):
        failure_lines = ""
        for bad_statement, error in failures:
            failure_lines += (
                f"\nPREVIOUS ATTEMPT (rejected by the Lean compiler — do NOT repeat it):\n"
                f"{bad_statement}\nLEAN ERROR:\n{error}\n"
            )

        prompt = f"""You translate math questions into Lean 4 theorem statements for a Mathlib project.

Question: {question}

Mathlib declarations that may hint at the right types and names:
{lemma_lines}
{failure_lines}
If the question asks to prove one specific, self-contained mathematical fact,
respond with ONLY a Lean 4 theorem statement that ends in `:= by`, for example:
theorem {theorem_name} (n : Nat) : n + 0 = n := by

Rules:
- Name the theorem `{theorem_name}`.
- Statement only: nothing after `by`, no markdown, no commentary, no proof.
- Use standard Lean 4 / Mathlib types and notation (Nat, Real, Set, Finset ...).
- Bind every variable the statement mentions.
- If the question asks for an explanation, a definition, a computation, or is
  not a single provable proposition, respond with exactly {NOT_FORMALIZABLE}.
"""
        raw = text_of(llm.invoke(prompt))
        statement = _strip_answer(raw)

        if NOT_FORMALIZABLE in statement:
            return None
        # enforce the requested name regardless of what the model chose
        statement = re.sub(r"^theorem\s+\S+", f"theorem {theorem_name}", statement)
        if not STATEMENT_RE.match(statement):
            print(f"  formalizer attempt {attempt} rejected (not a bare `theorem ... := by`): {statement!r}")
            failures.append((statement, "output was not a bare `theorem ... := by` header"))
            continue

        result = check_statement(statement)
        if result.accepted:
            return statement

        error = result.errors[0] if result.errors else "unknown elaboration error"
        print(f"  formalizer attempt {attempt} does not elaborate: {error.splitlines()[0]}")
        failures.append((statement, error))

    return None
