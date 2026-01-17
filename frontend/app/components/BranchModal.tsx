"use client"

import React, { useState } from "react"
import { X } from "lucide-react"

interface BranchModalProps {
  onConfirm: (count: number) => void
  onCancel: () => void
}

export default function BranchModal({ onConfirm, onCancel }: BranchModalProps) {
  const [customCount, setCustomCount] = useState("")
  const [selectedCount, setSelectedCount] = useState<number | null>(null)

  const quickCounts = [1, 2, 3, 4, 5]

  const handleConfirm = () => {
    const count = selectedCount || parseInt(customCount)
    if (count && count >= 1 && count <= 20) {
      onConfirm(count)
    }
  }

  const selectQuickCount = (count: number) => {
    setSelectedCount(count)
    setCustomCount("")
  }

  const handleCustomChange = (value: string) => {
    setCustomCount(value)
    setSelectedCount(null)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md border border-white/10 bg-[#0a0a0a] rounded-2xl shadow-2xl animate-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-xl font-bold text-white">Branch Node</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60 hover:text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm text-gray-400 mb-4">
              How many branches would you like to create?
            </p>

            {/* Quick Select Buttons */}
            <div className="flex gap-2 mb-4">
              {quickCounts.map((count) => (
                <button
                  key={count}
                  onClick={() => selectQuickCount(count)}
                  className={`flex-1 py-3 rounded-lg border-2 font-semibold transition-all ${
                    selectedCount === count
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">
                Or enter custom amount (1-20)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={customCount}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="Enter number..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Preview */}
          {(selectedCount || customCount) && (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-gray-500 mb-2">Preview</p>
              <p className="text-sm text-white">
                Will create <span className="font-bold text-emerald-400">{selectedCount || customCount}</span> new branch nodes in a circular pattern
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/10">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCount && (!customCount || parseInt(customCount) < 1 || parseInt(customCount) > 20)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Branches
          </button>
        </div>
      </div>
    </div>
  )
}
