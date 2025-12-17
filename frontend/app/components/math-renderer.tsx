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
    <div className="math-content max-w-none text-neutral-400 leading-relaxed text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-white font-semibold text-lg mb-2 mt-4 font-sans">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-white font-semibold text-base mb-2 mt-3 font-sans">
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong className="text-white font-semibold">{children}</strong>
          ),
          p: ({ children }) => (
            <p className="text-neutral-400 leading-relaxed text-sm mb-4 font-sans">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
