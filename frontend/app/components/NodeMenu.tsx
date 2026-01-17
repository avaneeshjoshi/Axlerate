"use client"

import React, { useEffect, useRef } from "react"
import { Trash2, Copy, Image as ImageIcon, StickyNote, Edit2 } from "lucide-react"

interface NodeMenuProps {
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  onConvertToImage: () => void
  onConvertToNote: () => void
  onClose: () => void
  position?: { x: number; y: number }
}

export default function NodeMenu({
  onEdit,
  onDelete,
  onCopy,
  onConvertToImage,
  onConvertToNote,
  onClose,
  position
}: NodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] w-56 border border-white/10 bg-[#0a0a0a] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
      style={position ? { left: `${position.x}px`, top: `${position.y}px` } : {}}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Actions Section */}
      <div className="p-2">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-3 py-2">
          Actions
        </div>
        <button
          onClick={() => handleAction(onEdit)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-500/20 transition-colors text-left group"
        >
          <Edit2 className="w-4 h-4 text-blue-400/60 group-hover:text-blue-400" />
          <span className="text-sm text-white/80 group-hover:text-white">Edit Node</span>
        </button>
        <button
          onClick={() => handleAction(onCopy)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-left group"
        >
          <Copy className="w-4 h-4 text-white/60 group-hover:text-white" />
          <span className="text-sm text-white/80 group-hover:text-white">Copy Node</span>
        </button>
        <button
          onClick={() => handleAction(onDelete)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/20 transition-colors text-left group"
        >
          <Trash2 className="w-4 h-4 text-red-400/60 group-hover:text-red-400" />
          <span className="text-sm text-red-400/80 group-hover:text-red-400">Delete Node</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-2" />

      {/* Convert Section */}
      <div className="p-2">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-3 py-2">
          Convert To
        </div>
        <button
          onClick={() => handleAction(onConvertToImage)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-purple-500/20 transition-colors text-left group"
        >
          <ImageIcon className="w-4 h-4 text-purple-400/60 group-hover:text-purple-400" />
          <span className="text-sm text-white/80 group-hover:text-white">Image Node</span>
        </button>
        <button
          onClick={() => handleAction(onConvertToNote)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-yellow-500/20 transition-colors text-left group"
        >
          <StickyNote className="w-4 h-4 text-yellow-400/60 group-hover:text-yellow-400" />
          <span className="text-sm text-white/80 group-hover:text-white">Post-it Note</span>
        </button>
      </div>
    </div>
  )
}
