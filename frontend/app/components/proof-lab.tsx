"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Navigation from "./navigation"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import {
  Plus, Trash2, ArrowLeft, Wand2, Play, GitFork, Link2, X, Loader2, FolderOpen, PanelRight, ArrowLeftRight, Sparkles, RotateCw, Download,
} from "lucide-react"

// Render claim text with KaTeX — statements often carry \(...\) / $...$ math.
function MathText({ text, className }: { text: string; className?: string }) {
  const normalized = text
    .replace(/\\\(/g, () => "$").replace(/\\\)/g, () => "$")
    .replace(/\\\[/g, () => "$$").replace(/\\\]/g, () => "$$")
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <p className="mb-0">{children}</p> }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}

// ---------- types ----------

type NodeKind = "axiom" | "conjecture" | "lemma" | "proposition" | "theorem" | "corollary"

const NODE_KINDS: NodeKind[] = ["axiom", "conjecture", "lemma", "proposition", "theorem", "corollary"]

interface ProofNode {
  id: string
  statement_en: string
  lean_statement: string
  lean_proof: string
  status: "idea" | "formalized" | "proving" | "proved" | "failed"
  error: string
  model?: "sonnet" | "haiku"
  kind?: NodeKind
  intuition?: string
  facts_used?: string[]
  x: number
  y: number
  w?: number
  h?: number
}

interface ProofEdge {
  source: string
  target: string
  kind?: "uses" | "converse"
  used?: boolean
}

interface Project {
  id: string
  name: string
  nodes: ProofNode[]
  edges: ProofEdge[]
}

interface ProjectSummary {
  id: string
  name: string
  nodes: number
  edges: number
}

// ---------- api ----------

const api = {
  list: () => fetch("/api/projects").then((r) => r.json()),
  create: (name: string) =>
    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => r.json()),
  get: (id: string) => fetch(`/api/projects/${id}`).then((r) => r.json()),
  deleteProject: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }),
  addNode: (pid: string, statement_en: string, x: number, y: number) =>
    fetch(`/api/projects/${pid}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement_en, x, y }),
    }).then((r) => r.json()),
  patchNode: (pid: string, nid: string, fields: Record<string, unknown>) =>
    fetch(`/api/projects/${pid}/nodes/${nid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }),
  deleteNode: (pid: string, nid: string) =>
    fetch(`/api/projects/${pid}/nodes/${nid}`, { method: "DELETE" }),
  addEdge: (pid: string, source: string, target: string, kind: "uses" | "converse" = "uses") =>
    fetch(`/api/projects/${pid}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, target, kind }),
    }),
  deleteEdge: (pid: string, source: string, target: string) =>
    fetch(`/api/projects/${pid}/edges/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, target }),
    }),
  autoCreate: (name: string, statement_en: string) =>
    fetch("/api/projects/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, statement_en }),
    }).then((r) => r.json()),
  proveAll: (pid: string) => fetch(`/api/projects/${pid}/prove_all`, { method: "POST" }),
  reverify: (pid: string) => fetch(`/api/projects/${pid}/reverify`, { method: "POST" }),
  exportLean: (pid: string) => fetch(`/api/projects/${pid}/export`).then((r) => r.json()),
  formalize: (pid: string, nid: string) =>
    fetch(`/api/projects/${pid}/nodes/${nid}/formalize`, { method: "POST" }),
  prove: (pid: string, nid: string) =>
    fetch(`/api/projects/${pid}/nodes/${nid}/prove`, { method: "POST" }),
  decompose: (pid: string, nid: string) =>
    fetch(`/api/projects/${pid}/nodes/${nid}/decompose`, { method: "POST" }),
}

// ---------- visual language ----------

const STATUS_STYLES: Record<ProofNode["status"], { ring: string; chip: string; label: string }> = {
  idea: { ring: "border-white/15", chip: "bg-white/10 text-neutral-300", label: "Idea" },
  formalized: { ring: "border-sky-400/50", chip: "bg-sky-400/15 text-sky-300", label: "Formalized" },
  proving: { ring: "border-2 border-amber-400/70 shadow-[0_0_28px_rgba(251,191,36,0.12)]", chip: "bg-amber-400/15 text-amber-300", label: "Proving" },
  proved: { ring: "border-2 border-emerald-400/80 shadow-[0_0_28px_rgba(52,211,153,0.18)]", chip: "bg-emerald-400/15 text-emerald-300", label: "Proved" },
  failed: { ring: "border-2 border-red-400/70 shadow-[0_0_28px_rgba(248,113,113,0.12)]", chip: "bg-red-400/15 text-red-300", label: "Failed" },
}

const NODE_W = 260
const PLANE = 3000

const primaryButton =
  "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
const iconButton =
  "p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none"

// ---------- component ----------

export default function ProofLab() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [linkForId, setLinkForId] = useState<string | null>(null)
  const [linkKind, setLinkKind] = useState<"uses" | "converse">("uses")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [intuitionDraft, setIntuitionDraft] = useState("")
  const [edgePopover, setEdgePopover] = useState<{ edge: ProofEdge; x: number; y: number } | null>(null)
  const [newProjectName, setNewProjectName] = useState("")
  const [autoName, setAutoName] = useState("")
  const [autoStatement, setAutoStatement] = useState("")
  const [autoBusy, setAutoBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const resizeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number; moved: boolean } | null>(null)
  const [viewRect, setViewRect] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const panRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null>(null)

  const selected = project?.nodes.find((n) => n.id === selectedId) ?? null

  useEffect(() => {
    setIntuitionDraft(selected?.intuition ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.intuition])

  const refreshList = useCallback(() => {
    api.list().then((data) => Array.isArray(data) && setProjects(data)).catch(() => {})
  }, [])

  const projectId = project?.id
  const refreshProject = useCallback(() => {
    if (!projectId) return
    api.get(projectId).then((data) => data?.id && setProject(data)).catch(() => {})
  }, [projectId])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  // poll while anything is proving
  useEffect(() => {
    if (!project?.nodes.some((n) => n.status === "proving")) return
    const timer = setInterval(refreshProject, 3000)
    return () => clearInterval(timer)
  }, [project, refreshProject])

  // ---------- actions ----------

  const openProject = async (id: string) => {
    const data = await api.get(id)
    if (data?.id) {
      setProject(data)
      setSelectedId(null)
      setShowInspector(false)
      setLinkForId(null)
    }
  }

  const createProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const created = await api.create(name)
    setNewProjectName("")
    refreshList()
    if (created?.id) openProject(created.id)
  }

  const autoCreate = async () => {
    const statement = autoStatement.trim()
    if (!statement || autoBusy) return
    setAutoBusy(true)
    try {
      const created = await api.autoCreate(autoName.trim() || statement.slice(0, 60), statement)
      if (created?.id) {
        setAutoName("")
        setAutoStatement("")
        refreshList()
        setProject(created)
        setSelectedId(null)
        setShowInspector(false)
      }
    } finally {
      setAutoBusy(false)
    }
  }

  const proveAll = async () => {
    if (!project) return
    await api.proveAll(project.id)
    refreshProject()
  }

  const reverifyAll = async () => {
    if (!project) return
    await api.reverify(project.id)
    refreshProject()
  }

  const exportLean = async () => {
    if (!project) return
    const data = await api.exportLean(project.id)
    if (!data?.content) return
    const blob = new Blob([data.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = data.filename ?? "proof_project.lean"
    a.click()
    URL.revokeObjectURL(url)
  }

  const addClaim = async () => {
    if (!project) return
    const x = 160 + (project.nodes.length % 4) * 300
    const y = 160 + Math.floor(project.nodes.length / 4) * 220
    await api.addNode(project.id, "New claim — double-click to edit", x, y)
    refreshProject()
  }

  const runNodeAction = async (nodeId: string, kind: "formalize" | "prove" | "decompose") => {
    if (!project) return
    setBusyId(nodeId + kind)
    try {
      if (kind === "formalize") await api.formalize(project.id, nodeId)
      if (kind === "prove") await api.prove(project.id, nodeId)
      if (kind === "decompose") await api.decompose(project.id, nodeId)
      await refreshProject()
    } finally {
      setBusyId(null)
    }
  }

  const removeNode = async (nodeId: string) => {
    if (!project) return
    await api.deleteNode(project.id, nodeId)
    if (selectedId === nodeId) {
      setSelectedId(null)
      setShowInspector(false)
    }
    refreshProject()
  }

  const setNodeModel = async (nodeId: string, model: string) => {
    if (!project) return
    setProject({
      ...project,
      nodes: project.nodes.map((n) => (n.id === nodeId ? { ...n, model: model as ProofNode["model"] } : n)),
    })
    await api.patchNode(project.id, nodeId, { model })
  }

  const setNodeKind = async (nodeId: string, kind: string) => {
    if (!project) return
    setProject({
      ...project,
      nodes: project.nodes.map((n) => (n.id === nodeId ? { ...n, kind: kind as NodeKind } : n)),
    })
    await api.patchNode(project.id, nodeId, { kind })
  }

  const startEditing = (node: ProofNode) => {
    setEditingId(node.id)
    setEditDraft(node.statement_en)
  }

  const saveEditing = async () => {
    if (!project || !editingId) return
    const node = project.nodes.find((n) => n.id === editingId)
    setEditingId(null)
    if (node && editDraft.trim() && editDraft.trim() !== node.statement_en) {
      await api.patchNode(project.id, node.id, { statement_en: editDraft.trim() })
      refreshProject()
    }
  }

  const saveIntuition = async () => {
    if (!project || !selected) return
    if (intuitionDraft.trim() !== (selected.intuition ?? "")) {
      await api.patchNode(project.id, selected.id, { intuition: intuitionDraft.trim() })
      refreshProject()
    }
  }

  const handleNodeClick = async (node: ProofNode) => {
    if (linkForId && node.id !== linkForId) {
      // the link-origin node will DEPEND ON the clicked node
      await api.addEdge(project!.id, node.id, linkForId, linkKind)
      setLinkForId(null)
      refreshProject()
      return
    }
    setSelectedId(node.id)
  }

  // ---------- dragging ----------

  const onNodePointerDown = (e: React.PointerEvent, node: ProofNode) => {
    if (linkForId || editingId === node.id) return
    const target = e.target as Element
    if (target.closest("button, select, textarea, input, [data-resize]")) return
    const canvas = canvasRef.current
    if (!canvas) return
    target.setPointerCapture?.(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    dragRef.current = {
      id: node.id,
      dx: e.clientX - (rect.left - canvas.scrollLeft) - node.x,
      dy: e.clientY - (rect.top - canvas.scrollTop) - node.y,
      moved: false,
    }
  }

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-node]")) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture?.(e.pointerId)
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: canvas.scrollLeft,
      startTop: canvas.scrollTop,
      moved: false,
    }
  }

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    const pan = panRef.current
    if (pan && canvas) {
      const dx = e.clientX - pan.startX
      const dy = e.clientY - pan.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true
      canvas.scrollLeft = pan.startLeft - dx
      canvas.scrollTop = pan.startTop - dy
      return
    }
    const resize = resizeRef.current
    if (resize && canvas && project) {
      resize.moved = true
      const w = Math.min(560, Math.max(200, resize.startW + (e.clientX - resize.startX)))
      const h = Math.min(600, Math.max(0, resize.startH + (e.clientY - resize.startY)))
      setProject({
        ...project,
        nodes: project.nodes.map((n) => (n.id === resize.id ? { ...n, w, h } : n)),
      })
      return
    }
    const drag = dragRef.current
    if (!drag || !canvas || !project) return
    drag.moved = true
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, e.clientX - (rect.left - canvas.scrollLeft) - drag.dx)
    const y = Math.max(60, e.clientY - (rect.top - canvas.scrollTop) - drag.dy)
    setProject({
      ...project,
      nodes: project.nodes.map((n) => (n.id === drag.id ? { ...n, x, y } : n)),
    })
  }

  const onCanvasPointerUp = () => {
    const pan = panRef.current
    panRef.current = null
    if (pan?.moved) return
    const resize = resizeRef.current
    resizeRef.current = null
    if (resize && project && resize.moved) {
      const node = project.nodes.find((n) => n.id === resize.id)
      if (node) api.patchNode(project.id, node.id, { w: node.w, h: node.h })
      return
    }
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !project || !drag.moved) return
    const node = project.nodes.find((n) => n.id === drag.id)
    if (node) api.patchNode(project.id, node.id, { x: node.x, y: node.y })
  }

  const onResizePointerDown = (e: React.PointerEvent, node: ProofNode) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    resizeRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: node.w ?? NODE_W,
      startH: node.h ?? 0,
      moved: false,
    }
  }

  const updateViewRect = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setViewRect({
      left: canvas.scrollLeft,
      top: canvas.scrollTop,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    })
  }, [])

  useEffect(() => {
    if (project) updateViewRect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  // ---------- render: project list ----------

  if (!project) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Navigation />
        <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Proof Projects</h1>
          <p className="text-sm text-neutral-400 leading-relaxed mb-8">
            A project is a graph of claims. Break hard theorems into nodes, let the AI
            formalize and prove each one, and link proved nodes as lemmas for the next —
            every step verified by the Lean compiler.
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 mb-4">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Start from a theorem</p>
            <textarea
              value={autoStatement}
              onChange={(e) => setAutoStatement(e.target.value)}
              rows={3}
              placeholder="Paste a theorem — e.g. “Every subgroup of a cyclic group is cyclic” — and the AI will propose the claim graph…"
              className="mb-3 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/25 transition-colors focus:border-white/25 focus:outline-none"
            />
            <div className="flex gap-3">
              <input
                value={autoName}
                onChange={(e) => setAutoName(e.target.value)}
                placeholder="Project name (optional)"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
              />
              <button onClick={autoCreate} disabled={!autoStatement.trim() || autoBusy} className={primaryButton}>
                {autoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {autoBusy ? "Generating graph…" : "Generate graph"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 mb-8">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Or start empty</p>
            <div className="flex gap-3">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                placeholder="Name a new project…"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors"
              />
              <button onClick={createProject} disabled={!newProjectName.trim()} className={primaryButton}>
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-5 py-4 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-150"
              >
                <button onClick={() => openProject(p.id)} className="flex flex-1 items-center gap-3 text-left">
                  <FolderOpen className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium text-white">{p.name}</span>
                </button>
                <span className="flex items-center gap-4">
                  <span className="text-xs font-mono text-neutral-500">
                    {p.nodes} node{p.nodes === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={async () => { await api.deleteProject(p.id); refreshList() }}
                    className="text-neutral-600 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-neutral-600 text-center py-8">No projects yet.</p>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ---------- render: graph workspace ----------

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden">
      <Navigation />

      {/* toolbar */}
      <div className="fixed top-24 left-0 right-0 z-30 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl px-5 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setProject(null); setSelectedId(null); refreshList() }}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">{project.name}</span>
            <span className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                {project.nodes.filter((n) => n.status === "proved").length}/{project.nodes.length} proved
              </span>
              <span className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-emerald-400/80 transition-all duration-500"
                  style={{ width: `${project.nodes.length ? (project.nodes.filter((n) => n.status === "proved").length / project.nodes.length) * 100 : 0}%` }}
                />
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {linkForId && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 mr-1">
                {linkKind === "converse" ? "click the statement it is the converse of" : "click the node it depends on"} · esc to cancel
              </span>
            )}
            <button
              onClick={proveAll}
              title="Prove every unproved node, lemmas first"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/15 hover:border-emerald-400/45 active:scale-[0.97] transition-all duration-150"
            >
              <Play className="w-3.5 h-3.5" /> Prove all
            </button>
            <button
              onClick={reverifyAll}
              title="Re-check every stored proof against the current graph (no AI, compiler only)"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:border-white/25 hover:text-white active:scale-[0.97] transition-all duration-150"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={exportLean}
              title="Export the project as a compilable .lean file"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:border-white/25 hover:text-white active:scale-[0.97] transition-all duration-150"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={addClaim} className={primaryButton}>
              <Plus className="w-3.5 h-3.5" /> New claim
            </button>
          </div>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onScroll={updateViewRect}
        onClick={(e) => {
          if ((e.target as Element).closest("[data-node]")) return
          setSelectedId(null)
          setLinkForId(null)
          setEdgePopover(null)
        }}
        onKeyDown={(e) => e.key === "Escape" && setLinkForId(null)}
        tabIndex={-1}
        className="absolute inset-0 overflow-auto focus:outline-none cursor-grab active:cursor-grabbing"
      >
        <div
          className="relative"
          style={{
            width: PLANE,
            height: PLANE,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(circle, rgba(255,255,255,0.14) 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px, 140px 140px",
          }}
        >
          {/* edges */}
          <svg className="absolute inset-0" width={PLANE} height={PLANE}>
            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(255,255,255,0.55)" />
              </marker>
              <marker id="arrow-proved" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(52,211,153,0.75)" />
              </marker>
            </defs>
            {project.edges.map((edge, i) => {
              const s = project.nodes.find((n) => n.id === edge.source)
              const t = project.nodes.find((n) => n.id === edge.target)
              if (!s || !t) return null
              const converse = edge.kind === "converse"
              const x1 = s.x + (s.w ?? NODE_W) / 2, y1 = s.y + 44
              const x2 = t.x + (t.w ?? NODE_W) / 2, y2 = t.y + 44
              return (
                <g key={i}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={converse ? "rgba(192,132,252,0.6)" : s.status === "proved" ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.38)"}
                    strokeWidth="2"
                    strokeDasharray={converse ? "6 5" : undefined}
                    markerEnd={converse ? undefined : s.status === "proved" ? "url(#arrow-proved)" : "url(#arrow)"}
                    pointerEvents="none"
                  />
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="transparent" strokeWidth="16"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setEdgePopover({ edge, x: e.clientX, y: e.clientY }) }}
                  />
                </g>
              )
            })}
          </svg>

          {/* nodes */}
          {project.nodes.map((node) => {
            const style = STATUS_STYLES[node.status]
            const isSelected = node.id === selectedId
            const isLinkOrigin = node.id === linkForId
            const proving = node.status === "proving"
            return (
              <div
                key={node.id}
                data-node
                onPointerDown={(e) => onNodePointerDown(e, node)}
                onClick={(e) => { e.stopPropagation(); handleNodeClick(node) }}
                onDoubleClick={(e) => { e.stopPropagation(); startEditing(node) }}
                className={`group absolute cursor-grab active:cursor-grabbing select-none rounded-2xl border ${style.ring} ${
                  isSelected ? "ring-2 ring-white/40" : ""
                } ${isLinkOrigin ? "ring-2 ring-amber-400/50" : ""} bg-black/60 backdrop-blur-xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_16px_50px_rgba(0,0,0,0.7)]`}
                style={{ left: node.x, top: node.y, width: node.w ?? NODE_W, minHeight: node.h || undefined }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="relative inline-flex items-center">
                      <select
                        value={node.kind ?? "conjecture"}
                        onChange={(e) => setNodeKind(node.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        title={`Role (click to change) · status: ${style.label}`}
                        className={`appearance-none rounded-full pl-2 pr-5 py-0.5 text-[10px] font-mono uppercase tracking-widest cursor-pointer focus:outline-none border-0 hover:brightness-125 transition ${style.chip}`}
                      >
                        {NODE_KINDS.map((k) => (
                          <option key={k} value={k} className="bg-neutral-900 text-white">{k}</option>
                        ))}
                      </select>
                      <svg viewBox="0 0 8 5" className="pointer-events-none absolute right-1.5 h-1.5 w-2 opacity-60">
                        <path d="M 0 0 L 4 5 L 8 0" fill="currentColor" />
                      </svg>
                    </span>
                    {proving && <Loader2 className={`w-2.5 h-2.5 animate-spin ${style.chip.split(" ").pop()}`} />}
                  </span>
                  <select
                    value={node.model ?? "sonnet"}
                    onChange={(e) => setNodeModel(node.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/10 focus:outline-none cursor-pointer transition-colors"
                  >
                    <option value="sonnet">Sonnet</option>
                    <option value="haiku">Haiku</option>
                  </select>
                </div>

                {editingId === node.id ? (
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={saveEditing}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditing() } }}
                    autoFocus
                    rows={3}
                    className="w-full resize-none rounded-lg border border-white/20 bg-black/40 px-2.5 py-2 text-xs leading-relaxed text-neutral-100 focus:outline-none focus:border-white/40"
                  />
                ) : (
                  <>
                    <MathText
                      text={node.statement_en}
                      className={`text-xs text-neutral-200 leading-relaxed ${node.h ? "" : "line-clamp-4"}`}
                    />
                    {node.intuition && (
                      <p className={`mt-1.5 text-[11px] italic text-neutral-500 leading-relaxed ${node.h ? "" : "line-clamp-2"}`}>
                        {node.intuition}
                      </p>
                    )}
                  </>
                )}

                {/* in-node controls — visible on hover or selection */}
                <div
                  className={`mt-3 flex items-center gap-0.5 ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  } transition-opacity duration-150`}
                >
                  <button
                    title="Prove"
                    onClick={(e) => { e.stopPropagation(); runNodeAction(node.id, "prove") }}
                    disabled={proving || busyId?.startsWith(node.id)}
                    className={`${iconButton} text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/10`}
                  >
                    {busyId === node.id + "prove" || proving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    title="Formalize"
                    onClick={(e) => { e.stopPropagation(); runNodeAction(node.id, "formalize") }}
                    disabled={busyId?.startsWith(node.id)}
                    className={iconButton}
                  >
                    {busyId === node.id + "formalize" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  </button>
                  <button
                    title="Decompose into sub-lemmas"
                    onClick={(e) => { e.stopPropagation(); runNodeAction(node.id, "decompose") }}
                    disabled={busyId?.startsWith(node.id)}
                    className={iconButton}
                  >
                    {busyId === node.id + "decompose" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitFork className="w-4 h-4" />}
                  </button>
                  <button
                    title={isLinkOrigin && linkKind === "uses" ? "Cancel linking" : "Add dependency (this claim uses…)"}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isLinkOrigin && linkKind === "uses") { setLinkForId(null) }
                      else { setLinkForId(node.id); setLinkKind("uses"); setSelectedId(node.id) }
                    }}
                    className={`${iconButton} ${isLinkOrigin && linkKind === "uses" ? "text-amber-300 bg-amber-400/10" : ""}`}
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    title={isLinkOrigin && linkKind === "converse" ? "Cancel linking" : "Mark converse of…"}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isLinkOrigin && linkKind === "converse") { setLinkForId(null) }
                      else { setLinkForId(node.id); setLinkKind("converse"); setSelectedId(node.id) }
                    }}
                    className={`${iconButton} ${isLinkOrigin && linkKind === "converse" ? "text-purple-300 bg-purple-400/10" : ""}`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                  <div className="flex-1" />
                  <button
                    title="Details"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (showInspector && selectedId === node.id) { setShowInspector(false) }
                      else { setSelectedId(node.id); setShowInspector(true) }
                    }}
                    className={iconButton}
                  >
                    <PanelRight className="w-4 h-4" />
                  </button>
                  <button
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); removeNode(node.id) }}
                    className={`${iconButton} hover:text-red-300 hover:bg-red-400/10`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* resize handle */}
                <div
                  data-resize
                  onPointerDown={(e) => onResizePointerDown(e, node)}
                  className={`absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-br-2xl ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  } transition-opacity duration-150`}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3 text-white/30">
                    <path d="M 11 5 L 5 11 M 11 9 L 9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* minimap */}
      <div
        onClick={(e) => {
          const canvas = canvasRef.current
          const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          if (!canvas) return
          const scale = PLANE / box.width
          canvas.scrollTo({
            left: (e.clientX - box.left) * scale - canvas.clientWidth / 2,
            top: (e.clientY - box.top) * scale - canvas.clientHeight / 2,
            behavior: "smooth",
          })
        }}
        className="fixed bottom-6 left-6 z-30 h-44 w-44 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
      >
        {project.nodes.map((node) => {
          const scale = 176 / PLANE
          const color =
            node.status === "proved" ? "bg-emerald-400" :
            node.status === "proving" ? "bg-amber-400" :
            node.status === "failed" ? "bg-red-400" :
            node.status === "formalized" ? "bg-sky-400" : "bg-neutral-400"
          return (
            <span
              key={node.id}
              className={`absolute h-1.5 w-1.5 rounded-full ${color} ${node.id === selectedId ? "ring-2 ring-white/60" : ""}`}
              style={{ left: (node.x + (node.w ?? NODE_W) / 2) * scale - 3, top: (node.y + 40) * scale - 3 }}
            />
          )
        })}
        <span
          className="absolute rounded-md border border-white/40 bg-white/5 pointer-events-none"
          style={{
            left: viewRect.left * (176 / PLANE),
            top: viewRect.top * (176 / PLANE),
            width: viewRect.width * (176 / PLANE),
            height: viewRect.height * (176 / PLANE),
          }}
        />
      </div>

      {/* edge popover — the fact this string carries */}
      {edgePopover && (() => {
        const { edge } = edgePopover
        const s = project.nodes.find((n) => n.id === edge.source)
        const t = project.nodes.find((n) => n.id === edge.target)
        if (!s || !t) return null
        const converse = edge.kind === "converse"
        const left = Math.min(edgePopover.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 360)
        const top = Math.min(edgePopover.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 260)
        return (
          <div
            className="fixed z-40 w-80 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-4 shadow-[0_18px_60px_rgba(0,0,0,0.7)]"
            style={{ left, top }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-widest ${converse ? "text-purple-300" : "text-neutral-400"}`}>
                {converse ? "Converse relation" : "This step carries"}
              </span>
              <button onClick={() => setEdgePopover(null)} className="text-neutral-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {converse ? (
              <p className="text-xs leading-relaxed text-neutral-300">
                <span className="text-neutral-200">{s.statement_en}</span>
                <span className="mx-1.5 text-purple-300">⇄</span>
                <span className="text-neutral-200">{t.statement_en}</span>
              </p>
            ) : (
              <>
                <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-emerald-300/80">
                  {(s.kind ?? "conjecture").toUpperCase()}
                </p>
                <MathText text={s.statement_en} className="text-xs leading-relaxed text-neutral-200" />
                {s.intuition && <p className="mt-1.5 text-[11px] italic leading-relaxed text-neutral-500">{s.intuition}</p>}
                <p className={`mt-3 text-[10px] font-mono uppercase tracking-widest ${
                  t.status !== "proved" ? "text-neutral-600" : edge.used ? "text-emerald-400" : "text-amber-300/80"
                }`}>
                  {t.status !== "proved"
                    ? "target not yet proved"
                    : edge.used
                      ? "✓ referenced in the verified proof"
                      : "linked, but not referenced by the final proof"}
                </p>
              </>
            )}
          </div>
        )
      })()}

      {/* inspector — optional detail view */}
      {showInspector && selected && (
        <aside className="fixed right-6 top-44 bottom-6 z-30 w-96 overflow-y-auto rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${STATUS_STYLES[selected.status].chip}`}>
              {selected.status === "proving" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {STATUS_STYLES[selected.status].label}
            </span>
            <button onClick={() => setShowInspector(false)} className="text-neutral-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Claim</p>
              <MathText text={selected.statement_en} className="text-sm leading-relaxed text-neutral-200" />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Intuition</p>
              <textarea
                value={intuitionDraft}
                onChange={(e) => setIntuitionDraft(e.target.value)}
                onBlur={saveIntuition}
                rows={3}
                placeholder="Why is this true, in plain language? (auto-generated when proved)"
                className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 text-sm italic leading-relaxed text-neutral-300 placeholder:text-white/20 transition-colors focus:border-white/25 focus:outline-none"
              />
            </div>

            {(selected.facts_used?.length ?? 0) > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Mathlib facts used</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.facts_used!.map((fact) => (
                    <span key={fact} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-neutral-300">
                      {fact}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.error && (
              <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3">
                <p className="text-xs leading-relaxed text-red-300">{selected.error}</p>
              </div>
            )}

            {selected.lean_statement && (
              <div>
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Lean statement</p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-[12px] leading-5 text-neutral-300">
                  {selected.lean_statement}
                </pre>
              </div>
            )}

            {selected.lean_proof && (
              <div>
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Verified proof</p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 font-mono text-[12px] leading-5 text-emerald-200">
                  {selected.lean_proof}
                </pre>
                <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                  Verified by the Lean 4 compiler
                </p>
              </div>
            )}

            {project.edges.some((e) => e.target === selected.id && e.kind !== "converse") && (
              <div>
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Depends on</p>
                <div className="space-y-2">
                  {project.edges
                    .filter((e) => e.target === selected.id && e.kind !== "converse")
                    .map((e) => {
                      const dep = project.nodes.find((n) => n.id === e.source)
                      if (!dep) return null
                      return (
                        <div key={e.source} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5">
                          <button
                            onClick={() => setSelectedId(dep.id)}
                            className="line-clamp-1 text-left text-xs text-neutral-300 transition-colors hover:text-white"
                          >
                            {dep.statement_en}
                          </button>
                          <button
                            onClick={async () => { await api.deleteEdge(project.id, e.source, e.target); refreshProject() }}
                            className="text-neutral-600 transition-colors hover:text-red-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {project.edges.some((e) => e.kind === "converse" && (e.target === selected.id || e.source === selected.id)) && (
              <div>
                <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-purple-300/70">Converse of</p>
                <div className="space-y-2">
                  {project.edges
                    .filter((e) => e.kind === "converse" && (e.target === selected.id || e.source === selected.id))
                    .map((e) => {
                      const otherId = e.source === selected.id ? e.target : e.source
                      const other = project.nodes.find((n) => n.id === otherId)
                      if (!other) return null
                      return (
                        <div key={otherId} className="flex items-center justify-between gap-2 rounded-xl border border-purple-400/20 bg-purple-400/[0.06] px-3.5 py-2.5">
                          <button
                            onClick={() => setSelectedId(other.id)}
                            className="line-clamp-1 text-left text-xs text-neutral-300 transition-colors hover:text-white"
                          >
                            {other.statement_en}
                          </button>
                          <button
                            onClick={async () => { await api.deleteEdge(project.id, e.source, e.target); refreshProject() }}
                            className="text-neutral-600 transition-colors hover:text-red-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
