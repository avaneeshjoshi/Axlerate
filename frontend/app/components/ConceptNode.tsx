"use client"

import React from 'react'

interface NodeProps {
  title: string
  type: string
  content: string
  isSelected?: boolean
}

export default function ConceptNode({ title, type, content, isSelected }: NodeProps) {
  return (
    <div className={`
      bg-[#0a0a0a] border-2 rounded-xl flex flex-col shadow-2xl transition-all duration-200 w-[400px]
      ${isSelected ? 'border-white' : 'border-gray-800 hover:border-gray-600'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-[#141414] rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{type}</span>
          <span className="text-[10px] text-white/20">•</span>
          <span className="text-[10px] text-gray-500 font-medium">Axlerate v1.0</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 min-h-[100px]">
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          {content}
        </p>
      </div>

      {/* Chorus-style Input Area (Visual Only) */}
      <div className="p-3 border-t border-gray-800 bg-[#1a1a1a] rounded-b-xl">
        <div className="flex gap-2 opacity-50">
          <div className="flex-1 h-8 rounded-md bg-[#252525] border border-gray-700 px-3 flex items-center">
            <span className="text-xs text-gray-500">Related concepts explored...</span>
          </div>
          <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><path d="M5 12h14m-7-7v14"/></svg>
          </div>
        </div>
      </div>
    </div>
  )
}

