"""Single place that decides which LLM backs the pipeline.

Claude Sonnet (claude-sonnet-5) when ANTHROPIC_API_KEY is set — much stronger
at Lean 4 formalization and proof drafting — otherwise the existing Groq
llama fallback. Everything upgrades itself the moment the key lands in .env.
"""
from __future__ import annotations

import os

CLAUDE_SMART_MODEL = "claude-sonnet-5"   # $3/$15 per MTok — formalization, sketching, hard drafts
CLAUDE_FAST_MODEL = "claude-haiku-4-5"   # $1/$5 per MTok — judging, first-attempt hole closing
GROQ_MODEL = "llama-3.3-70b-versatile"


def using_claude() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def get_llm(temperature: float = 0.0, tier: str = "smart"):
    """Return a LangChain chat model.

    `tier="fast"` picks Haiku (3x cheaper) for calls where capability matters
    less. `temperature` only applies to the Groq fallback — claude-sonnet-5
    rejects non-default sampling parameters, so retry diversity there comes
    from failure feedback in the prompt instead."""
    if using_claude():
        from langchain_anthropic import ChatAnthropic

        model = CLAUDE_FAST_MODEL if tier == "fast" else CLAUDE_SMART_MODEL
        return ChatAnthropic(model=model, max_tokens=4096)

    from langchain_groq import ChatGroq

    return ChatGroq(model=GROQ_MODEL, temperature=temperature)


def text_of(message) -> str:
    """Normalize a chat response to plain text. Claude with adaptive thinking
    returns `content` as a list of blocks (thinking + text); Groq returns a
    plain string. Callers should never touch `.content` directly."""
    content = message.content
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts)
