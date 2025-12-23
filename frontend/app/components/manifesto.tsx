"use client"

import React from "react"
import Navigation from "./navigation"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function Manifesto() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black font-sans pb-40">
      <Navigation />
      
      {/* Central Content Container */}
      <div className="max-w-2xl mx-auto px-6 pt-40 flex flex-col items-center text-center">
        
        {/* Label - Subtle drift up animation */}
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.3em] mb-12"
        >
          Manifesto v1.0
        </motion.p>

        {/* Main Headline with Full White Glow */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-16 leading-[1.1] [text-wrap:balance]">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              textShadow: "0 0 25px rgba(255,255,255,0.15)"
            }}
            transition={{ duration: 1 }}
            className="text-white"
          >
            Education is
          </motion.span> 
          <br />
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              textShadow: [
                "0 0 20px rgba(255,255,255,0)",
                "0 0 30px rgba(255,255,255,0.25)",
                "0 0 20px rgba(255,255,255,0)"
              ]
            }}
            transition={{ 
              opacity: { duration: 1.5, delay: 0.5 },
              textShadow: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="text-neutral-500 italic relative"
          >
            Non-Linear.
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1, delay: 1.2, ease: "circOut" }}
              className="absolute -bottom-2 left-0 h-px bg-neutral-800"
            />
          </motion.span>
        </h1>

        {/* Narrative Section */}
        <div className="space-y-12 text-lg md:text-xl text-neutral-400 leading-relaxed">
          <p>
            The human brain is a web of billions of connections. <br />
            Yet, we are forced to learn in straight lines.
          </p>

          <p className="text-white font-medium">
            Chapters. Playlists. Modules. <br />
            If there's a faster way to build intuition — we're building it.
          </p>

          <p>
            We built <span className="text-white bg-neutral-900 px-2 py-0.5 rounded">Axlerate</span> because knowledge isn't a ladder. <br />
            It's a city. It's a map. It's a graph.
          </p>

          <div className="py-12 flex flex-col items-center space-y-4">
            <div className="w-px h-24 bg-gradient-to-b from-transparent via-neutral-800 to-transparent" />
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.2em]">Axioms of Learning</span>
          </div>

          {/* Principles with Enhanced Scale Hover */}
          <div className="space-y-16 text-white w-full">
            <PrincipleItem 
              id="1.1" 
              content="Focus on the speed of connection, not the depth of memory." 
            />
            <PrincipleItem 
              id="1.2" 
              content="Visualize the edges. See the bridge between Calculus and Architecture." 
            />
            <PrincipleItem 
              id="1.3" 
              content="A spatial operating system for the mind. Take back your focus." 
            />
          </div>

          {/* Quote Section - Styled like an Axler Definition */}
          <div className="py-12 border-t border-neutral-900 mt-20 flex flex-col items-center">
            <p className="text-white text-lg tracking-tight font-medium mb-10 max-w-md">
              <span className="text-neutral-600 mr-2 italic">Definition.</span> 
              "Every solution starts with the right definition."
            </p>
            
            <Link 
              href="/workspace" 
              className="inline-flex items-center gap-3 px-8 py-4 border border-neutral-800 rounded-full text-white hover:bg-white hover:text-black hover:shadow-[0_0_50px_rgba(255,255,255,0.15)] transition-all duration-500 group"
            >
              <span className="text-xs font-mono uppercase tracking-widest">Start Proving</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Academic Acknowledgements */}
          <div className="pt-20 text-left border-t border-neutral-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Inspiration</p>
                <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                  Deeply influenced by Sheldon Axler's <span className="text-neutral-300">Linear Algebra Done Right</span> (LADR). The pursuit of clean logic and intuitive proofs is at the core of this system.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Special Thanks</p>
                <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                  Special gratitude to Professor Ken Ribet at UC Berkeley for fostering the mathematical rigor and intellectual curiosity that inspired the architecture of Axlerate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-8 left-0 w-full px-12 flex justify-between items-center opacity-40 pointer-events-none md:pointer-events-auto">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em]">Axlerate © 2025 — Berkeley, CA</p>
        <div className="flex gap-6 text-[9px] font-mono uppercase tracking-widest">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
        </div>
      </footer>
    </div>
  )
}

function PrincipleItem({ id, content }: { id: string, content: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group space-y-3 cursor-default transition-all duration-500"
    >
      <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] flex items-center justify-center gap-3">
        <span className="text-neutral-800 group-hover:text-white transition-colors duration-700">§</span>
        <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors duration-500">
          Axiom {id}
        </span>
      </h2>
      <p className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-500 group-hover:text-white transition-all duration-500 [text-wrap:balance]">
        {content}
      </p>
    </motion.div>
  )
}

