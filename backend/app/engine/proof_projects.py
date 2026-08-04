"""Proof Projects: the graph-based proof workspace behind the ProofLab tab.

A project is a graph of claim nodes. Each node holds an English statement,
optionally a formalized Lean statement (`theorem node_<id> ... := by`), and
— once the compiler accepts a proof — a verified tactic block. Edges mean
"target depends on source": when proving a node, every PROVED dependency is
included as a real Lean theorem in the attempt file, so composition is
checked by the compiler, not assumed.

AI assists per node:
- formalize: English -> Lean statement (compiler-validated)
- prove: the full escalation ladder (tactics -> exact? -> Sonnet -> sketch)
  with dependency theorems in scope
- decompose: Sonnet proposes standalone sub-lemmas, which become linked nodes

Storage is a JSON file; one proving job runs at a time.
"""
from __future__ import annotations

import json
import re
import threading
import uuid
from pathlib import Path

from app.database.mathlib_store import search_mathlib
from app.engine.formalizer import formalize_question
from app.engine.lean_runner import check_statement
from app.engine.llm import get_llm, text_of
from app.engine.proof_agent import prove_statement

REPO_ROOT = Path(__file__).resolve().parents[3]
PROJECTS_PATH = REPO_ROOT / "proof_lab" / "projects.json"

_lock = threading.Lock()
# proofs run in parallel, but only one job per node at a time
_active_lock = threading.Lock()
_active_prove_nodes: set[str] = set()

NODE_STATUSES = ("idea", "formalized", "proving", "proved", "failed")


# ---------- storage ----------

def _load_all() -> list[dict]:
    if not PROJECTS_PATH.exists():
        return []
    return json.loads(PROJECTS_PATH.read_text(encoding="utf-8"))


def _save_all(projects: list[dict]) -> None:
    PROJECTS_PATH.write_text(json.dumps(projects, indent=2) + "\n", encoding="utf-8")


def list_projects() -> list[dict]:
    with _lock:
        return [
            {"id": p["id"], "name": p["name"], "nodes": len(p["nodes"]), "edges": len(p["edges"])}
            for p in _load_all()
        ]


def create_project(name: str) -> dict:
    project = {"id": uuid.uuid4().hex[:8], "name": name, "nodes": [], "edges": []}
    with _lock:
        projects = _load_all()
        projects.append(project)
        _save_all(projects)
    return project


def get_project(project_id: str) -> dict | None:
    with _lock:
        for p in _load_all():
            if p["id"] == project_id:
                return p
    return None


def delete_project(project_id: str) -> bool:
    with _lock:
        projects = _load_all()
        remaining = [p for p in projects if p["id"] != project_id]
        if len(remaining) == len(projects):
            return False
        _save_all(remaining)
    return True


def _update_project(project_id: str, mutate) -> dict | None:
    """Apply `mutate(project)` under the lock; returns the updated project."""
    with _lock:
        projects = _load_all()
        for p in projects:
            if p["id"] == project_id:
                mutate(p)
                _save_all(projects)
                return p
    return None


def _find_node(project: dict, node_id: str) -> dict | None:
    return next((n for n in project["nodes"] if n["id"] == node_id), None)


# ---------- nodes & edges ----------

def add_node(project_id: str, statement_en: str, x: float = 0, y: float = 0, kind: str = "conjecture") -> dict | None:
    node = {
        "id": uuid.uuid4().hex[:8],
        "statement_en": statement_en,
        "lean_statement": "",
        "lean_proof": "",
        "status": "idea",
        "error": "",
        "model": "sonnet",
        "kind": kind,
        "intuition": "",
        "facts_used": [],
        "x": x,
        "y": y,
        "w": 260,
        "h": 0,
    }
    project = _update_project(project_id, lambda p: p["nodes"].append(node))
    return node if project else None


def update_node(project_id: str, node_id: str, fields: dict) -> dict | None:
    allowed = {"statement_en", "lean_statement", "x", "y", "model", "w", "h", "kind", "intuition"}
    updated: dict = {}

    def mutate(p):
        node = _find_node(p, node_id)
        if node is None:
            return
        for key, value in fields.items():
            if key in allowed:
                node[key] = value
        # editing the claim invalidates any previous formalization/proof —
        # and stales every dependent, so their badges stay honest
        if "statement_en" in fields:
            node.update({"lean_statement": "", "lean_proof": "", "status": "idea", "error": ""})
            _mark_stale(p, node_id)
        if "lean_statement" in fields and fields["lean_statement"]:
            node.update({"lean_proof": "", "status": "formalized", "error": ""})
            _mark_stale(p, node_id)
        updated.update(node)

    project = _update_project(project_id, mutate)
    return updated if project and updated else None


def delete_node(project_id: str, node_id: str) -> bool:
    def mutate(p):
        _mark_stale(p, node_id)  # dependents lose a lemma they may have used
        p["nodes"] = [n for n in p["nodes"] if n["id"] != node_id]
        p["edges"] = [e for e in p["edges"] if node_id not in (e["source"], e["target"])]

    return _update_project(project_id, mutate) is not None


def add_edge(project_id: str, source: str, target: str, kind: str = "uses") -> bool:
    """kind="uses": `target` depends on `source` as a lemma. kind="converse":
    the two statements are converses — an annotation only, never a proof
    dependency (a converse is not implied by its original)."""
    if source == target:
        return False

    def mutate(p):
        if _find_node(p, source) and _find_node(p, target):
            if not any(e["source"] == source and e["target"] == target for e in p["edges"]):
                p["edges"].append({"source": source, "target": target, "kind": kind})

    return _update_project(project_id, mutate) is not None


def delete_edge(project_id: str, source: str, target: str) -> bool:
    def mutate(p):
        was_dep = any(
            e["source"] == source and e["target"] == target and e.get("kind", "uses") != "converse"
            for e in p["edges"]
        )
        p["edges"] = [e for e in p["edges"] if not (e["source"] == source and e["target"] == target)]
        if was_dep:
            _mark_stale(p, target, include_self=True)

    return _update_project(project_id, mutate) is not None


def _descendants(project: dict, node_id: str) -> set[str]:
    """All nodes that transitively depend on `node_id` (uses-edges only)."""
    result: set[str] = set()
    stack = [node_id]
    while stack:
        current = stack.pop()
        for edge in project["edges"]:
            if edge["source"] == current and edge.get("kind", "uses") != "converse":
                target = edge["target"]
                if target not in result:
                    result.add(target)
                    stack.append(target)
    return result


def _mark_stale(p: dict, node_id: str, include_self: bool = False) -> None:
    """A dependency changed: demote proved dependents so green badges never
    lie. Their lean_proof is kept so re-verify can re-check it cheaply."""
    stale_ids = _descendants(p, node_id)
    if include_self:
        stale_ids.add(node_id)
    for nid in stale_ids:
        n = _find_node(p, nid)
        if n and n["status"] == "proved":
            n["status"] = "formalized" if n["lean_statement"] else "idea"
            n["error"] = "a dependency changed — re-verify"


def _topo_order(project: dict) -> list[str]:
    """Dependency order: sources (lemmas) before targets (their users)."""
    from collections import deque

    indegree = {n["id"]: 0 for n in project["nodes"]}
    for e in project["edges"]:
        if e.get("kind", "uses") != "converse" and e["source"] in indegree and e["target"] in indegree:
            indegree[e["target"]] += 1

    queue = deque(nid for nid, d in indegree.items() if d == 0)
    order: list[str] = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for e in project["edges"]:
            if e.get("kind", "uses") != "converse" and e["source"] == nid and e["target"] in indegree:
                indegree[e["target"]] -= 1
                if indegree[e["target"]] == 0:
                    queue.append(e["target"])
    ordered = set(order)
    order += [nid for nid in indegree if nid not in ordered]  # cycles, defensively
    return order


# ---------- dependency assembly ----------

def _dependency_nodes(project: dict, node_id: str) -> list[dict]:
    """Proved nodes this node depends on (direct dependencies only —
    transitive deps are pulled in recursively so their proofs compile too)."""
    collected: dict[str, dict] = {}

    def visit(nid: str) -> None:
        for edge in project["edges"]:
            if edge["target"] == nid and edge.get("kind", "uses") != "converse":
                dep = _find_node(project, edge["source"])
                if dep is None or dep["id"] in collected:
                    continue
                is_axiom = dep.get("kind") == "axiom" and dep["lean_statement"]
                if dep["status"] == "proved" or is_axiom:
                    visit(dep["id"])          # deps of the dep come first
                    collected[dep["id"]] = dep

    visit(node_id)
    return list(collected.values())


def _preamble_for(deps: list[dict]) -> str:
    blocks = []
    for dep in deps:
        if dep.get("kind") == "axiom" and dep["status"] != "proved":
            # accepted without proof: emit a genuine axiom declaration
            decl = re.sub(r":=\s*by\s*$", "", dep["lean_statement"]).strip()
            decl = re.sub(r"^theorem\b", "axiom", decl)
            blocks.append(decl)
        else:
            proof_lines = "\n".join(f"  {line}" for line in dep["lean_proof"].splitlines())
            blocks.append(f"{dep['lean_statement']}\n{proof_lines}")
    return "\n\n".join(blocks)


def _dep_lemmas(deps: list[dict]) -> list[dict]:
    return [
        {"name": f"node_{dep['id']} (your own proved lemma — usable by name)",
         "statement": dep["lean_statement"]}
        for dep in deps
    ]


MATHLIB_NAME_RE = re.compile(r"\b[A-Z][A-Za-z0-9_']*(?:\.[A-Za-z0-9_']+)+\b")
NODE_REF_RE = re.compile(r"\bnode_[0-9a-f]{8}\b")


def _extract_facts(tactic_block: str) -> tuple[list[str], set[str]]:
    """Pull (Mathlib lemma names, referenced node theorem names) out of a
    verified tactic block. Names come from the compiler-accepted proof, so
    these labels are true, not guessed."""
    mathlib = sorted(set(MATHLIB_NAME_RE.findall(tactic_block)))
    node_refs = set(NODE_REF_RE.findall(tactic_block))
    return mathlib, node_refs


def _generate_intuition(statement_en: str, lean_proof: str) -> str:
    """One cheap Haiku call: the plain-language face of a proved claim."""
    try:
        llm = get_llm(tier="fast")
        prompt = (
            "In one or two plain-English sentences, explain the intuition for why "
            f"this mathematical claim is true: \"{statement_en}\". "
            f"(A machine-verified proof used: {lean_proof}.) "
            "No symbols unless essential, no preamble, just the intuition."
        )
        return text_of(llm.invoke(prompt)).strip()
    except Exception:
        return ""


# ---------- AI operations ----------

def formalize_node(project_id: str, node_id: str) -> dict | None:
    project = get_project(project_id)
    if project is None:
        return None
    node = _find_node(project, node_id)
    if node is None:
        return None

    lemmas = search_mathlib(node["statement_en"], k=5)
    statement = formalize_question(
        node["statement_en"], lemmas, theorem_name=f"node_{node_id}"
    )
    if statement is None:
        def mark(p):
            n = _find_node(p, node_id)
            if n:
                n["error"] = "could not formalize into an elaborating Lean statement"
        _update_project(project_id, mark)
        return None

    def mutate(p):
        n = _find_node(p, node_id)
        if n:
            n.update({"lean_statement": statement, "status": "formalized", "error": "", "lean_proof": ""})

    _update_project(project_id, mutate)
    return {"lean_statement": statement}


def _prove_node_sync(project_id: str, node_id: str) -> None:
    """The prove pipeline for one node. Caller owns the active-set guard."""

    def mark_status(status: str, **fields):
        def mutate(p):
            n = _find_node(p, node_id)
            if n:
                n["status"] = status
                n.update(fields)
        _update_project(project_id, mutate)

    try:
        if True:
            project = get_project(project_id)
            node = _find_node(project, node_id) if project else None
            if node is None:
                return

            statement = node["lean_statement"]
            if not statement:
                lemmas = search_mathlib(node["statement_en"], k=5)
                statement = formalize_question(
                    node["statement_en"], lemmas, theorem_name=f"node_{node_id}"
                )
                if statement is None:
                    mark_status("failed", error="could not formalize the claim")
                    return
                mark_status("proving", lean_statement=statement)

            deps = _dependency_nodes(project, node_id)
            preamble = _preamble_for(deps)
            lemmas = search_mathlib(statement + " " + node["statement_en"], k=5) + _dep_lemmas(deps)

            tier = "fast" if node.get("model") == "haiku" else "smart"
            outcome = prove_statement(
                statement, lemmas, label=f"node_{node_id}", preamble=preamble, llm_tier=tier
            )
            if outcome is None:
                mark_status("failed", error="all proof attempts rejected by Lean")
            else:
                tactic_block, _ = outcome
                mathlib_facts, node_refs = _extract_facts(tactic_block)
                mark_status("proved", lean_proof=tactic_block, error="", facts_used=mathlib_facts)

                def mark_edges(p):
                    for edge in p["edges"]:
                        if edge["target"] == node_id and edge.get("kind", "uses") != "converse":
                            edge["used"] = f"node_{edge['source']}" in node_refs
                _update_project(project_id, mark_edges)

                current = get_project(project_id)
                current_node = _find_node(current, node_id) if current else None
                if current_node is not None and not current_node.get("intuition"):
                    intuition = _generate_intuition(current_node["statement_en"], tactic_block)
                    if intuition:
                        def set_intuition(p):
                            n = _find_node(p, node_id)
                            if n and not n.get("intuition"):
                                n["intuition"] = intuition
                        _update_project(project_id, set_intuition)
    except Exception as exc:
        mark_status("failed", error=str(exc))


def _run_guarded(project_id: str, node_id: str) -> bool:
    """Claim the per-node guard and run the prove pipeline synchronously."""
    with _active_lock:
        if node_id in _active_prove_nodes:
            return False
        _active_prove_nodes.add(node_id)
    try:
        _prove_node_sync(project_id, node_id)
    finally:
        with _active_lock:
            _active_prove_nodes.discard(node_id)
    return True


def _set_status(project_id: str, node_id: str, status: str, **fields) -> None:
    def mutate(p):
        n = _find_node(p, node_id)
        if n:
            n["status"] = status
            n.update(fields)
    _update_project(project_id, mutate)


def prove_node_async(project_id: str, node_id: str) -> bool:
    """Kick off proving in a background thread. Multiple nodes may prove in
    parallel (the REPL serializes compiles internally); one job per node."""
    with _active_lock:
        if node_id in _active_prove_nodes:
            return False
    _set_status(project_id, node_id, "proving", error="")
    threading.Thread(target=_run_guarded, args=(project_id, node_id), daemon=True).start()
    return True


def prove_all_async(project_id: str) -> bool:
    """Prove every unproved node in dependency order (lemmas before the
    theorems that use them), one background job for the whole graph."""
    if get_project(project_id) is None:
        return False

    def job():
        order = _topo_order(get_project(project_id) or {"nodes": [], "edges": []})
        for nid in order:
            p = get_project(project_id)
            n = _find_node(p, nid) if p else None
            if n is None or n["status"] == "proved":
                continue
            if n.get("kind") == "axiom" and n["lean_statement"]:
                continue  # axioms are accepted, not proved
            _set_status(project_id, nid, "proving", error="")
            _run_guarded(project_id, nid)

    threading.Thread(target=job, daemon=True).start()
    return True


def reverify_async(project_id: str) -> bool:
    """Re-check every stored proof against the current graph, in dependency
    order. Pure compiler work — no LLM calls. Restores or demotes badges."""
    if get_project(project_id) is None:
        return False

    def job():
        from app.engine.lean_runner import check_proof

        order = _topo_order(get_project(project_id) or {"nodes": [], "edges": []})
        for nid in order:
            p = get_project(project_id)
            n = _find_node(p, nid) if p else None
            if n is None or not n["lean_statement"] or not n["lean_proof"]:
                continue
            if n.get("kind") == "axiom" and n["status"] != "proved":
                continue
            _set_status(project_id, nid, "proving")
            deps = _dependency_nodes(get_project(project_id), nid)
            result = check_proof(n["lean_statement"], n["lean_proof"], preamble=_preamble_for(deps))
            if result.accepted:
                _set_status(project_id, nid, "proved", error="")
            else:
                first_error = result.errors[0].splitlines()[0] if result.errors else "unknown error"
                _set_status(project_id, nid, "formalized", error=f"proof no longer verifies: {first_error}")

    threading.Thread(target=job, daemon=True).start()
    return True


def auto_create(name: str, statement_en: str) -> dict | None:
    """The one-click flow: paste a theorem, get a claim graph — root node,
    compiler-checked formalization, and AI-proposed lemma children."""
    project = create_project(name)
    root = add_node(project["id"], statement_en, x=800, y=140, kind="theorem")
    if root is None:
        return None
    formalize_node(project["id"], root["id"])
    decompose_node(project["id"], root["id"])
    return get_project(project["id"])


def export_lean(project_id: str) -> dict | None:
    """Emit the project as a single compilable .lean file: axioms declared,
    proved nodes as theorems in dependency order, open claims as sorry stubs."""
    project = get_project(project_id)
    if project is None:
        return None

    proved = sum(1 for n in project["nodes"] if n["status"] == "proved")
    lines = [
        "/-",
        f"  {project['name']} — exported from Axlerate ProofLab",
        f"  {proved}/{len(project['nodes'])} claims machine-verified by Lean 4 against Mathlib.",
        "  Any `sorry` below marks a claim not yet proved at export time.",
        "-/",
        "import Mathlib",
        "",
        "namespace ProofLab",
        "",
    ]
    for nid in _topo_order(project):
        n = _find_node(project, nid)
        if n is None:
            continue
        kind = n.get("kind", "conjecture")
        doc = " ".join(n["statement_en"].replace("-/", "- /").split())
        if not n["lean_statement"]:
            lines += [f"-- unformalized {kind}: {doc}", ""]
            continue
        lines.append(f"/-- {doc} ({kind}) -/")
        if kind == "axiom" and n["status"] != "proved":
            decl = re.sub(r":=\s*by\s*$", "", n["lean_statement"]).strip()
            lines.append(re.sub(r"^theorem\b", "axiom", decl))
        elif n["status"] == "proved" and n["lean_proof"]:
            lines.append(n["lean_statement"])
            lines += ["  " + line for line in n["lean_proof"].splitlines()]
        else:
            lines += ["-- NOT YET PROVED", n["lean_statement"], "  sorry"]
        lines.append("")
    lines.append("end ProofLab")

    slug = re.sub(r"[^A-Za-z0-9]+", "_", project["name"]).strip("_") or "proof_project"
    return {"filename": f"{slug}.lean", "content": "\n".join(lines) + "\n"}


DECOMPOSE_RE = re.compile(r"```(?:json)?\s*\n(.*?)```", re.DOTALL)


def decompose_node(project_id: str, node_id: str) -> list[dict] | None:
    """Ask Sonnet to split a claim into standalone sub-lemmas; each becomes a
    linked child node. Lean statements are validated before being kept."""
    project = get_project(project_id)
    node = _find_node(project, node_id) if project else None
    if node is None:
        return None

    lemmas = search_mathlib(node["statement_en"], k=5)
    lemma_lines = "\n".join(f"- {l['name']}: {l['statement']}" for l in lemmas) or "(none)"
    lean_line = f"\nIts Lean formalization: {node['lean_statement']}" if node["lean_statement"] else ""

    llm = get_llm()  # smart tier — decomposition is structure
    prompt = f"""You are a mathematician planning a proof in Lean 4 + Mathlib.

Main claim: {node['statement_en']}{lean_line}

Break the proof of this claim into 2 to 5 INDEPENDENT sub-lemmas, such that
the main claim follows from them. Each sub-lemma must be a standalone,
self-contained statement (all variables bound), simpler than the main claim.

Possibly relevant Mathlib lemmas:
{lemma_lines}

Respond with ONLY a JSON array (no markdown fence, no commentary):
[{{"statement_en": "<plain English statement>",
   "intuition": "<one sentence: why this holds / its role in the bigger proof>",
   "lean_statement": "theorem SUB (x : ...) : ... := by"}}, ...]
Each lean_statement must end in `:= by`, use Lean 4 + current Mathlib syntax,
and be named SUB (it will be renamed automatically).
"""
    raw = text_of(llm.invoke(prompt)).strip()
    fence = DECOMPOSE_RE.search(raw)
    if fence:
        raw = fence.group(1).strip()
    try:
        proposals = json.loads(raw)
    except ValueError:
        return None

    created: list[dict] = []
    for index, proposal in enumerate(proposals[:5]):
        statement_en = str(proposal.get("statement_en", "")).strip()
        if not statement_en:
            continue
        child = add_node(
            project_id, statement_en,
            x=node["x"] - 180 + 200 * index, y=node["y"] + 220,
            kind="lemma",
        )
        if child is None:
            continue
        intuition = str(proposal.get("intuition", "")).strip()
        if intuition:
            update_node(project_id, child["id"], {"intuition": intuition})
            child["intuition"] = intuition

        lean_statement = str(proposal.get("lean_statement", "")).strip()
        if lean_statement.endswith(":= by"):
            lean_statement = re.sub(r"^theorem\s+\S+", f"theorem node_{child['id']}", lean_statement)
            if check_statement(lean_statement).accepted:
                update_node(project_id, child["id"], {"lean_statement": lean_statement})
                child["lean_statement"] = lean_statement
                child["status"] = "formalized"

        add_edge(project_id, source=child["id"], target=node_id)
        created.append(child)

    return created
