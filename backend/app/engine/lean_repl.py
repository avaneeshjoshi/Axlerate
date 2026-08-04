"""Warm Lean REPL worker.

Cold `lake env lean` runs pay the full `import Mathlib` elaboration cost
(30-60s) on every single check. This module keeps one REPL process alive
(leanprover-community/repl, built in vendor/repl), imports Mathlib exactly
once at startup, and then checks each candidate proof against that warm
environment via `env: 0` — a verdict in seconds with all of Mathlib loaded.

Protocol: JSON commands on stdin terminated by a blank line; JSON responses
on stdout terminated by a blank line.
"""
from __future__ import annotations

import json
import os
import queue
import subprocess
import threading
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PROOF_LAB = REPO_ROOT / "proof_lab"
REPL_BINARY = REPO_ROOT / "vendor" / "repl" / ".lake" / "build" / "bin" / "repl"

ELAN_BIN = Path.home() / ".elan" / "bin"

IMPORT_TIMEOUT_SECONDS = 600
COMMAND_TIMEOUT_SECONDS = 120


class ReplUnavailable(RuntimeError):
    """The REPL binary is missing or the worker process is unusable."""


def _lean_env() -> dict:
    env = os.environ.copy()
    env["PATH"] = f"{ELAN_BIN}{os.pathsep}" + env.get("PATH", "")
    return env


class LeanRepl:
    """A single persistent REPL worker; all checks serialize through it."""

    _instance: "LeanRepl | None" = None
    _instance_lock = threading.Lock()

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._proc: subprocess.Popen | None = None
        self._env_id: int | None = None
        self._responses: "queue.Queue[str | None]" = queue.Queue()

    @classmethod
    def get(cls) -> "LeanRepl":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @staticmethod
    def available() -> bool:
        return REPL_BINARY.exists()

    @property
    def warm(self) -> bool:
        return (
            self._proc is not None
            and self._proc.poll() is None
            and self._env_id is not None
        )

    def ensure_started(self) -> None:
        with self._lock:
            if self.warm:
                return
            self._start()

    def check(self, source: str, timeout: float = COMMAND_TIMEOUT_SECONDS) -> dict:
        """Check `source` (no imports!) against the warm Mathlib environment.

        Returns the parsed REPL response ({"messages": [...], "sorries": [...],
        "env": n}). Raises ReplUnavailable/TimeoutError on worker trouble; the
        caller falls back to a cold `lake` run for that check.
        """
        with self._lock:
            self.ensure_started()
            return self._send({"cmd": source, "env": self._env_id}, timeout=timeout)

    def run_tactic(self, proof_state: int, tactic: str, timeout: float = COMMAND_TIMEOUT_SECONDS) -> dict:
        """Apply a tactic to a proof state from a previous check's `sorries`.

        The sketch-then-prove loop uses this to test hole closures in
        isolation: a hole is closed when the response has no errors and an
        empty `goals` list. Proof-state ids are only valid for the lifetime
        of this worker process.
        """
        with self._lock:
            self.ensure_started()
            return self._send({"tactic": tactic, "proofState": proof_state}, timeout=timeout)

    def _start(self) -> None:
        if not self.available():
            raise ReplUnavailable(
                f"REPL binary not found at {REPL_BINARY} — "
                "run `lake build` in vendor/repl first"
            )
        self._stop()
        print("Starting Lean REPL worker (importing Mathlib once, ~30-60s)...")
        started = time.monotonic()
        self._proc = subprocess.Popen(
            ["lake", "env", str(REPL_BINARY)],
            cwd=PROOF_LAB,
            env=_lean_env(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        # A blocking readline in a thread sidesteps select-vs-buffering bugs:
        # the thread assembles blank-line-terminated responses onto a queue.
        self._responses = queue.Queue()
        threading.Thread(
            target=self._read_responses,
            args=(self._proc, self._responses),
            daemon=True,
        ).start()
        try:
            response = self._send({"cmd": "import Mathlib"}, timeout=IMPORT_TIMEOUT_SECONDS)
        except Exception:
            self._stop()
            raise
        env_id = response.get("env")
        if env_id is None:
            self._stop()
            raise ReplUnavailable(f"import Mathlib failed: {json.dumps(response)[:500]}")
        self._env_id = env_id
        print(f"Lean REPL warm in {time.monotonic() - started:.0f}s (env {env_id})")

    def _stop(self) -> None:
        self._env_id = None
        if self._proc is not None:
            self._proc.kill()
            self._proc.wait()
            self._proc = None

    @staticmethod
    def _read_responses(proc: subprocess.Popen, responses: "queue.Queue[str | None]") -> None:
        """Reader thread: accumulate stdout lines into blank-line-terminated
        responses. Pushes None on EOF so waiters see the death promptly."""
        lines: list[str] = []
        for line in proc.stdout:
            if line.strip() == "":
                if lines:
                    responses.put("".join(lines))
                    lines = []
                continue
            lines.append(line)
        if lines:
            responses.put("".join(lines))
        responses.put(None)

    def _send(self, payload: dict, timeout: float) -> dict:
        proc = self._proc
        if proc is None or proc.poll() is not None:
            raise ReplUnavailable("REPL process is not running")

        proc.stdin.write(json.dumps(payload) + "\n\n")
        proc.stdin.flush()

        try:
            raw = self._responses.get(timeout=timeout)
        except queue.Empty:
            # a hung tactic would poison every later check — kill the worker;
            # the next call re-warms it
            self._stop()
            raise TimeoutError(f"REPL command timed out after {timeout}s")

        if raw is None:
            self._stop()
            raise ReplUnavailable("REPL process died mid-command")

        return json.loads(raw)
