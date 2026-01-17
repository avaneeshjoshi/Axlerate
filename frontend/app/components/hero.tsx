"use client"

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AsciiBrain from "./AsciiBrain";
import ParticleSphereAnimation from "./ParticleSphereAnimation";

const HeroSection = () => {
  const router = useRouter();

  const handleStartProving = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    router.push('/workspace');
  };

  const text = "Prove the unknown.";
  const words = text.split(" ");

  // Define the animation variants
  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.18, delayChildren: 0.04 * i },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        damping: 14,
        stiffness: 80,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
      filter: "blur(20px)",
    },
  };

  return (
    <section className="min-h-screen flex flex-col md:px-12 border-neutral-900 border-b pt-20 pr-6 pl-6 relative justify-end z-10 bg-[#0a0a0a] pb-20">
      <div className="max-w-7xl mx-auto w-full z-10 mt-32">
        {/* Particle Sphere Animation */}
        <div className="mb-0 flex justify-center">
          <ParticleSphereAnimation />
        </div>

        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)] px-6 py-3 inline-block">
            <p className="text-xs font-mono text-[#e4e4e7] uppercase tracking-widest">
              AI FOR RESEARCH ACCELERATION
            </p>
          </div>
        </div>

        {/* Updated H1 with Motion */}
        <motion.h1 
          className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tighter leading-[0.9] text-white mb-8 font-sans text-center overflow-hidden"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {words.map((word, index) => (
            <motion.span 
              variants={child} 
              key={index} 
              className="inline-block mr-[0.25em] last:mr-0"
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>
        <p className="text-base md:text-xl text-neutral-400 text-center mb-16 max-w-3xl mx-auto">
          Axlerate solves complex problems across your research workflow with zero hallucinations, mathematical certainty, and total collaborative control.
        </p>

        <div className="border-t border-neutral-800 w-full mb-16"></div>

        {/* ASCII Brain */}
        <div className="mb-6 flex justify-center">
          <AsciiBrain />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-end border-t border-neutral-800 pt-8 w-full mt-[60vh]">
          <div className="max-w-md text-sm text-neutral-400 leading-relaxed mb-8 md:mb-0">
          Every solution starts with the right definition. We construct complete, Axler-style proofs with correct logic and clean LaTeX, helping you build intuition for proof-based mathematics rather than just copying what to write.
          </div>

          <button
            onClick={handleStartProving}
            className="group flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 border border-neutral-700 rounded-full flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all duration-300">
              <ArrowUpRight className="w-5 h-5 text-white group-hover:text-black transition-colors" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest group-hover:translate-x-2 transition-transform duration-300 text-white">
              Start Proving
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
