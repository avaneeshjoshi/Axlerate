"""Proof Agent: the core loop.

Pulls unproved targets from proof_lab/targets.json, retrieves relevant lemmas
from the Mathlib store, drafts Lean tactic blocks (cheap deterministic
candidates first, then the LLM), and lets the Lean compiler decide. Verified
proofs are written back into Targets.lean and targets.json.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")

sys.path.append(str(REPO_ROOT / "backend"))

from app.database.mathlib_store import search_mathlib
from app.engine.lean_runner import LeanResult, check_proof

TARGETS_JSON = REPO_ROOT / "proof_lab" / "targets.json"
TARGETS_LEAN = REPO_ROOT / "proof_lab" / "ProofLab" / "Targets.lean"

# Cheap tactics worth trying before spending an LLM call. Order matters:
# fastest and most specific first.
DETERMINISTIC_CANDIDATES = [
    "rfl",
    "simp",
    "omega",
    "ext x; simp",
    "aesop",
]

MAX_LLM_ATTEMPTS = 4
RETRIEVAL_K = 5

CODE_FENCE_RE = re.compile(r"```(?:lean4?|lean)?\s*\n(.*?)```", re.DOTALL)
# e.g. "Try this:\n  [apply] exact Nat.dvd_antisymm h1 h2"
SUGGESTION_RE = re.compile(r"Try this:\s*(?:\[[^\]]+\]\s*)?(exact\s.+)")


def extract_library_suggestion(raw_output: str) -> str | None:
    """Pull the concrete `exact <lemma>` out of a successful `exact?` run."""
    texts: list[str]
    if raw_output.lstrip().startswith("{"):
        try:
            data = json.loads(raw_output)
            texts = [message.get("data", "") for message in data.get("messages", [])]
        except (ValueError, AttributeError):
            texts = [raw_output]
    else:
        texts = [raw_output]

    for text in texts:
        match = SUGGESTION_RE.search(text)
        if match:
            return match.group(1).splitlines()[0].strip()
    return None


def try_library_search(statement: str, preamble: str = "") -> tuple[str, LeanResult] | None:
    """Run Lean's `exact?` lemma search over all of Mathlib (plus any
    preamble theorems). On success, prefer the concrete lemma it suggests
    over the search tactic itself."""
    result = check_proof(statement, "exact?", preamble=preamble)
    if not result.accepted:
        return None

    suggestion = extract_library_suggestion(result.raw_output)
    if suggestion:
        confirmed = check_proof(statement, suggestion, preamble=preamble)
        if confirmed.accepted:
            return suggestion, confirmed
    return "exact?", result


def _emit(on_event, event_type: str, **data) -> None:
    """Push a progress event to an optional listener (used by the API)."""
    if on_event is not None:
        on_event({"type": event_type, **data})


def load_targets() -> list[dict]:
    return json.loads(TARGETS_JSON.read_text(encoding="utf-8"))


def save_targets(targets: list[dict]) -> None:
    TARGETS_JSON.write_text(json.dumps(targets, indent=2) + "\n", encoding="utf-8")


def write_proof_into_targets_lean(target_id: str, tactic_block: str) -> None:
    """Replace the `sorry` under `theorem <target_id>` with the verified proof."""
    lines = TARGETS_LEAN.read_text(encoding="utf-8").splitlines()
    theorem_re = re.compile(rf"^\s*theorem\s+{re.escape(target_id)}\b")

    inside_theorem = False
    for index, line in enumerate(lines):
        if theorem_re.match(line):
            inside_theorem = True
            continue
        if inside_theorem and re.match(r"^\s*theorem\s", line):
            break
        if inside_theorem and line.strip() == "sorry":
            indent = line[: len(line) - len(line.lstrip())]
            proof_lines = [indent + proof_line for proof_line in tactic_block.strip().splitlines()]
            lines[index : index + 1] = proof_lines
            TARGETS_LEAN.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return

    raise ValueError(f"No open `sorry` found for theorem {target_id} in {TARGETS_LEAN}")


def strip_llm_answer(raw: str) -> str:
    """LLMs love markdown fences and `by` prefixes; keep only tactic lines."""
    text = raw.strip()
    fence = CODE_FENCE_RE.search(text)
    if fence:
        text = fence.group(1).strip()
    if text.startswith("by\n"):
        text = text[3:]
    elif text.startswith("by "):
        text = text[3:]
    return text.strip()


def draft_with_llm(statement: str, lemmas: list[dict], failures: list[tuple[str, list[str]]], tier: str = "smart"):
    from app.engine.llm import get_llm, text_of

    # heat up across retries so the model stops re-proposing the same tactic
    # (Groq only — the Claude path relies on the failure feedback below)
    llm = get_llm(temperature=min(0.3 * len(failures), 0.9), tier=tier)

    lemma_lines = "\n".join(f"- {lemma['name']}: {lemma['statement']}" for lemma in lemmas) or "(none)"
    failure_lines = ""
    for attempt, errors in failures:
        failure_lines += f"\nFAILED ATTEMPT (do NOT repeat this):\n{attempt}\nLEAN ERRORS:\n" + "\n".join(errors) + "\n"

    prompt = f"""You are a Lean 4 proof assistant working in a Mathlib project.

Complete this theorem. Everything after `by` is yours to write:

{statement}

Possibly relevant Mathlib lemmas:
{lemma_lines}
{failure_lines}
Rules:
- Respond with ONLY the tactic block that goes after `by`. No markdown, no explanation, no `by` keyword.
- This is Lean 4 + current Mathlib syntax (e.g. `simp`, `ext x`, `exact`, `omega`), not Lean 3.
- `rw` needs an exact syntactic match. If the goal is stated with unfolded names
  (e.g. `Set.inter A B` instead of `A ∩ B`), prefer `exact <lemma> ...` or
  `simp [<lemma>]`, which work up to definitional equality.
- Never repeat a failed attempt verbatim. If an attempt failed, try a genuinely
  different tactic or lemma.
- Never use `sorry` or `admit`.
"""
    response = llm.invoke(prompt)
    return strip_llm_answer(text_of(response))


def prove_statement(
    statement: str,
    lemmas: list[dict],
    on_event=None,
    label: str = "statement",
    candidates: list[str] | None = None,
    max_llm_attempts: int = MAX_LLM_ATTEMPTS,
    try_sketch: bool = True,
    preamble: str = "",
    llm_tier: str = "smart",
) -> tuple[str, LeanResult] | None:
    """Try to close one Lean statement: cheap deterministic tactics first,
    then LLM drafts with failure feedback, then sketch-then-prove
    decomposition for the hard cases. Returns (tactic_block, result) when
    Lean accepts a proof, None when every attempt is rejected."""
    for candidate in candidates if candidates is not None else DETERMINISTIC_CANDIDATES:
        print(f"  trying candidate: {candidate!r} ... ", end="", flush=True)
        _emit(on_event, "checking", target=label, source="candidate", tactic=candidate)
        result = check_proof(statement, candidate, preamble=preamble)
        print("ACCEPTED" if result.accepted else "rejected")
        _emit(on_event, "checked", target=label, source="candidate", tactic=candidate, accepted=result.accepted)
        if result.accepted:
            return candidate, result

    # Library search: a large share of coursework statements are Mathlib
    # lemmas one step away, and `exact?` finds them without any LLM call.
    print("  trying library search: 'exact?' ... ", end="", flush=True)
    _emit(on_event, "checking", target=label, source="library_search", tactic="exact?")
    found = try_library_search(statement, preamble=preamble)
    print(f"ACCEPTED ({found[0]!r})" if found else "rejected")
    _emit(on_event, "checked", target=label, source="library_search",
          tactic=found[0] if found else "exact?", accepted=bool(found))
    if found:
        return found

    failures: list[tuple[str, list[str]]] = []
    for attempt_number in range(1, max_llm_attempts + 1):
        tactic_block = draft_with_llm(statement, lemmas, failures, tier=llm_tier)
        print(f"  LLM attempt {attempt_number}: {tactic_block!r} ... ", end="", flush=True)
        _emit(on_event, "checking", target=label, source=f"llm attempt {attempt_number}", tactic=tactic_block)
        result = check_proof(statement, tactic_block, preamble=preamble)
        print("ACCEPTED" if result.accepted else "rejected")
        _emit(
            on_event, "checked",
            target=label, source=f"llm attempt {attempt_number}",
            tactic=tactic_block, accepted=result.accepted,
            errors=result.errors[:2] if not result.accepted else [],
        )
        if result.accepted:
            return tactic_block, result
        failures.append((tactic_block, result.errors[:3]))

    if try_sketch:
        from app.engine.sketcher import sketch_and_prove

        print("  flat attempts exhausted — trying sketch-then-prove decomposition")
        _emit(on_event, "sketch_started", target=label)
        return sketch_and_prove(statement, lemmas, on_event=on_event, label=label, preamble=preamble)

    return None


def prove_target(target: dict, on_event=None) -> tuple[str, LeanResult] | None:
    """Try to close one target. Returns (tactic_block, result) on success."""
    print(f"\n=== {target['id']} ===")
    _emit(on_event, "target_started", target=target["id"])

    query = " ".join([target["statement"]] + target.get("tags", []))
    lemmas = search_mathlib(query, k=RETRIEVAL_K)
    print(f"  retrieved {len(lemmas)} lemmas for LLM drafting")
    _emit(on_event, "retrieved", target=target["id"], lemmas=[lemma["name"] for lemma in lemmas])

    return prove_statement(target["statement"], lemmas, on_event=on_event, label=target["id"])


def run(target_id: str | None = None, on_event=None) -> int:
    targets = load_targets()
    pending = [
        target
        for target in targets
        if target["status"] == "unproved" and (target_id is None or target["id"] == target_id)
    ]
    if not pending:
        print("No unproved targets match.")
        return 0

    solved = 0
    for target in sorted(pending, key=lambda t: t.get("difficulty", 0)):
        outcome = prove_target(target, on_event=on_event)
        if outcome is None:
            print(f"  {target['id']}: all attempts rejected by Lean")
            _emit(on_event, "target_failed", target=target["id"])
            continue

        tactic_block, _ = outcome
        write_proof_into_targets_lean(target["id"], tactic_block)
        target["status"] = "proved"
        target["proof"] = tactic_block
        save_targets(targets)
        solved += 1
        print(f"  {target['id']}: PROVED with {tactic_block!r}")
        _emit(on_event, "target_proved", target=target["id"], proof=tactic_block)

    print(f"\n{solved}/{len(pending)} targets proved this run")
    _emit(on_event, "run_finished", solved=solved, attempted=len(pending))
    return solved


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Axlerate proof loop")
    parser.add_argument("--target", help="only attempt this target id", default=None)
    args = parser.parse_args()

    if not os.getenv("GROQ_API_KEY"):
        print("Warning: GROQ_API_KEY not set — only deterministic candidates will run")

    run(args.target)
