from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MATHLIB_ROOT = REPO_ROOT / "proof_lab" / ".lake" / "packages" / "mathlib" / "Mathlib"
OUTPUT_PATH = REPO_ROOT / "axlerate_db" / "mathlib_index_preview.json"

# Start tiny. Add more folders as the proof loop gets smarter.
SLICE_DIRS = [
    MATHLIB_ROOT / "Data" / "Nat",
    MATHLIB_ROOT / "Data" / "Set",
]

DECL_RE = re.compile(
    r"^\s*(?:@\[[^\]]+\]\s*)*"
    r"(?:(?:private|protected|nonrec|unsafe|partial)\s+)*"
    r"(theorem|lemma|def|abbrev|instance|class|structure)\s+([A-Za-z0-9_'.]+)"
)
ATTR_RE = re.compile(r"^\s*@\[(.*?)\]")
NAMESPACE_RE = re.compile(r"^\s*namespace\s+([A-Za-z0-9_'.]+)\s*$")
SECTION_RE = re.compile(r"^\s*section(?:\s+([A-Za-z0-9_'.]+))?\s*$")
END_RE = re.compile(r"^\s*end(?:\s+[A-Za-z0-9_'.]+)?\s*$")
TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_'.]*|[∀∃λ↦→←↔≤≥≠∈⊆∩∪⊓⊔+\-*/=<>]+")

KEYWORDS = {
    "by",
    "where",
    "if",
    "then",
    "else",
    "let",
    "have",
    "show",
    "fun",
    "match",
    "with",
    "theorem",
    "lemma",
    "def",
    "abbrev",
    "instance",
    "class",
    "structure",
}

MAX_DECL_LINES = 40
MAX_PROOF_PREVIEW_CHARS = 500


def module_name_for(path: Path) -> str:
    relative = path.relative_to(MATHLIB_ROOT).with_suffix("")
    return "Mathlib." + ".".join(relative.parts)


def normalize_text(text: str) -> str:
    return " ".join(text.split())


def clean_comment(raw: str) -> str:
    text = raw
    for marker in ("/-!", "/--", "/-", "-/"):
        text = text.replace(marker, " ")

    cleaned_lines = []
    for line in text.splitlines():
        line = line.strip()
        line = re.sub(r"^[-!*#\s]+", "", line).strip()
        if line:
            cleaned_lines.append(line)

    return normalize_text(" ".join(cleaned_lines))


def read_comment(lines: list[str], start_index: int) -> tuple[str, int]:
    parts = [lines[start_index]]
    index = start_index

    while "-/" not in lines[index] and index + 1 < len(lines):
        index += 1
        parts.append(lines[index])

    return clean_comment("\n".join(parts)), index


def name_from_namespace(namespace_stack: list[str], local_name: str) -> str:
    if "." in local_name:
        return local_name
    if not namespace_stack:
        return local_name
    return ".".join(namespace_stack + [local_name])


def extract_symbols(text: str) -> list[str]:
    symbols: list[str] = []
    seen = set()

    for token in TOKEN_RE.findall(text):
        if token in KEYWORDS or len(token) == 1 and token.islower():
            continue
        if token not in seen:
            symbols.append(token)
            seen.add(token)
        if len(symbols) >= 40:
            break

    return symbols


def collect_declaration_block(lines: list[str], start_index: int) -> tuple[list[str], int]:
    block: list[str] = []
    saw_assignment = False
    index = start_index

    while index < len(lines) and len(block) < MAX_DECL_LINES:
        line = lines[index]

        if index > start_index:
            stripped = line.strip()
            if DECL_RE.match(line) or NAMESPACE_RE.match(line) or SECTION_RE.match(line) or END_RE.match(line):
                break
            if stripped.startswith("/-!") or stripped.startswith("/--"):
                break
            if not stripped and saw_assignment:
                break

        block.append(line.rstrip())

        if ":=" in line or " where" in line:
            saw_assignment = True

        index += 1

    return block, index - 1


def split_statement_and_proof(block_text: str) -> tuple[str, str]:
    if ":=" not in block_text:
        return normalize_text(block_text), ""

    statement, proof = block_text.split(":=", 1)
    return (
        normalize_text(statement + " :="),
        normalize_text(proof)[:MAX_PROOF_PREVIEW_CHARS],
    )


def extract_declarations(path: Path) -> list[dict]:
    records = []
    module_name = module_name_for(path)
    block_stack: list[tuple[str, str]] = []
    latest_topic_comment = ""
    pending_doc_comment = ""
    pending_attributes: list[str] = []

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()

    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if stripped.startswith("/-!") or stripped.startswith("/--"):
            comment_text, end_index = read_comment(lines, index)
            if stripped.startswith("/-!"):
                latest_topic_comment = comment_text
            else:
                pending_doc_comment = comment_text
            index = end_index + 1
            continue

        namespace_match = NAMESPACE_RE.match(line)
        if namespace_match:
            block_stack.append(("namespace", namespace_match.group(1)))
            index += 1
            continue

        section_match = SECTION_RE.match(line)
        if section_match:
            block_stack.append(("section", section_match.group(1) or ""))
            index += 1
            continue

        if END_RE.match(line):
            if block_stack:
                block_stack.pop()
            index += 1
            continue

        attr_match = ATTR_RE.match(line)
        if attr_match and not DECL_RE.match(line):
            pending_attributes.append(attr_match.group(1))
            index += 1
            continue

        decl_match = DECL_RE.match(line)
        if not decl_match:
            if stripped and not stripped.startswith("--"):
                pending_doc_comment = ""
                pending_attributes = []
            index += 1
            continue

        kind, local_name = decl_match.groups()
        namespace_stack = [name for block_type, name in block_stack if block_type == "namespace"]
        name_guess = name_from_namespace(namespace_stack, local_name)
        block, end_index = collect_declaration_block(lines, index)
        block_text = "\n".join(block)
        statement, proof_preview = split_statement_and_proof(block_text)
        symbols = extract_symbols(" ".join([statement, proof_preview]))

        records.append(
            {
                "name_guess": name_guess,
                "local_name": local_name,
                "namespace_guess": ".".join(namespace_stack),
                "kind": kind,
                "module": module_name,
                "source": "mathlib",
                "source_file": str(path.relative_to(REPO_ROOT)),
                "line_start": index + 1,
                "line_end": end_index + 1,
                "attributes": pending_attributes,
                "topic_comment": latest_topic_comment,
                "doc_comment": pending_doc_comment,
                "statement": statement,
                "proof_preview": proof_preview,
                "symbols": symbols,
                "declaration_block": block_text,
                "search_text": normalize_text(
                    " ".join(
                        [
                            latest_topic_comment,
                            pending_doc_comment,
                            kind,
                            name_guess,
                            statement,
                            proof_preview,
                            " ".join(symbols),
                            " ".join(pending_attributes),
                        ]
                    )
                ),
            }
        )

        pending_doc_comment = ""
        pending_attributes = []
        index = end_index + 1

    return records


def main() -> None:
    if not MATHLIB_ROOT.exists():
        raise FileNotFoundError(f"Mathlib not found at {MATHLIB_ROOT}")

    all_records = []

    for slice_dir in SLICE_DIRS:
        if not slice_dir.exists():
            print(f"Skipping missing slice: {slice_dir}")
            continue

        for lean_file in slice_dir.rglob("*.lean"):
            all_records.extend(extract_declarations(lean_file))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(all_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Indexed {len(all_records)} declarations")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
