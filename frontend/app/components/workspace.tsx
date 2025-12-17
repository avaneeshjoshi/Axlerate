"use client"

import type React from "react"

import { useState } from "react"
import { ArrowUpRight } from "lucide-react"
import Image from "next/image"
import { MathRenderer } from "./math-renderer"
import Navigation from "./navigation"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function Workspace() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    const question = input.trim()
    setInput("")
    setIsLoading(true)

    try {
      // Call the Next.js API route which proxies to FastAPI backend
      const response = await fetch('/api/question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.proof || "Sorry, I couldn't generate a proof for that question.",
      }
      
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Error fetching proof:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, there was an error processing your question. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navigation />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 md:px-12 pt-32 pb-12">
        {/* Messages */}
        {messages.length > 0 && (
          <div className="mb-8 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "text-neutral-400" : ""}>
                {message.role === "user" ? (
                  <div className="rounded-lg border border-neutral-800 bg-[#0a0a0a] p-6">
                    <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">QUESTION</p>
                    <p className="text-sm text-neutral-400 leading-relaxed">{message.content}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-neutral-800 bg-gradient-to-br from-[#0a0a0a] to-[#050505] p-8">
                    <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-4">SOLUTION</p>
                    <MathRenderer content={message.content} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="mb-8">
            <div className="rounded-lg border border-neutral-800 bg-gradient-to-br from-[#0a0a0a] to-[#050505] p-8">
              <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-4">THINKING...</p>
              <div className="flex gap-2">
                <div className="h-2 w-2 rounded-full bg-neutral-600 animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-neutral-600 animate-pulse [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-neutral-600 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && (
          <div className="mb-12 text-center">
            <div className="inline-block">
              <div className="mb-4 mx-auto flex items-center justify-center">
                <div className="relative w-40 h-10" style={{
                  filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.2))'
                }}>
                  <Image
                    src="https://fmanavehsizxybddlxtr.supabase.co/storage/v1/object/sign/Axlerate/logo2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZTc3ZjM5NS02NTdlLTQyMTMtOWQ4NS0zMTgyNWJlYzJlMzkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBeGxlcmF0ZS9sb2dvMi5wbmciLCJpYXQiOjE3NjU5NjQxMDAsImV4cCI6MTc5NzUwMDEwMH0.VSj6KlQ0ln1XfjOLdaER3gJsQ0Bit3IPCC7f85tB8PI"
                    alt="AXLERATE"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-white font-sans">Ask a Question</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">Get step-by-step proofs and explanations</p>
            </div>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="rounded-lg border border-neutral-800 bg-[#0a0a0a] transition-all focus-within:border-neutral-700">
            <textarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              placeholder="Enter your question or problem..."
              className="min-h-[120px] w-full resize-none border-0 bg-transparent px-6 py-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none leading-relaxed"
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <div className="flex items-center justify-between border-t border-neutral-800 px-6 py-4">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Press Enter to send, Shift+Enter for new line</p>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="group flex items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 border border-neutral-700 rounded-full flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all duration-300">
                  <ArrowUpRight className="w-5 h-5 text-white group-hover:text-black transition-colors" />
                </div>
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
