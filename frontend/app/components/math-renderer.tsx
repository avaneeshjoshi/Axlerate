"use client"

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  content: string
}

export function MathRenderer({ content }: MathRendererProps) {
  return (
    <div className="math-content max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Header 2: Main sections of the proof
          h2: ({ children }) => (
            <h2 className="text-white font-bold text-lg mb-4 mt-8 first:mt-0 font-sans tracking-tight flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
              {children}
            </h2>
          ),
          // Header 3: Sub-steps or Axiom names
          h3: ({ children }) => (
            <h3 className="text-white font-semibold text-sm mb-2 mt-6 font-mono uppercase tracking-[0.2em] opacity-80">
              {children}
            </h3>
          ),
          // Paragraphs: High readability neutral text
          p: ({ children }) => (
            <p className="text-neutral-400 leading-7 text-sm mb-5 font-sans">
              {children}
            </p>
          ),
          // Emphasis: Pure white for key concepts
          strong: ({ children }) => (
            <strong className="text-white font-semibold">{children}</strong>
          ),
          // Lists: Styled as "Nodes" in the graph
          ul: ({ children }) => (
            <ul className="space-y-3 mb-6 list-none pl-1">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-3 text-sm text-neutral-400">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/50 flex-shrink-0" />
              <span>{children}</span>
            </li>
          ),
          // Blockquotes: Used for Axioms or Definitions
          blockquote: ({ children }) => (
            <div className="my-6 pl-6 border-l border-emerald-500/30 bg-emerald-500/5 py-4 pr-4 rounded-r-lg italic text-neutral-300">
              {children}
            </div>
          ),
          // Inline Code: For variables like T, V, or W
          code: ({ children }) => (
            <code className="bg-neutral-800/50 text-emerald-400 px-1.5 py-0.5 rounded font-mono text-[13px] border border-white/5">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
