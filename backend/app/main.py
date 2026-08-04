import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
import threading
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Make sure your import path matches your folder structure
from app.engine.graph_builder import axlerate_app
from app.engine import proof_agent
from app.engine.lean_repl import LeanRepl

load_dotenv()

# Verify the key is actually loaded
if not os.getenv("GROQ_API_KEY"):
    raise ValueError("GROQ_API_KEY is not set in your .env file")

app = FastAPI()

# Add CORS middleware to allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str

class QuestionResponse(BaseModel):
    proof: str
    is_compliant: bool
    # "lean-verified" when the Lean compiler accepted a proof of the
    # formalized statement, "ai-reviewed" when only the LLM judge passed it,
    # "unverified" otherwise.
    verification: str = "unverified"
    lean_statement: Optional[str] = None
    lean_proof: Optional[str] = None
    # complete .tex document, assembled deterministically from the pieces above
    latex_document: Optional[str] = None

@app.post("/api/question", response_model=QuestionResponse)
async def handle_question(request: QuestionRequest):
    """Handle a question from the frontend and return the proof."""
    try:
        inputs = {"question": request.question}

        # The graph shells out to the Lean compiler and can run for minutes;
        # run it in a worker thread so the event loop stays responsive.
        from fastapi.concurrency import run_in_threadpool
        final_result = await run_in_threadpool(axlerate_app.invoke, inputs)

        from app.engine.latexifier import build_latex_document

        proof = final_result.get("proof", "")
        verification = final_result.get("verification", "unverified")
        lean_statement = final_result.get("lean_statement") or ""
        lean_proof = final_result.get("lean_proof") or ""

        return QuestionResponse(
            proof=proof,
            is_compliant=final_result.get("is_compliant", False),
            verification=verification,
            lean_statement=lean_statement or None,
            lean_proof=lean_proof or None,
            latex_document=build_latex_document(
                question=request.question,
                prose=proof,
                lean_statement=lean_statement,
                lean_proof=lean_proof,
                verification=verification,
            ) if proof else None,
        )
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error processing question: {str(e)}")
        print(f"Traceback: {error_details}")
        
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Error processing question: {str(e)}"
        )

@app.on_event("startup")
async def warm_lean_repl():
    """Pay the `import Mathlib` cost once, at boot, off the event loop —
    proof checks then take seconds instead of 30-60s each."""
    def _warm():
        try:
            repl = LeanRepl.get()
            if repl.available():
                repl.ensure_started()
            else:
                print("Lean REPL binary not built (vendor/repl) — proof checks will use cold lake runs")
        except Exception as e:
            print(f"Lean REPL warmup failed ({e}) — proof checks will use cold lake runs")

    threading.Thread(target=_warm, daemon=True).start()

@app.get("/")
async def root():
    return {"message": "Axlerate API is running"}

@app.get("/api/lean/status")
async def lean_status():
    repl = LeanRepl.get()
    return {"repl_built": repl.available(), "warm": repl.warm}

# --- Proof Lab: the Lean-verified proof loop ---

class ProveRequest(BaseModel):
    target_id: Optional[str] = None  # None = prove everything still unproved

# One proving job at a time; the frontend polls /api/prove/status for events.
_job_lock = threading.Lock()
_job_state = {"running": False, "target_id": None, "events": [], "error": None}

def _run_prove_job(target_id: Optional[str]):
    def on_event(event):
        with _job_lock:
            _job_state["events"].append(event)

    try:
        proof_agent.run(target_id, on_event=on_event)
    except Exception as e:
        with _job_lock:
            _job_state["error"] = str(e)
    finally:
        with _job_lock:
            _job_state["running"] = False

@app.get("/api/targets")
async def list_targets():
    return proof_agent.load_targets()

@app.post("/api/prove")
async def start_prove(request: ProveRequest):
    with _job_lock:
        if _job_state["running"]:
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="A proving job is already running")
        _job_state.update({"running": True, "target_id": request.target_id, "events": [], "error": None})

    thread = threading.Thread(target=_run_prove_job, args=(request.target_id,), daemon=True)
    thread.start()
    return {"started": True, "target_id": request.target_id}

@app.get("/api/prove/status")
async def prove_status():
    with _job_lock:
        return {
            "running": _job_state["running"],
            "target_id": _job_state["target_id"],
            "events": list(_job_state["events"]),
            "error": _job_state["error"],
        }

# --- Proof Projects: the graph-based proof workspace ---

from fastapi import HTTPException
from app.engine import proof_projects


class ProjectCreate(BaseModel):
    name: str

class NodeCreate(BaseModel):
    statement_en: str
    x: float = 0
    y: float = 0
    kind: str = "conjecture"

class NodeUpdate(BaseModel):
    statement_en: Optional[str] = None
    lean_statement: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    model: Optional[str] = None
    w: Optional[float] = None
    h: Optional[float] = None
    kind: Optional[str] = None
    intuition: Optional[str] = None

class EdgeSpec(BaseModel):
    source: str
    target: str
    kind: str = "uses"


class AutoCreate(BaseModel):
    name: str
    statement_en: str


@app.get("/api/projects")
async def projects_list():
    return proof_projects.list_projects()

@app.post("/api/projects/auto")
async def projects_auto_create(body: AutoCreate):
    """Paste a theorem, get a claim graph: root node + formalization +
    AI-proposed lemma children. Takes ~30-60s (LLM + compiler checks)."""
    from fastapi.concurrency import run_in_threadpool
    project = await run_in_threadpool(
        proof_projects.auto_create,
        body.name.strip() or "Untitled project",
        body.statement_en.strip(),
    )
    if project is None:
        raise HTTPException(status_code=500, detail="auto-create failed")
    return project

@app.post("/api/projects/{project_id}/prove_all")
async def projects_prove_all(project_id: str):
    if not proof_projects.prove_all_async(project_id):
        raise HTTPException(status_code=404, detail="project not found")
    return {"started": True}

@app.post("/api/projects/{project_id}/reverify")
async def projects_reverify(project_id: str):
    if not proof_projects.reverify_async(project_id):
        raise HTTPException(status_code=404, detail="project not found")
    return {"started": True}

@app.get("/api/projects/{project_id}/export")
async def projects_export(project_id: str):
    export = proof_projects.export_lean(project_id)
    if export is None:
        raise HTTPException(status_code=404, detail="project not found")
    return export

@app.post("/api/projects")
async def projects_create(body: ProjectCreate):
    return proof_projects.create_project(body.name.strip() or "Untitled project")

@app.get("/api/projects/{project_id}")
async def projects_get(project_id: str):
    project = proof_projects.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return project

@app.delete("/api/projects/{project_id}")
async def projects_delete(project_id: str):
    if not proof_projects.delete_project(project_id):
        raise HTTPException(status_code=404, detail="project not found")
    return {"deleted": True}

@app.post("/api/projects/{project_id}/nodes")
async def nodes_create(project_id: str, body: NodeCreate):
    node = proof_projects.add_node(project_id, body.statement_en, body.x, body.y, kind=body.kind)
    if node is None:
        raise HTTPException(status_code=404, detail="project not found")
    return node

@app.patch("/api/projects/{project_id}/nodes/{node_id}")
async def nodes_update(project_id: str, node_id: str, body: NodeUpdate):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    node = proof_projects.update_node(project_id, node_id, fields)
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    return node

@app.delete("/api/projects/{project_id}/nodes/{node_id}")
async def nodes_delete(project_id: str, node_id: str):
    if not proof_projects.delete_node(project_id, node_id):
        raise HTTPException(status_code=404, detail="node not found")
    return {"deleted": True}

@app.post("/api/projects/{project_id}/edges")
async def edges_create(project_id: str, body: EdgeSpec):
    if not proof_projects.add_edge(project_id, body.source, body.target, kind=body.kind):
        raise HTTPException(status_code=400, detail="invalid edge")
    return {"created": True}

@app.post("/api/projects/{project_id}/edges/delete")
async def edges_delete(project_id: str, body: EdgeSpec):
    proof_projects.delete_edge(project_id, body.source, body.target)
    return {"deleted": True}

@app.post("/api/projects/{project_id}/nodes/{node_id}/formalize")
async def nodes_formalize(project_id: str, node_id: str):
    from fastapi.concurrency import run_in_threadpool
    result = await run_in_threadpool(proof_projects.formalize_node, project_id, node_id)
    if result is None:
        raise HTTPException(status_code=422, detail="could not formalize this claim")
    return result

@app.post("/api/projects/{project_id}/nodes/{node_id}/prove")
async def nodes_prove(project_id: str, node_id: str):
    if not proof_projects.prove_node_async(project_id, node_id):
        raise HTTPException(status_code=409, detail="this node is already being proved")
    return {"started": True}

@app.post("/api/projects/{project_id}/nodes/{node_id}/decompose")
async def nodes_decompose(project_id: str, node_id: str):
    from fastapi.concurrency import run_in_threadpool
    created = await run_in_threadpool(proof_projects.decompose_node, project_id, node_id)
    if created is None:
        raise HTTPException(status_code=422, detail="decomposition failed")
    return created


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)