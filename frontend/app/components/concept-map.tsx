"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Navigation from "./navigation"
import ConceptNode from "./ConceptNode"

// DATA: Your pre-existing knowledge graph
const NODES = [
  { id: '1', title: "Calculus", type: "Core Subject", content: "The mathematical study of continuous change.", x: 2500, y: 2500 },
  { id: '2', title: "Derivative", type: "Definition", content: "The rate of change of a function with respect to a variable.", x: 3000, y: 2300 },
  { id: '3', title: "Integral", type: "Definition", content: "Represents the area under a curve or the accumulation of quantities.", x: 3000, y: 2700 },
]

const EDGES = [
  { from: '1', to: '2' },
  { from: '1', to: '3' }
]

export default function ConceptMap() {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.8) // Start slightly zoomed out
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLDivElement>(null)
  const activeItemRef = useRef<HTMLButtonElement>(null)
  
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)

  // Sync refs to ensure the event listeners always have access to the latest state
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // --- Minimap Calibration ---
  const WORLD_SIZE = 5000 // The "virtual" size the minimap represents
  const MINIMAP_WIDTH = 192 // w-48 = 12rem = 192px
  const MINIMAP_HEIGHT = 128 // h-32 = 8rem = 128px

  // Calculate indicator dimensions
  // We divide the viewport size by the zoom to see how much "world space" is visible
  const indicatorWidth = (viewportSize.width / zoom / WORLD_SIZE) * MINIMAP_WIDTH
  const indicatorHeight = (viewportSize.height / zoom / WORLD_SIZE) * MINIMAP_HEIGHT

  // Calculate indicator position
  // The center of the minimap is considered (0,0)
  const indicatorX = (MINIMAP_WIDTH / 2) - (pan.x / zoom / WORLD_SIZE * MINIMAP_WIDTH) - (indicatorWidth / 2)
  const indicatorY = (MINIMAP_HEIGHT / 2) - (pan.y / zoom / WORLD_SIZE * MINIMAP_HEIGHT) - (indicatorHeight / 2)

  // --- INTERACTIVE MINIMAP LOGIC ---
  const moveCanvasFromMinimap = useCallback((mouseX: number, mouseY: number) => {
    if (!minimapRef.current) return
    const rect = minimapRef.current.getBoundingClientRect()
    
    // Calculate click position relative to minimap center
    const localX = mouseX - rect.left
    const localY = mouseY - rect.top
    
    // Inverse math: Convert minimap pixel to world coordinate, then to pan state
    const newPanX = ((MINIMAP_WIDTH / 2) - localX) * (WORLD_SIZE * zoomRef.current / MINIMAP_WIDTH)
    const newPanY = ((MINIMAP_HEIGHT / 2) - localY) * (WORLD_SIZE * zoomRef.current / MINIMAP_HEIGHT)

    setPan({ x: newPanX, y: newPanY })
  }, [])

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

  // --- Main Canvas Logic ---
  useEffect(() => {
    const updateSize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K, Ctrl+K, or the "/" key
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      
      if (e.key === '/') {
        // Only trigger if the user isn't already typing in an input
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setIsSearchOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // --- Chorus Calibration Constants ---
  const MINOR_SPACING = 25 
  const MAJOR_SPACING = 100

  // Refined Opacity: Optimized for the 10% - 200% range
  const minorOpacity = Math.max(0, (zoom - 0.15) * 0.3)
  const majorOpacity = Math.max(0.04, (zoom - 0.1) * 0.4)

  // --- Logic for drawing "Chorus" style curves ---
  const renderEdges = () => {
    return EDGES.map((edge, index) => {
      const source = NODES.find(n => n.id === edge.from)
      const target = NODES.find(n => n.id === edge.to)
      if (!source || !target) return null

      // Start at the right side of the source, end at the left side of the target
      const x1 = source.x + 200 // Half of node width
      const y1 = source.y
      const x2 = target.x - 200
      const y2 = target.y

      // This creates the "S" curve look
      const controlPointX = x1 + (x2 - x1) / 2
      const pathData = `M ${x1} ${y1} C ${controlPointX} ${y1}, ${controlPointX} ${y2}, ${x2} ${y2}`

      return (
        <path
          key={`edge-${index}`}
          d={pathData}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1.5"
          fill="none"
        />
      )
    })
  }

  // --- Focus Node Function ---
  const focusNode = (nodeId: string) => {
    const node = NODES.find(n => n.id === nodeId)
    if (!node) return

    setIsTransitioning(true)
    
    const targetZoom = 1.2
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    
    const newPanX = centerX - (node.x * targetZoom)
    const newPanY = centerY - (node.y * targetZoom)

    setZoom(targetZoom)
    setPan({ x: newPanX, y: newPanY })

    // CHANGED: Lowered from 1000 to 800 for snappier state clearing
    setTimeout(() => setIsTransitioning(false), 800)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isDragging = false
    let dragStart = { x: 0, y: 0 }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
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
      
      // Smooth scaling factor
      const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05
      
      // STRICT ZOOM LIMIT: 0.1 (10%) to 2.0 (200%)
      const newZoom = Math.min(Math.max(zoomRef.current * scaleFactor, 0.1), 2.0)
      
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Calculate new pan to keep the point under the cursor stationary
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
  }, [])

  // --- Search Filtering Logic ---
  const filteredNodes = NODES.filter(node => 
    node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Reset selection when the search term changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm])

  // Auto-scroll the active search result into view
  useEffect(() => {
    if (isSearchOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex, isSearchOpen])

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans">
      <Navigation />

      <div ref={containerRef} className="fixed inset-0 bg-[#020202] overflow-hidden cursor-grab">
        
        {/* 1. THE GRID (Static dot size, dynamic distance) */}
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

        {/* 2. THE VIGNETTE (Atmospheric depth) */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)] bg-gradient-to-b from-black/20 via-transparent to-black/40" />

        {/* 3. CONTENT LAYER (SVG Edges + HTML Nodes) */}
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
            {renderEdges()}
          </svg>

          {/* Nodes Layer */}
          {NODES.map((node) => (
            <div 
              key={node.id}
              className="absolute pointer-events-auto"
              style={{ left: `${node.x}px`, top: `${node.y}px`, transform: 'translate(-50%, -50%)' }}
            >
              <ConceptNode 
                title={node.title} 
                type={node.type} 
                content={node.content} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* 4. INTERACTIVE MINIMAP (Light Gray / White) */}
      <div 
        ref={minimapRef}
        onMouseDown={handleMinimapMouseDown}
        className="fixed bottom-6 right-6 w-48 h-32 rounded-xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md overflow-hidden shadow-2xl z-20 cursor-crosshair group"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_0)] [background-size:8px_8px]" />
        
        {/* Gray Viewport Indicator */}
        <div 
          className="absolute border border-white/30 bg-white/5 transition-[width,height] duration-75 ease-out group-hover:bg-white/10 group-active:border-white/50" 
          style={{ 
            width: `${indicatorWidth}px`, 
            height: `${indicatorHeight}px`, 
            left: `${indicatorX}px`, 
            top: `${indicatorY}px` 
          }} 
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/20 rounded-full" />
      </div>

      {/* 5. TOOLBAR with Search Icon */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-1 items-center px-3 py-2 rounded-2xl border border-white/10 bg-[#121212]/90 backdrop-blur-2xl shadow-2xl">
        <div className="flex items-center px-2 py-1 gap-3 border-r border-white/5 mr-2">
          {/* ZOOM OUT BUTTON */}
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

          {/* ZOOM IN BUTTON */}
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

        <button className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-[11px] font-bold rounded-lg hover:bg-gray-200 transition-all uppercase tracking-tight">
          Add Node
        </button>

        <div className="flex items-center gap-3 ml-3 pl-3 border-l border-white/5 text-white/40">
          <button 
            className="flex items-center gap-2 hover:text-white transition-colors group" 
            onClick={() => setIsSearchOpen(true)}
            title="Search Nodes (⌘K)"
          >
            {/* Search Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            
            {/* The Shortcut Hint */}
            <span className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-medium text-white/30 group-hover:text-white/60 group-hover:border-white/20 transition-all">
              <span className="text-[11px]">⌘</span>K
            </span>
          </button>
        </div>
      </div>

      {/* 6. SEARCH MODAL (COMMAND PALETTE) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => { setIsSearchOpen(false); setSearchTerm(""); }} />
          
          <div className="relative w-full max-w-xl border border-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)] rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center px-4 py-4 border-b border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 mr-3">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input 
                autoFocus
                className="bg-transparent border-none outline-none text-white text-lg w-full placeholder:text-white/20"
                placeholder="Search concepts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedIndex(prev => Math.min(prev + 1, filteredNodes.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedIndex(prev => Math.max(prev - 1, 0))
                  } else if (e.key === 'Enter' && filteredNodes.length > 0) {
                    e.preventDefault()
                    focusNode(filteredNodes[selectedIndex].id)
                    setIsSearchOpen(false)
                    setSearchTerm("")
                  } else if (e.key === 'Escape') {
                    setIsSearchOpen(false)
                    setSearchTerm("")
                  }
                }}
              />
              <div className="flex gap-1">
                <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/40 font-mono">↑↓</kbd>
                <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/40 font-mono">↵</kbd>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {filteredNodes.length > 0 ? (
                <>
                  <div className="px-3 py-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    {searchTerm ? 'Search Results' : 'Suggested Concepts'}
                  </div>
                  {filteredNodes.map((node, index) => (
                    <button 
                      key={node.id}
                      ref={selectedIndex === index ? activeItemRef : null}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => {
                        focusNode(node.id)
                        setIsSearchOpen(false)
                        setSearchTerm("")
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150 text-left border ${
                        selectedIndex === index 
                          ? 'bg-white/10 border-white/10' 
                          : 'bg-transparent border-transparent'
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-medium transition-colors ${
                          selectedIndex === index ? 'text-emerald-400' : 'text-white'
                        }`}>
                          {node.title}
                        </div>
                        <div className="text-xs text-white/40">{node.type}</div>
                      </div>
                      {selectedIndex === index && (
                        <span className="text-[10px] font-bold text-emerald-500 animate-pulse">PRESS ENTER</span>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <div className="py-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mx-auto mb-3">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                  </svg>
                  <p className="text-white/40 text-sm">No concepts found for "{searchTerm}"</p>
                  <p className="text-white/20 text-xs mt-1">Try searching for "Calculus" or "Derivative"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

