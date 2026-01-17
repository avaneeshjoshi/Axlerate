"use client"

import React, { useState, useEffect, useRef } from 'react'
import NodeControls from './NodeControls'
import { Globe } from 'lucide-react'

interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  data: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface NodeProps {
  nodeId: string
  title: string
  type: string
  content: string
  isSelected?: boolean
  expanded?: boolean
  internetEnabled?: boolean
  selectedModel?: string
  attachedFiles?: FileAttachment[]
  chatHistory?: ChatMessage[]
  onToggleExpand?: () => void
  onToggleInternet?: () => void
  onModelChange?: (model: string) => void
  onFileAttach?: (files: FileList) => void
  onRegenerate?: () => void
  onBranch?: () => void
  onMenuClick?: () => void
  onPortMouseDown?: (port: 'left' | 'right', e: React.MouseEvent) => void
  isDraggingEdge?: boolean
  isValidDropTarget?: boolean
  onPromptSubmit?: (prompt: string) => void
  onContentEdit?: (newContent: string) => void
}

export default function ConceptNode({
  nodeId,
  title,
  type,
  content,
  isSelected,
  expanded = false,
  internetEnabled = false,
  selectedModel = "gpt-4",
  attachedFiles = [],
  chatHistory = [],
  onToggleExpand = () => {},
  onToggleInternet = () => {},
  onModelChange = () => {},
  onFileAttach = () => {},
  onRegenerate = () => {},
  onBranch = () => {},
  onMenuClick = () => {},
  onPortMouseDown = () => {},
  isDraggingEdge = false,
  isValidDropTarget = false,
  onPromptSubmit = () => {},
  onContentEdit = () => {}
}: NodeProps) {
  const [promptInput, setPromptInput] = useState("")
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Sync editedContent when content prop changes
  useEffect(() => {
    setEditedContent(content)
  }, [content])

  // Auto-scroll to bottom when chat history updates
  useEffect(() => {
    if (chatHistory.length > 0 && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory])

  // Determine node styling based on type
  const getNodeTheme = () => {
    switch (type.toLowerCase()) {
      case 'image':
        return {
          bg: 'bg-purple-950/30',
          border: 'border-purple-500/50',
          headerBg: 'bg-purple-900/30',
          accent: 'text-purple-400'
        }
      case 'note':
        return {
          bg: 'bg-yellow-950/30',
          border: 'border-yellow-600/50',
          headerBg: 'bg-yellow-900/30',
          accent: 'text-yellow-400'
        }
      default:
        return {
          bg: 'bg-[#0a0a0a]',
          border: 'border-gray-800',
          headerBg: 'bg-[#141414]',
          accent: 'text-gray-400'
        }
    }
  }

  const theme = getNodeTheme()
  const width = expanded ? 'w-[600px]' : 'w-[400px]'
  const minHeight = expanded ? 'min-h-[200px]' : 'min-h-[100px]'
  const isNote = type.toLowerCase() === 'note'

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (promptInput.trim()) {
      onPromptSubmit(promptInput)
      setPromptInput("")
    }
  }

  const handleContentSave = () => {
    onContentEdit(editedContent)
    setIsEditingContent(false)
  }

  return (
    <div className={`
      ${theme.bg} border-2 rounded-xl flex flex-col shadow-2xl transition-all duration-300 ${width} group relative
      ${isSelected ? 'border-white' : `${theme.border} hover:border-gray-600`}
      hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]
    `}>
      {/* Connection Ports - Show on Hover */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        data-port="left"
        data-node-id={nodeId}
      >
        <button
          onMouseDown={(e) => {
            e.stopPropagation()
            onPortMouseDown('left', e)
          }}
          className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
            isValidDropTarget
              ? 'bg-emerald-500 border-emerald-300 scale-125 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]'
              : 'bg-white border-white hover:bg-emerald-400 hover:border-emerald-300 hover:scale-110 hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]'
          }`}
          title="Connect from here"
        />
      </div>

      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        data-port="right"
        data-node-id={nodeId}
      >
        <button
          onMouseDown={(e) => {
            e.stopPropagation()
            onPortMouseDown('right', e)
          }}
          className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
            isValidDropTarget
              ? 'bg-emerald-500 border-emerald-300 scale-125 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]'
              : 'bg-white border-white hover:bg-emerald-400 hover:border-emerald-300 hover:scale-110 hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]'
          }`}
          title="Connect from here"
        />
      </div>

      {/* Node Controls - Shows on Hover */}
      <NodeControls
        nodeId="temp"
        expanded={expanded}
        internetEnabled={internetEnabled}
        selectedModel={selectedModel}
        fileCount={attachedFiles.length}
        onToggleExpand={onToggleExpand}
        onToggleInternet={onToggleInternet}
        onModelChange={onModelChange}
        onFileAttach={onFileAttach}
        onRegenerate={onRegenerate}
        onBranch={onBranch}
        onMenuClick={onMenuClick}
      />

      {/* Header */}
      <div className={`flex items-center justify-between p-3 border-b border-gray-800 ${theme.headerBg} rounded-t-xl`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] ${theme.accent} font-bold uppercase tracking-widest`}>{type}</span>
          {selectedModel && (
            <>
              <span className="text-[10px] text-white/20">•</span>
              <span className="text-[10px] text-gray-500 font-medium">{selectedModel}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {internetEnabled && (
            <Globe className="w-3 h-3 text-emerald-400 animate-pulse" title="Internet Enabled" />
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
        </div>
      </div>

      {/* Body */}
      <div className={`p-4 ${minHeight} flex flex-col`}>
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>

        {isNote && isEditingContent ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onBlur={handleContentSave}
            autoFocus
            className={`w-full bg-transparent text-gray-400 ${expanded ? 'text-base' : 'text-sm'} leading-relaxed border border-gray-600 rounded p-2 focus:outline-none focus:border-white/50 resize-none`}
            rows={4}
          />
        ) : isNote ? (
          <p
            className={`text-gray-400 ${expanded ? 'text-base' : 'text-sm'} leading-relaxed cursor-text`}
            onClick={() => setIsEditingContent(true)}
            onDoubleClick={() => setIsEditingContent(true)}
          >
            {content}
          </p>
        ) : chatHistory.length > 0 ? (
          /* Chat History */
          <div className="flex-1 overflow-y-auto space-y-2 mb-2 max-h-[300px] pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-white/10 text-white'
                    : 'bg-white/5 text-gray-300'
                }`}>
                  <p className="text-xs leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        ) : (
          <p className={`text-gray-400 ${expanded ? 'text-base' : 'text-sm'} leading-relaxed`}>
            {content}
          </p>
        )}

        {/* Attached Files Display */}
        {attachedFiles.length > 0 && (
          <div className="mt-3 space-y-1">
            {attachedFiles.slice(0, 3).map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded px-2 py-1"
              >
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-[10px]">{(file.size / 1024).toFixed(1)}KB</span>
              </div>
            ))}
            {attachedFiles.length > 3 && (
              <div className="text-xs text-gray-600">
                +{attachedFiles.length - 3} more files
              </div>
            )}
          </div>
        )}
      </div>

      {/* LLM Prompt Input Area - Hidden for Notes */}
      {!isNote && (
        <div className="px-3 py-2 border-t border-gray-800 bg-[#1a1a1a] rounded-b-xl">
          <form onSubmit={handlePromptSubmit} className="flex gap-2 items-center">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Ask about related concepts..."
              className="flex-1 h-7 rounded-md bg-[#252525] border border-gray-700 px-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              className="w-7 h-7 rounded-md bg-white hover:bg-gray-200 transition-colors flex items-center justify-center flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

