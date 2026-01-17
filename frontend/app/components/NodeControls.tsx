"use client"

import React, { useRef } from "react"
import { Maximize2, Minimize2, Globe, Paperclip, RotateCw, GitBranch, MoreVertical } from "lucide-react"

interface NodeControlsProps {
  nodeId: string
  expanded: boolean
  internetEnabled: boolean
  selectedModel: string
  fileCount: number
  onToggleExpand: () => void
  onToggleInternet: () => void
  onModelChange: (model: string) => void
  onFileAttach: (files: FileList) => void
  onRegenerate: () => void
  onBranch: () => void
  onMenuClick: () => void
}

export default function NodeControls({
  expanded,
  internetEnabled,
  selectedModel,
  fileCount,
  onToggleExpand,
  onToggleInternet,
  onModelChange,
  onFileAttach,
  onRegenerate,
  onBranch,
  onMenuClick
}: NodeControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileAttach(e.target.files)
    }
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 rounded-t-xl p-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Model Dropdown */}
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white hover:bg-white/20 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400"
      >
        <option value="gpt-4">GPT-4</option>
        <option value="claude-sonnet">Claude Sonnet</option>
        <option value="claude-opus">Claude Opus</option>
        <option value="gpt-3.5">GPT-3.5</option>
      </select>

      <div className="flex-1" />

      {/* Expand/Collapse Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleExpand()
        }}
        title={expanded ? "Minimize" : "Expand"}
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
      >
        {expanded ? (
          <Minimize2 className="w-4 h-4 text-white/70 hover:text-white" />
        ) : (
          <Maximize2 className="w-4 h-4 text-white/70 hover:text-white" />
        )}
      </button>

      {/* Internet Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleInternet()
        }}
        title={internetEnabled ? "Internet Enabled" : "Internet Disabled"}
        className={`p-1.5 hover:bg-white/20 rounded transition-colors ${
          internetEnabled ? "bg-emerald-500/20" : ""
        }`}
      >
        <Globe
          className={`w-4 h-4 ${
            internetEnabled ? "text-emerald-400" : "text-white/70"
          } hover:text-white`}
        />
      </button>

      {/* File Attachment Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleFileClick()
        }}
        title="Attach Files"
        className="p-1.5 hover:bg-white/20 rounded transition-colors relative"
      >
        <Paperclip className="w-4 h-4 text-white/70 hover:text-white" />
        {fileCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {fileCount}
          </span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Regenerate Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRegenerate()
        }}
        title="Regenerate"
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
      >
        <RotateCw className="w-4 h-4 text-white/70 hover:text-white" />
      </button>

      {/* Branch Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onBranch()
        }}
        title="Branch"
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
      >
        <GitBranch className="w-4 h-4 text-white/70 hover:text-white" />
      </button>

      {/* Three-Dot Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onMenuClick()
        }}
        title="More Options"
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-white/70 hover:text-white" />
      </button>
    </div>
  )
}
