"use client"

import React, { useEffect } from "react"
import { CheckCircle, XCircle, Info, X } from "lucide-react"

interface ToastProps {
  message: string
  type?: "success" | "error" | "info"
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />
  }

  const colors = {
    success: "border-emerald-500/50 bg-emerald-950/50",
    error: "border-red-500/50 bg-red-950/50",
    info: "border-blue-500/50 bg-blue-950/50"
  }

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] border ${colors[type]} rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-300`}>
      <div className="flex items-center gap-3 px-4 py-3 min-w-[300px] max-w-[500px]">
        {icons[type]}
        <span className="text-sm text-white flex-1">{message}</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-white/60 hover:text-white" />
        </button>
      </div>
    </div>
  )
}
