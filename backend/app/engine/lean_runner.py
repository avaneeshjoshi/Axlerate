"""Lean Runner: the oracle of the proof loop.

Writes a candidate proof into a scratch Lean file inside proof_lab and asks
the Lean compiler to check it. Nothing is "accepted" unless Lean accepts it.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PROOF_LAB = REPO_ROOT / "proof_lab"
SCRATCH_DIR = PROOF_LAB / ".axlerate_scratch"
SCRATCH_FILE = SCRATCH_DIR / "Attempt.lean"
STATEMENT_FILE = SCRATCH_DIR / "Statement.lean"

# lake/lean live in ~/.elan/bin on macOS/Linux; on Windows elan puts them in
# %USERPROFILE%\.elan\bin, which Path.home() also resolves to.
ELAN_BIN = Path.home() / ".elan" / "bin"

# Lean exits 0 on `sorry` (it's only a warning), so a plain exit-code check
# is not enough. These must never appear in a candidate proof.
FORBIDDEN_TOKENS = ("sorry", "admit", "axiom ", "native_decide")

CHECK_TIMEOUT_SECONDS = 300

ERROR_LINE_RE = re.compile(
    r"^(?P<file>.+?\.lean):(?P<line>\d+):(?P<col>\d+):\s*(?P<severity>error|warning):\s*(?P<message>.*)$"
)


@dataclass
class LeanResult:
    accepted: bool
    exit_code: int
    errors: list[str] = field(default_factory=list)
    raw_output: str = ""


def _lean_env() -> dict:
    env = os.environ.copy()
    env["PATH"] = f"{ELAN_BIN}{os.pathsep}" + env.get("PATH", "")
    return env


def _parse_messages(output: str, include_sorry_warnings: bool = True) -> list[str]:
    """Collect error (and sorry-warning) messages, each with its full
    multi-line body — the goal state Lean prints after an error line is
    exactly what the agent needs for the retry prompt."""
    messages: list[str] = []
    current: list[str] | None = None

    for line in output.splitlines():
        match = ERROR_LINE_RE.match(line)
        if match:
            if current:
                messages.append("\n".join(current))
            severity = match.group("severity")
            is_sorry_warning = include_sorry_warnings and "sorry" in match.group("message")
            if severity == "error" or is_sorry_warning:
                current = [f"{match.group('line')}:{match.group('col')}: {match.group('message')}"]
            else:
                current = None
        elif current is not None:
            current.append(line)

    if current:
        messages.append("\n".join(current))
    return messages


def build_attempt_source(
    statement: str,
    tactic_block: str,
    include_import: bool = True,
    preamble: str = "",
) -> str:
    """Assemble a standalone Lean file for one proof attempt.

    `statement` is the full theorem header ending in `:= by` (as stored in
    targets.json); `tactic_block` is what the agent proposes after the `by`.
    `preamble` holds already-verified helper theorems (proof-project
    dependency nodes) placed before the target so it can use them by name.
    The warm REPL path skips the import — its environment already has Mathlib.
    """
    indented = "\n".join(
        f"  {line}" if line.strip() else line
        for line in tactic_block.strip().splitlines()
    )
    header = "import Mathlib\n\n" if include_import else ""
    preamble_block = f"{preamble.strip()}\n\n" if preamble.strip() else ""
    return (
        f"{header}"
        "namespace ProofLab\n\n"
        f"{preamble_block}"
        f"{statement.strip()}\n{indented}\n\n"
        "end ProofLab\n"
    )


def _try_repl(
    statement: str, tactic_block: str, include_sorry_warnings: bool, preamble: str = ""
) -> LeanResult | None:
    """Check via the warm REPL worker. Returns None when the worker is
    unavailable or fails — callers then fall back to a cold lake run."""
    from app.engine.lean_repl import LeanRepl

    repl = LeanRepl.get()
    if not repl.available():
        return None

    source = build_attempt_source(statement, tactic_block, include_import=False, preamble=preamble)
    try:
        response = repl.check(source)
    except Exception as exc:
        print(f"  warm REPL check failed ({exc}); falling back to cold lake run")
        return None

    errors = [
        f"{message['pos']['line']}:{message['pos']['column']}: {message.get('data', '')}"
        for message in response.get("messages", [])
        if message.get("severity") == "error"
    ]
    if include_sorry_warnings:
        for entry in response.get("sorries", []):
            pos = entry.get("pos", {})
            errors.append(f"{pos.get('line', '?')}:{pos.get('column', '?')}: declaration uses 'sorry'")

    return LeanResult(
        accepted=not errors,
        exit_code=0 if not errors else 1,
        errors=errors,
        raw_output=json.dumps(response),
    )


def _invoke_lean(scratch_file: Path, source: str):
    """Write `source` to `scratch_file` and compile it. Returns a LeanResult
    on environment failures (timeout, missing lake), else (exit_code, output)."""
    SCRATCH_DIR.mkdir(exist_ok=True)
    scratch_file.write_text(source, encoding="utf-8")

    try:
        completed = subprocess.run(
            ["lake", "env", "lean", str(scratch_file.relative_to(PROOF_LAB))],
            cwd=PROOF_LAB,
            env=_lean_env(),
            capture_output=True,
            text=True,
            timeout=CHECK_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return LeanResult(
            accepted=False,
            exit_code=-1,
            errors=[f"Lean timed out after {CHECK_TIMEOUT_SECONDS}s"],
        )
    except FileNotFoundError:
        return LeanResult(
            accepted=False,
            exit_code=-1,
            errors=["`lake` not found — install elan and run `lake build` in proof_lab first"],
        )

    return completed.returncode, (completed.stdout or "") + (completed.stderr or "")


def check_proof(statement: str, tactic_block: str, preamble: str = "") -> LeanResult:
    """Verify one candidate proof with the Lean compiler."""
    lowered = tactic_block.lower()
    for token in FORBIDDEN_TOKENS:
        if token in lowered:
            return LeanResult(
                accepted=False,
                exit_code=-1,
                errors=[f"forbidden token in candidate proof: {token.strip()}"],
            )

    repl_result = _try_repl(statement, tactic_block, include_sorry_warnings=True, preamble=preamble)
    if repl_result is not None:
        return repl_result

    outcome = _invoke_lean(SCRATCH_FILE, build_attempt_source(statement, tactic_block, preamble=preamble))
    if isinstance(outcome, LeanResult):
        return outcome

    exit_code, output = outcome
    messages = _parse_messages(output)
    # accepted = clean compile AND no errors or sorry-warnings in the output
    accepted = exit_code == 0 and not messages
    return LeanResult(accepted=accepted, exit_code=exit_code, errors=messages, raw_output=output)


def check_statement(statement: str, preamble: str = "") -> LeanResult:
    """Check that a theorem statement at least elaborates, using a `sorry` body.

    Guards the autoformalizer: a statement the compiler can't even parse or
    type-check must never reach the proof loop. The sorry warning is expected
    here — only genuine errors reject the statement."""
    repl_result = _try_repl(statement, "sorry", include_sorry_warnings=False, preamble=preamble)
    if repl_result is not None:
        return repl_result

    outcome = _invoke_lean(STATEMENT_FILE, build_attempt_source(statement, "sorry", preamble=preamble))
    if isinstance(outcome, LeanResult):
        return outcome

    exit_code, output = outcome
    errors = _parse_messages(output, include_sorry_warnings=False)
    accepted = exit_code == 0 and not errors
    return LeanResult(accepted=accepted, exit_code=exit_code, errors=errors, raw_output=output)


if __name__ == "__main__":
    result = check_proof("theorem scratch_check (n : Nat) : n + 0 = n := by", "rfl")
    print(f"accepted={result.accepted} exit={result.exit_code}")
    for err in result.errors:
        print(err)
