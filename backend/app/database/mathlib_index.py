"""Loads the raw Mathlib declaration index produced by scripts/index_mathlib.py
and offers a cheap lexical search — the fallback when the vector store hasn't
been built yet.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
INDEX_PATH = REPO_ROOT / "axlerate_db" / "mathlib_index_preview.json"

TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_'.]*")


@lru_cache(maxsize=1)
def load_index() -> list[dict]:
    if not INDEX_PATH.exists():
        return []
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def _tokens(text: str) -> set[str]:
    return {token.lower() for token in TOKEN_RE.findall(text)}


def lexical_search(query: str, k: int = 5) -> list[dict]:
    """Rank declarations by token overlap between the query and search_text."""
    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    scored = []
    for record in load_index():
        record_tokens = _tokens(record.get("search_text", ""))
        overlap = len(query_tokens & record_tokens)
        if overlap:
            # small boost when the declaration name itself matches
            name_tokens = _tokens(record.get("name_guess", ""))
            overlap += 2 * len(query_tokens & name_tokens)
            scored.append((overlap, record))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [record for _, record in scored[:k]]
