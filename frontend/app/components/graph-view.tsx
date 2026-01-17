"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Navigation from "./navigation"
import ConceptNode from "./ConceptNode"
import BranchModal from "./BranchModal"
import NodeMenu from "./NodeMenu"
import Toast from "./Toast"
import { ArrowLeft, Plus, Trash2, Edit2 } from "lucide-react"

// Export for use in handlers
export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  data: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface Node {
  id: string
  title: string
  type: string
  content: string
  x: number
  y: number
  // Interactive features
  expanded?: boolean
  internetEnabled?: boolean
  selectedModel?: string
  attachedFiles?: FileAttachment[]
  chatHistory?: ChatMessage[]
}

interface Edge {
  from: string
  to: string
  fromPort?: 'left' | 'right'
  toPort?: 'left' | 'right'
}

interface GraphViewProps {
  onBack: () => void
  messages: Message[]
}

export default function GraphView({ onBack, messages }: GraphViewProps) {
  // Initialize nodes from messages if available
  const initializeNodes = (): Node[] => {
    if (messages.length === 0) {
      return [
        { id: '1', title: "Start Here", type: "Note", content: "Click to edit this sticky note or add new nodes to start building your knowledge graph...", x: 0, y: 0 }
      ]
    }

    const nodes: Node[] = []
    let xPos = -300
    let yPos = 0

    messages.forEach((msg, index) => {
      if (msg.role === "user") {
        nodes.push({
          id: `msg-${msg.id}`,
          title: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
          type: "Question",
          content: msg.content,
          x: xPos,
          y: yPos
        })
      } else {
        nodes.push({
          id: `msg-${msg.id}`,
          title: `Solution ${Math.floor(index / 2) + 1}`,
          type: "Answer",
          content: msg.content,
          x: xPos + 600,
          y: yPos
        })
        yPos += 400
      }
    })

    return nodes
  }

  const [nodes, setNodes] = useState<Node[]>(initializeNodes())
  const [edges, setEdges] = useState<Edge[]>(() => {
    // Create edges between questions and answers
    const initialEdges: Edge[] = []
    for (let i = 0; i < messages.length - 1; i += 2) {
      if (i + 1 < messages.length) {
        initialEdges.push({
          from: `msg-${messages[i].id}`,
          to: `msg-${messages[i + 1].id}`
        })
      }
    }
    return initialEdges
  })

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.8)
  const [hasInitializedView, setHasInitializedView] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isEditingNode, setIsEditingNode] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: "", type: "", content: "" })
  const [branchingNodeId, setBranchingNodeId] = useState<string | null>(null)
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Edge drag state
  const [isDraggingEdge, setIsDraggingEdge] = useState(false)
  const [edgeDragStart, setEdgeDragStart] = useState<{
    nodeId: string
    port: 'left' | 'right'
    x: number
    y: number
  } | null>(null)
  const [edgeDragCurrent, setEdgeDragCurrent] = useState<{
    x: number
    y: number
  } | null>(null)
  const [edgeDragHoverNode, setEdgeDragHoverNode] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLDivElement>(null)

  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)

  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const WORLD_SIZE = 5000
  const MINIMAP_WIDTH = 192
  const MINIMAP_HEIGHT = 128

  // Calculate which world coordinates are at the center of the viewport
  const viewportCenterWorldX = (viewportSize.width / 2 - pan.x) / zoom
  const viewportCenterWorldY = (viewportSize.height / 2 - pan.y) / zoom

  // Calculate the size of the viewport in world coordinates
  const viewportWorldWidth = viewportSize.width / zoom
  const viewportWorldHeight = viewportSize.height / zoom

  // Convert to minimap coordinates
  const indicatorWidth = (viewportWorldWidth / WORLD_SIZE) * MINIMAP_WIDTH
  const indicatorHeight = (viewportWorldHeight / WORLD_SIZE) * MINIMAP_HEIGHT

  // Position the indicator so its center matches the viewport center in world space
  const indicatorCenterX = (MINIMAP_WIDTH / 2) + (viewportCenterWorldX / WORLD_SIZE) * MINIMAP_WIDTH
  const indicatorCenterY = (MINIMAP_HEIGHT / 2) + (viewportCenterWorldY / WORLD_SIZE) * MINIMAP_HEIGHT

  const indicatorX = indicatorCenterX - (indicatorWidth / 2)
  const indicatorY = indicatorCenterY - (indicatorHeight / 2)

  const moveCanvasFromMinimap = useCallback((mouseX: number, mouseY: number) => {
    if (!minimapRef.current) return
    const rect = minimapRef.current.getBoundingClientRect()

    // Get click position relative to minimap
    const localX = mouseX - rect.left
    const localY = mouseY - rect.top

    // Convert minimap position to world coordinates
    // Center of minimap is world (0, 0)
    const worldX = ((localX - MINIMAP_WIDTH / 2) / MINIMAP_WIDTH) * WORLD_SIZE
    const worldY = ((localY - MINIMAP_HEIGHT / 2) / MINIMAP_HEIGHT) * WORLD_SIZE

    // Calculate pan values to center the viewport on this world coordinate
    // We want: viewportCenter = worldCoord * zoom + pan
    // So: pan = viewportCenter - worldCoord * zoom
    const newPanX = (viewportSize.width / 2) - (worldX * zoomRef.current)
    const newPanY = (viewportSize.height / 2) - (worldY * zoomRef.current)

    setPan({ x: newPanX, y: newPanY })
  }, [viewportSize.width, viewportSize.height])

  const handleMinimapMouseDown = (e: React.MouseEvent) => {
    moveCanvasFromMinimap(e.clientX, e.clientY)

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveCanvasFromMinimap(moveEvent.clientX, moveEvent.clientY)
    }

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  useEffect(() => {
    const updateSize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Center nodes when component mounts and viewport size is known (only once)
  useEffect(() => {
    if (!hasInitializedView && viewportSize.width > 0 && viewportSize.height > 0 && nodes.length > 0) {
      // Find bounding box of all nodes
      const xCoords = nodes.map(n => n.x)
      const yCoords = nodes.map(n => n.y)
      const minX = Math.min(...xCoords)
      const maxX = Math.max(...xCoords)
      const minY = Math.min(...yCoords)
      const maxY = Math.max(...yCoords)

      // Calculate center of all nodes
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      // Calculate zoom to fit all nodes (with some padding)
      const width = maxX - minX + 800 // Add padding
      const height = maxY - minY + 800
      const zoomX = viewportSize.width / width
      const zoomY = viewportSize.height / height
      const fitZoom = Math.min(zoomX, zoomY, 1.0) // Don't zoom in more than 100%

      // Calculate pan to center the nodes
      const viewportCenterX = viewportSize.width / 2
      const viewportCenterY = viewportSize.height / 2
      const panX = viewportCenterX - (centerX * fitZoom)
      const panY = viewportCenterY - (centerY * fitZoom)

      setPan({ x: panX, y: panY })
      setZoom(fitZoom)
      setHasInitializedView(true)
    }
  }, [viewportSize.width, viewportSize.height, nodes, hasInitializedView])

  const MINOR_SPACING = 25
  const MAJOR_SPACING = 100

  const minorOpacity = Math.max(0, (zoom - 0.15) * 0.3)
  const majorOpacity = Math.max(0.04, (zoom - 0.1) * 0.4)

  const renderEdges = () => {
    return edges.map((edge, index) => {
      const source = nodes.find(n => n.id === edge.from)
      const target = nodes.find(n => n.id === edge.to)
      if (!source || !target) return null

      // Calculate start and end points based on ports if available
      const sourceWidth = source.expanded ? 600 : 400
      const targetWidth = target.expanded ? 600 : 400

      // Default to right port for source, left port for target if not specified
      const fromPort = edge.fromPort || 'right'
      const toPort = edge.toPort || 'left'

      const x1 = source.x + (fromPort === 'left' ? -sourceWidth / 2 : sourceWidth / 2)
      const y1 = source.y
      const x2 = target.x + (toPort === 'left' ? -targetWidth / 2 : targetWidth / 2)
      const y2 = target.y

      const controlPointX = x1 + (x2 - x1) / 2
      const pathData = `M ${x1} ${y1} C ${controlPointX} ${y1}, ${controlPointX} ${y2}, ${x2} ${y2}`

      return (
        <path
          key={`edge-${index}`}
          d={pathData}
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#arrowhead-edge)"
        />
      )
    })
  }

  const focusNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    setIsTransitioning(true)

    const targetZoom = 1.2
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2

    const newPanX = centerX - (node.x * targetZoom)
    const newPanY = centerY - (node.y * targetZoom)

    setZoom(targetZoom)
    setPan({ x: newPanX, y: newPanY })

    setTimeout(() => setIsTransitioning(false), 800)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isDragging = false
    let dragStart = { x: 0, y: 0 }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isDraggingNode || isDraggingEdge) return
      isDragging = true
      dragStart = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y }
      container.style.cursor = 'grabbing'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }

    const onMouseUp = () => {
      isDragging = false
      container.style.cursor = 'grab'
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()

      const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05
      const newZoom = Math.min(Math.max(zoomRef.current * scaleFactor, 0.1), 2.0)

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const newPanX = mouseX - (mouseX - panRef.current.x) * (newZoom / zoomRef.current)
      const newPanY = mouseY - (mouseY - panRef.current.y) * (newZoom / zoomRef.current)

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    container.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    container.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      container.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      container.removeEventListener("wheel", onWheel)
    }
  }, [isDraggingNode, isDraggingEdge])

  const handleAddNode = () => {
    // Count existing "New Node" nodes to generate unique title
    const newNodeCount = nodes.filter(n => n.title.startsWith("New Node")).length
    const nodeTitle = newNodeCount === 0 ? "New Node" : `New Node ${newNodeCount + 1}`

    // Calculate center position of current viewport
    const viewportCenterX = (viewportSize.width / 2 - pan.x) / zoom
    const viewportCenterY = (viewportSize.height / 2 - pan.y) / zoom

    const newNode: Node = {
      id: `node-${Date.now()}`,
      title: nodeTitle,
      type: "Concept",
      content: "Click to edit this concept node or use the prompt bar to explore related ideas...",
      x: viewportCenterX,
      y: viewportCenterY
    }

    setNodes([...nodes, newNode])
    setSelectedNodeId(newNode.id) // Auto-select the new node
  }

  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId))
    setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId))
    setSelectedNodeId(null)
  }

  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    setIsDraggingNode(nodeId)
    const worldX = (e.clientX - pan.x) / zoom
    const worldY = (e.clientY - pan.y) / zoom
    setDragOffset({ x: worldX - node.x, y: worldY - node.y })
  }

  const handleNodeDrag = (e: MouseEvent) => {
    if (!isDraggingNode) return

    const worldX = (e.clientX - pan.x) / zoom
    const worldY = (e.clientY - pan.y) / zoom

    setNodes(nodes.map(n =>
      n.id === isDraggingNode
        ? { ...n, x: worldX - dragOffset.x, y: worldY - dragOffset.y }
        : n
    ))
  }

  const handleNodeDragEnd = () => {
    setIsDraggingNode(null)
  }

  useEffect(() => {
    if (isDraggingNode) {
      window.addEventListener("mousemove", handleNodeDrag)
      window.addEventListener("mouseup", handleNodeDragEnd)
      return () => {
        window.removeEventListener("mousemove", handleNodeDrag)
        window.removeEventListener("mouseup", handleNodeDragEnd)
      }
    }
  }, [isDraggingNode, nodes, pan, zoom, dragOffset])

  const handleEditNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    setEditForm({ title: node.title, type: node.type, content: node.content })
    setIsEditingNode(nodeId)
    setSelectedNodeId(null)
  }

  const handleSaveEdit = () => {
    if (!isEditingNode || !editForm.title.trim()) return

    setNodes(nodes.map(n =>
      n.id === isEditingNode
        ? { ...n, title: editForm.title, type: editForm.type, content: editForm.content }
        : n
    ))
    setIsEditingNode(null)
    setEditForm({ title: "", type: "", content: "" })
  }

  // Node control handlers
  const handleToggleExpand = (nodeId: string) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? { ...n, expanded: !n.expanded } : n
    ))
  }

  const handleToggleInternet = (nodeId: string) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? { ...n, internetEnabled: !n.internetEnabled } : n
    ))
  }

  const handleModelChange = (nodeId: string, model: string) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? { ...n, selectedModel: model } : n
    ))
  }

  const handleFileAttach = (nodeId: string, files: FileList) => {
    const filePromises = Array.from(files).map(file => {
      return new Promise<FileAttachment>((resolve, reject) => {
        if (file.size > 5 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Max size is 5MB.`)
          reject()
          return
        }

        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            data: reader.result as string
          })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    })

    Promise.all(filePromises).then(newFiles => {
      setNodes(nodes.map(n =>
        n.id === nodeId
          ? { ...n, attachedFiles: [...(n.attachedFiles || []), ...newFiles] }
          : n
      ))
    }).catch(err => {
      console.error('Error reading files:', err)
    })
  }

  const handleRegenerate = (nodeId: string) => {
    // Show toast notification
    setToastMessage('Regenerate functionality coming soon!')
  }

  const handleBranch = (nodeId: string) => {
    setBranchingNodeId(nodeId)
  }

  const handleBranchConfirm = (count: number) => {
    if (!branchingNodeId) return

    const originalNode = nodes.find(n => n.id === branchingNodeId)
    if (!originalNode) return

    const angleStep = (2 * Math.PI) / count
    const radius = 400

    const newNodes: Node[] = []
    const newEdges: Edge[] = []

    for (let i = 0; i < count; i++) {
      const angle = angleStep * i
      const newNode: Node = {
        id: `branch-${Date.now()}-${i}`,
        title: `Branch ${i + 1}`,
        type: originalNode.type,
        content: `Branch from: ${originalNode.title}`,
        x: originalNode.x + Math.cos(angle) * radius,
        y: originalNode.y + Math.sin(angle) * radius,
        selectedModel: originalNode.selectedModel,
        internetEnabled: originalNode.internetEnabled
      }
      newNodes.push(newNode)
      newEdges.push({ from: branchingNodeId, to: newNode.id })
    }

    setNodes([...nodes, ...newNodes])
    setEdges([...edges, ...newEdges])
    setBranchingNodeId(null)
    setToastMessage(`Created ${count} branch nodes!`)
  }

  const handleMenuClick = (nodeId: string, event?: React.MouseEvent) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    // Calculate screen position of the node
    const screenX = node.x * zoom + pan.x
    const screenY = node.y * zoom + pan.y

    // Position menu to the right of the node controls
    setMenuPosition({
      x: screenX + 220, // Offset to the right of node (node is 400px wide, centered)
      y: screenY - 150  // Align with top of node
    })
    setMenuNodeId(nodeId)
  }

  const handleCopyNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      const copyNode: Node = {
        ...node,
        id: `copy-${Date.now()}`,
        x: node.x + 50,
        y: node.y + 50
      }
      setNodes([...nodes, copyNode])
      setToastMessage('Node copied!')
    }
  }

  const handleConvertToImage = (nodeId: string) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? { ...n, type: 'Image' } : n
    ))
    setToastMessage('Converted to Image node!')
  }

  const handleConvertToNote = (nodeId: string) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? {
        ...n,
        type: 'Note',
        content: n.content === 'Click to edit this concept node or use the prompt bar to explore related ideas...'
          ? 'Click to edit this sticky note...'
          : n.content
      } : n
    ))
    setToastMessage('Converted to Note!')
  }

  const handlePromptSubmit = (nodeId: string, prompt: string) => {
    // Add user message to chat history
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    }

    // Simulate LLM response (placeholder for real LLM integration)
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: `This is a simulated response to: "${prompt}". LLM integration coming soon!`,
      timestamp: Date.now() + 1000
    }

    setNodes(nodes.map(n =>
      n.id === nodeId
        ? {
            ...n,
            chatHistory: [...(n.chatHistory || []), userMessage, assistantMessage]
          }
        : n
    ))
  }

  const handleContentEdit = (nodeId: string, newContent: string) => {
    setNodes(nodes.map(n =>
      n.id === nodeId ? { ...n, content: newContent } : n
    ))
    setToastMessage('Content updated!')
  }

  // Edge creation handlers
  const handlePortMouseDown = (nodeId: string, port: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation()

    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    // Calculate world coordinates of the port
    // Port is at the left or right edge of the node, vertically centered
    const nodeWidth = node.expanded ? 600 : 400
    const portOffsetX = port === 'left' ? -nodeWidth / 2 : nodeWidth / 2
    const portWorldX = node.x + portOffsetX
    const portWorldY = node.y

    setEdgeDragStart({
      nodeId,
      port,
      x: portWorldX,
      y: portWorldY
    })
    setEdgeDragCurrent({ x: portWorldX, y: portWorldY })
    setIsDraggingEdge(true)
  }

  const handleEdgeDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingEdge || !edgeDragStart) return

    // Convert screen coordinates to world coordinates
    const worldX = (e.clientX - pan.x) / zoom
    const worldY = (e.clientY - pan.y) / zoom

    setEdgeDragCurrent({ x: worldX, y: worldY })

    // Check if hovering over any node's port
    // For now, we'll implement full hover detection in the next phase
    // Simple detection: check if mouse is near any node center
    let hoveredNode: string | null = null
    for (const node of nodes) {
      if (node.id === edgeDragStart.nodeId) continue // Skip source node

      const dx = worldX - node.x
      const dy = worldY - node.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // If within 250px of node center, consider it hovered
      if (distance < 250) {
        hoveredNode = node.id
        break
      }
    }
    setEdgeDragHoverNode(hoveredNode)
  }, [isDraggingEdge, edgeDragStart, nodes, pan.x, pan.y, zoom])

  const handleEdgeDragEnd = useCallback((e: MouseEvent) => {
    if (!isDraggingEdge || !edgeDragStart) return

    const worldX = (e.clientX - pan.x) / zoom
    const worldY = (e.clientY - pan.y) / zoom

    // Check if we're hovering over a target node
    if (edgeDragHoverNode) {
      // Create edge to existing node
      const targetNode = nodes.find(n => n.id === edgeDragHoverNode)
      if (targetNode) {
        // Determine target port (opposite of drag direction)
        const targetPort: 'left' | 'right' = worldX < targetNode.x ? 'left' : 'right'

        // Prevent duplicate edges
        const exists = edges.find(e =>
          e.from === edgeDragStart.nodeId && e.to === edgeDragHoverNode
        )

        if (!exists) {
          const newEdge: Edge = {
            from: edgeDragStart.nodeId,
            to: edgeDragHoverNode,
            fromPort: edgeDragStart.port,
            toPort: targetPort
          }
          setEdges([...edges, newEdge])
          setToastMessage('Edge created!')
        }
      }
    } else {
      // Create new node at release position
      const newNode: Node = {
        id: `auto-${Date.now()}`,
        title: "New Node",
        type: "Concept",
        content: "Click to edit this concept node or use the prompt bar to explore related ideas...",
        x: worldX,
        y: worldY,
        selectedModel: "gpt-4"
      }

      const newEdge: Edge = {
        from: edgeDragStart.nodeId,
        to: newNode.id,
        fromPort: edgeDragStart.port,
        toPort: 'left'
      }

      setNodes([...nodes, newNode])
      setEdges([...edges, newEdge])
      setToastMessage('New node created!')
    }

    // Clear drag state
    setIsDraggingEdge(false)
    setEdgeDragStart(null)
    setEdgeDragCurrent(null)
    setEdgeDragHoverNode(null)
  }, [isDraggingEdge, edgeDragStart, edgeDragHoverNode, nodes, edges, pan.x, pan.y, zoom])

  // Effect for edge drag event listeners
  useEffect(() => {
    if (isDraggingEdge) {
      window.addEventListener("mousemove", handleEdgeDragMove)
      window.addEventListener("mouseup", handleEdgeDragEnd)
      return () => {
        window.removeEventListener("mousemove", handleEdgeDragMove)
        window.removeEventListener("mouseup", handleEdgeDragEnd)
      }
    }
  }, [isDraggingEdge, handleEdgeDragMove, handleEdgeDragEnd])

  // Keyboard shortcut to cancel edge drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingEdge) {
        setIsDraggingEdge(false)
        setEdgeDragStart(null)
        setEdgeDragCurrent(null)
        setEdgeDragHoverNode(null)
        setToastMessage('Edge creation cancelled')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDraggingEdge])

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans">
      <Navigation />

      <div ref={containerRef} className="fixed inset-0 bg-[#020202] overflow-hidden cursor-grab">

        {/* Grid */}
        <div
          className={`absolute inset-0 pointer-events-none ${isTransitioning ? 'transition-[background-position,background-size] duration-[1000ms] ease-[cubic-bezier(0.2,1,0.3,1)]' : ''}`}
          style={{
            backgroundImage: `
              radial-gradient(circle at 1.5px 1.5px, rgba(255, 255, 255, ${majorOpacity}) 1.5px, transparent 0),
              radial-gradient(circle at 1px 1px, rgba(255, 255, 255, ${minorOpacity}) 1px, transparent 0)
            `,
            backgroundSize: `${MAJOR_SPACING * zoom}px ${MAJOR_SPACING * zoom}px, ${MINOR_SPACING * zoom}px ${MINOR_SPACING * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)] bg-gradient-to-b from-black/20 via-transparent to-black/40" />

        {/* Content Layer */}
        <div
          className={`absolute inset-0 ${isTransitioning ? 'transition-all duration-[1000ms] ease-[cubic-bezier(0.2,1,0.3,1)]' : ''}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: 'transform',
          }}
        >
          {/* SVG Layer for Edges */}
          <svg
            className="absolute overflow-visible pointer-events-none"
            style={{ width: '10000px', height: '10000px' }}
            viewBox="0 0 10000 10000"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3, 0 6"
                  fill="rgba(16, 185, 129, 0.8)"
                />
              </marker>
              <marker
                id="arrowhead-edge"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3, 0 6"
                  fill="rgba(255, 255, 255, 0.6)"
                />
              </marker>
              <marker
                id="arrowhead-drag"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3, 0 6"
                  fill="rgba(255, 255, 255, 0.8)"
                />
              </marker>
            </defs>
            {renderEdges()}

            {/* Temporary drag line */}
            {isDraggingEdge && edgeDragStart && edgeDragCurrent && (
              <line
                x1={edgeDragStart.x}
                y1={edgeDragStart.y}
                x2={edgeDragCurrent.x}
                y2={edgeDragCurrent.y}
                stroke={edgeDragHoverNode ? "rgba(16, 185, 129, 0.8)" : "rgba(255, 255, 255, 0.8)"}
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd={edgeDragHoverNode ? "url(#arrowhead)" : "url(#arrowhead-drag)"}
              />
            )}
          </svg>

          {/* Nodes Layer */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute pointer-events-auto cursor-move"
              style={{ left: `${node.x}px`, top: `${node.y}px`, transform: 'translate(-50%, -50%)' }}
              onMouseDown={(e) => handleNodeDragStart(node.id, e)}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <ConceptNode
                nodeId={node.id}
                title={node.title}
                type={node.type}
                content={node.content}
                isSelected={selectedNodeId === node.id}
                expanded={node.expanded}
                internetEnabled={node.internetEnabled}
                selectedModel={node.selectedModel || "gpt-4"}
                attachedFiles={node.attachedFiles || []}
                chatHistory={node.chatHistory || []}
                onToggleExpand={() => handleToggleExpand(node.id)}
                onToggleInternet={() => handleToggleInternet(node.id)}
                onModelChange={(model) => handleModelChange(node.id, model)}
                onFileAttach={(files) => handleFileAttach(node.id, files)}
                onRegenerate={() => handleRegenerate(node.id)}
                onBranch={() => handleBranch(node.id)}
                onMenuClick={() => handleMenuClick(node.id)}
                onPortMouseDown={(port, e) => handlePortMouseDown(node.id, port, e)}
                isDraggingEdge={isDraggingEdge}
                isValidDropTarget={edgeDragHoverNode === node.id}
                onPromptSubmit={(prompt) => handlePromptSubmit(node.id, prompt)}
                onContentEdit={(newContent) => handleContentEdit(node.id, newContent)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Minimap */}
      <div
        ref={minimapRef}
        onMouseDown={handleMinimapMouseDown}
        className="fixed bottom-6 right-6 w-48 h-32 rounded-xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md overflow-hidden shadow-2xl z-20 cursor-crosshair group"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_0)] [background-size:8px_8px]" />

        {/* Node markers on minimap */}
        {nodes.map((node) => {
          const nodeMinimapX = (MINIMAP_WIDTH / 2) + (node.x / WORLD_SIZE * MINIMAP_WIDTH)
          const nodeMinimapY = (MINIMAP_HEIGHT / 2) + (node.y / WORLD_SIZE * MINIMAP_HEIGHT)

          return (
            <div
              key={`minimap-${node.id}`}
              className="absolute w-1.5 h-1.5 bg-emerald-400 rounded-full opacity-60"
              style={{
                left: `${nodeMinimapX}px`,
                top: `${nodeMinimapY}px`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          )
        })}

        {/* Viewport indicator */}
        <div
          className="absolute border border-white/30 bg-white/5 transition-[width,height] duration-75 ease-out group-hover:bg-white/10 group-active:border-white/50"
          style={{
            width: `${indicatorWidth}px`,
            height: `${indicatorHeight}px`,
            left: `${indicatorX}px`,
            top: `${indicatorY}px`
          }}
        />

        {/* Center marker */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Toolbar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-1 items-center px-3 py-2 rounded-2xl border border-white/10 bg-[#121212]/90 backdrop-blur-2xl shadow-2xl">
        <div className="flex items-center px-2 py-1 gap-3 border-r border-white/5 mr-2">
          <button
            className="text-white/40 hover:text-white transition-colors disabled:opacity-10 disabled:cursor-not-allowed"
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.1))}
            disabled={zoom <= 0.1}
            title="Zoom Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zoom-out">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" x2="16.65" y1="21" y2="16.65"></line>
              <line x1="8" x2="14" y1="11" y2="11"></line>
            </svg>
          </button>

          <span className="text-[11px] font-mono text-white/70 w-9 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>

          <button
            className="text-white/40 hover:text-white transition-colors disabled:opacity-10 disabled:cursor-not-allowed"
            onClick={() => setZoom(Math.min(zoom + 0.1, 2.0))}
            disabled={zoom >= 2.0}
            title="Zoom In"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zoom-in">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" x2="16.65" y1="21" y2="16.65"></line>
              <line x1="11" x2="11" y1="8" y2="14"></line>
              <line x1="8" x2="14" y1="11" y2="11"></line>
            </svg>
          </button>
        </div>

        <button
          onClick={handleAddNode}
          className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-[11px] font-bold rounded-lg hover:bg-gray-200 transition-all uppercase tracking-tight"
        >
          <Plus className="w-4 h-4" />
          Add Node
        </button>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 ml-2 border-l border-white/5 pl-3 text-white/40 hover:text-white text-[11px] font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workspace
        </button>
      </div>

      {/* Edit Node Modal */}
      {isEditingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md border border-white/10 bg-[#0a0a0a] rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Edit Node</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Type</label>
                <input
                  type="text"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Content</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30 min-h-[100px]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-white text-black py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditingNode(null)
                    setEditForm({ title: "", type: "", content: "" })
                  }}
                  className="flex-1 bg-white/5 border border-white/10 py-2 rounded-lg font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {branchingNodeId && (
        <BranchModal
          onConfirm={handleBranchConfirm}
          onCancel={() => setBranchingNodeId(null)}
        />
      )}

      {/* Node Menu */}
      {menuNodeId && menuPosition && (
        <div className="fixed inset-0 z-50" onClick={() => {
          setMenuNodeId(null)
          setMenuPosition(null)
        }}>
          <NodeMenu
            onEdit={() => handleEditNode(menuNodeId)}
            onDelete={() => handleDeleteNode(menuNodeId)}
            onCopy={() => handleCopyNode(menuNodeId)}
            onConvertToImage={() => handleConvertToImage(menuNodeId)}
            onConvertToNote={() => handleConvertToNote(menuNodeId)}
            onClose={() => {
              setMenuNodeId(null)
              setMenuPosition(null)
            }}
            position={menuPosition}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  )
}
