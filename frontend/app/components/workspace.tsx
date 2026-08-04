"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ArrowUpRight, Network, ChevronDown, Download, Copy, Check, ExternalLink, Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import { MathRenderer } from "./math-renderer"
import Navigation from "./navigation"
import GraphView from "./graph-view"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  verification?: "lean-verified" | "ai-reviewed" | "unverified"
  leanStatement?: string
  leanProof?: string
  latexDocument?: string
}

// Rough .tex -> markdown transform so the editor preview can reuse MathRenderer.
function texToPreview(src: string): string {
  let title = ""
  const titleMatch = src.match(/\\title\{([\s\S]*?)\}/)
  if (titleMatch) title = `## ${titleMatch[1]}\n\n`

  let body = src
  const begin = body.indexOf("\\begin{document}")
  const end = body.indexOf("\\end{document}")
  if (begin !== -1 && end !== -1) body = body.slice(begin + "\\begin{document}".length, end)

  body = body
    .replace(/\\maketitle/g, "")
    .replace(/\\section\*?\{(.*?)\}/g, "## $1")
    .replace(/\\subsection\*?\{(.*?)\}/g, "### $1")
    .replace(/\\begin\{theorem\}/g, "\n**Theorem.** ")
    .replace(/\\end\{theorem\}/g, "\n")
    .replace(/\\begin\{proof\}/g, "\n**Proof.** ")
    .replace(/\\end\{proof\}/g, " $\\blacksquare$\n")
    .replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (_m, c) => "\n```\n" + c.trim() + "\n```\n")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, c) => `$$${c}$$`)
    .replace(/\\textbf\{(.*?)\}/g, "**$1**")
    .replace(/\\emph\{(.*?)\}/g, "*$1*")
    .replace(/\\texttt\{(.*?)\}/g, "`$1`")
    .replace(/\\vspace\{.*?\}/g, "")
    .replace(/\\noindent/g, "")
    .replace(/\\begin\{small\}/g, "")
    .replace(/\\end\{small\}/g, "")
    .replace(/~/g, " ")

  return title + body.trim()
}

function LatexPanel({ initialSource }: { initialSource: string }) {
  const [source, setSource] = useState(initialSource)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const download = () => {
    const blob = new Blob([source], { type: "application/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "axlerate-proof.tex"
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const openInOverleaf = () => {
    const form = document.createElement("form")
    form.method = "POST"
    form.action = "https://www.overleaf.com/docs"
    form.target = "_blank"
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "snip"
    input.value = source
    form.appendChild(input)
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  const secondaryButton =
    "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:border-white/25 hover:text-white active:scale-[0.97] transition-all duration-150"

  return (
    <details className="group mt-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-3.5 list-none [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 transition-colors group-open:text-white group-hover:text-neutral-200">
          LaTeX Export
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/10">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <button
            onClick={download}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150"
          >
            <Download className="w-3.5 h-3.5" />
            Download .tex
          </button>
          <button onClick={copy} className={secondaryButton}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={openInOverleaf} className={secondaryButton}>
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Overleaf
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`${secondaryButton} ${showPreview ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15 hover:border-emerald-400/50 hover:text-emerald-200" : ""}`}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Hide preview" : "Preview"}
          </button>
        </div>
        <div className="mx-5 mb-5 rounded-xl border border-white/10 bg-black/40 transition-colors focus-within:border-white/25">
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            className="h-72 w-full resize-y rounded-xl bg-transparent px-4 py-3.5 font-mono text-[13px] leading-6 text-neutral-200 focus:outline-none"
          />
        </div>
        {showPreview && (
          <div className="mx-5 mb-5 rounded-xl border border-white/10 bg-black/40 px-5 py-4">
            <p className="mb-4 text-[10px] font-mono uppercase tracking-widest text-neutral-500">Preview · approximate</p>
            <MathRenderer content={texToPreview(source)} />
          </div>
        )}
      </div>
    </details>
  )
}

function VerificationBadge({ verification }: { verification?: Message["verification"] }) {
  if (!verification) return null
  const styles = {
    "lean-verified": "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
    "ai-reviewed": "border-amber-500/50 bg-amber-500/10 text-amber-400",
    "unverified": "border-neutral-700 bg-neutral-800/50 text-neutral-400",
  }[verification]
  const label = {
    "lean-verified": "✓ Lean verified",
    "ai-reviewed": "AI reviewed",
    "unverified": "Unverified",
  }[verification]
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${styles}`}>
      {label}
    </span>
  )
}

const examples = [
  "Prove that the null space of a linear map is a subspace.",
  "What is the dimension of the space of 2x2 matrices?",
  "Explain the Spectral Theorem for self-adjoint operators.",
]

export default function Workspace() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showGraphView, setShowGraphView] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Typewriter placeholder animation state
  const [placeholder, setPlaceholder] = useState("")
  const [exampleIndex, setExampleIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [charIndex, setCharIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  const resetTypewriter = () => {
    setCharIndex(0)
    setExampleIndex(0)
    setIsDeleting(false)
    setPlaceholder("")
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    const MAX_HEIGHT = 400 // Set your expansion limit here

    if (textarea) {
      textarea.style.height = 'auto'
      
      // Calculate new height but cap it at MAX_HEIGHT
      const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT)
      textarea.style.height = `${Math.max(80, newHeight)}px`

      // Enable scrolling only if content exceeds the max height
      if (textarea.scrollHeight > MAX_HEIGHT) {
        textarea.style.overflowY = 'auto'
      } else {
        textarea.style.overflowY = 'hidden'
      }
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // Typewriter placeholder effect
  useEffect(() => {
    // Don't animate if user is typing OR if the box is focused
    if (input.trim() || isFocused) {
      setPlaceholder("") // Clear placeholder while focused
      return
    }
    
    const currentExample = examples[exampleIndex] || ""
    const examplesLength = 3 // Fixed length to avoid dependency issues
    
    const type = () => {
      if (!isDeleting) {
        // Typing phase
        if (charIndex < currentExample.length) {
          setPlaceholder(currentExample.substring(0, charIndex + 1))
          setCharIndex(prev => prev + 1)
        } else {
          // Pause at the end before deleting
          setTimeout(() => setIsDeleting(true), 2000)
        }
      } else {
        // Deleting phase
        if (charIndex > 0) {
          setPlaceholder(currentExample.substring(0, charIndex - 1))
          setCharIndex(prev => prev - 1)
        } else {
          setIsDeleting(false)
          setExampleIndex((prev) => (prev + 1) % examplesLength)
        }
      }
    }
    
    // Adjust speeds: typing is slower, deleting is faster
    const timer = setTimeout(type, isDeleting ? 30 : 70)
    return () => clearTimeout(timer)
  }, [charIndex, isDeleting, exampleIndex, input, isFocused])

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
    // Reset textarea height after clearing
    setTimeout(() => adjustTextareaHeight(), 0)
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
        // Try to extract error details from the response
        let errorDetails = `HTTP error! status: ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorDetails = errorData.error
            if (errorData.details) {
              errorDetails += ` - ${errorData.details}`
            }
          }
        } catch (e) {
          // If response is not JSON, use the status text
          errorDetails = `HTTP error! status: ${response.status} ${response.statusText}`
        }
        throw new Error(errorDetails)
      }

      const data = await response.json()
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.proof || "Sorry, I couldn't generate a proof for that question.",
        verification: data.verification,
        leanStatement: data.lean_statement || undefined,
        leanProof: data.lean_proof || undefined,
        latexDocument: data.latex_document || undefined,
      }
      
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Error fetching proof:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: error instanceof Error 
          ? `Error: ${error.message}. Please ensure the backend server is running on port 8000.`
          : "Sorry, there was an error processing your question. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // If graph view is active, render it instead
  if (showGraphView) {
    return <GraphView onBack={() => setShowGraphView(false)} messages={messages} />
  }

  return (
    <div className="min-h-screen text-white relative">
      {/* Background Video and Layers */}
      <div className="fixed inset-0 w-full h-full overflow-hidden z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src={process.env.NEXT_PUBLIC_VIDEO_URL || "https://fmanavehsizxybddlxtr.supabase.co/storage/v1/object/sign/Axlerate/hero.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZTc3ZjM5NS02NTdlLTQyMTMtOWQ4NS0zMTgyNWJlYzJlMzkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBeGxlcmF0ZS9oZXJvLm1wNCIsImlhdCI6MTc2NTk2MDI3MSwiZXhwIjoxNzk3NDk2MjcxfQ.-yS7WdjXYD9zpTn2SwgULZ1Mb8_RVrS-RMfYZG6f9-A"}
            type="video/mp4"
          />
        </video>

        <div className="absolute inset-y-0 left-0 w-3/4 z-10 pointer-events-none bg-gradient-to-r from-[#050505] via-[#050505]/95 to-transparent" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80 z-10" />
      </div>

      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(120,119,198,0.3), rgba(255,255,255,0))",
        }}
      />

      <div className="relative z-10">
        <Navigation />

      {/* Main Content */}
      <main className={`mx-auto max-w-7xl px-6 md:px-12 pb-12 ${messages.length === 0 ? 'flex flex-col items-center pt-[20vh] min-h-[calc(100vh-80px)]' : 'pt-20'}`}>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="mb-8 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "text-neutral-400" : ""}>
                {message.role === "user" ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
                    <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">Question</p>
                    <p className="text-sm text-neutral-300 leading-relaxed">{message.content}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.55)] p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Solution</p>
                      <VerificationBadge verification={message.verification} />
                    </div>
                    <MathRenderer content={message.content} />
                    {message.leanProof && message.leanStatement && (
                      <details className="group mt-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-3.5 list-none [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 transition-colors group-open:text-white group-hover:text-neutral-200">
                              Lean 4 Proof
                            </span>
                          </span>
                          <ChevronDown className="w-4 h-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-white/10 px-5 py-4">
                          <pre className="overflow-x-auto font-mono text-[13px] leading-6">
                            <span className="text-neutral-400">{message.leanStatement}</span>
                            {"\n"}
                            <span className="text-white">
                              {message.leanProof
                                .split("\n")
                                .map((line) => `  ${line}`)
                                .join("\n")}
                            </span>
                          </pre>
                          <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                            Verified by the Lean 4 compiler
                          </p>
                        </div>
                      </details>
                    )}
                    {message.latexDocument && (
                      <LatexPanel initialSource={message.latexDocument} />
                    )}
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
          <div className="flex flex-col items-center w-full max-w-2xl gap-4">
            {/* Logo */}
            <div className="text-center flex-shrink-0">
              <div className="relative w-80 h-20 mx-auto" style={{
                filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.4))'
              }}>
                <Image
                  src="https://fmanavehsizxybddlxtr.supabase.co/storage/v1/object/sign/Axlerate/Group%201.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZTc3ZjM5NS02NTdlLTQyMTMtOWQ4NS0zMTgyNWJlYzJlMzkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBeGxlcmF0ZS9Hcm91cCAxLnBuZyIsImlhdCI6MTc2NjA1MjAxMSwiZXhwIjoxNzk3NTg4MDExfQ.to80jBgdVY7ZVgh7jrAdRlQUKHvUoq87qHymeGi0h7U"
                  alt="AXLERATE"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="relative w-full">
              <div className="rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)] transition-all focus-within:border-white/20">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setInput(e.target.value)
                    adjustTextareaHeight()
                  }}
                  onFocus={() => {
                    setIsFocused(true)
                    resetTypewriter()
                  }}
                  onBlur={() => {
                    setIsFocused(false)
                    resetTypewriter()
                  }}
                  placeholder={isFocused ? "" : placeholder}
                  className="min-h-[80px] w-full resize-none border-0 bg-transparent px-6 py-4 text-sm text-white placeholder:text-white/30 focus:outline-none leading-relaxed transition-[height] duration-200 ease-in-out"
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                />
                <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
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

            {/* Graph View Button - Empty State */}
            <button
              onClick={() => setShowGraphView(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 bg-[#0a0a0a] hover:bg-[#121212] hover:border-white/20 transition-all duration-300 group"
            >
              <Network className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
              <span className="text-sm text-neutral-400 group-hover:text-white transition-colors font-medium">
                Switch to Graph View
              </span>
            </button>
          </div>
        )}

        {/* Input Area - when messages exist */}
        {messages.length > 0 && (
          <>
            <form onSubmit={handleSubmit} className="relative">
              <div className="rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)] transition-all focus-within:border-white/20">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setInput(e.target.value)
                    adjustTextareaHeight()
                  }}
                  onFocus={() => {
                    setIsFocused(true)
                    resetTypewriter()
                  }}
                  onBlur={() => {
                    setIsFocused(false)
                    resetTypewriter()
                  }}
                  placeholder={isFocused ? "" : placeholder}
                  className="min-h-[80px] w-full resize-none border-0 bg-transparent px-6 py-4 text-sm text-white placeholder:text-white/30 focus:outline-none leading-relaxed transition-[height] duration-200 ease-in-out"
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                />
                <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
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

            {/* Graph View Button - With Messages State */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setShowGraphView(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 bg-[#0a0a0a] hover:bg-[#121212] hover:border-white/20 transition-all duration-300 group"
              >
                <Network className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                <span className="text-sm text-neutral-400 group-hover:text-white transition-colors font-medium">
                  Switch to Graph View
                </span>
              </button>
            </div>
          </>
        )}
      </main>
      </div>
    </div>
  )
}
