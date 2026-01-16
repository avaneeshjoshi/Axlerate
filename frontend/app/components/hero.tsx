"use client"

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import ParticleSphereAnimation from "./ParticleSphere";

const HeroSection = () => {
  const router = useRouter();

  const handleStartProving = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    router.push('/workspace');
  };

  return (
    <section className="min-h-screen flex flex-col md:px-12 border-neutral-900 border-b pt-20 pr-6 pl-6 relative justify-end z-10 bg-black pb-20">
      <div className="max-w-7xl mx-auto w-full z-10">
        {/* Particle Sphere Animation */}
        <div className="mb-8 flex justify-center">
          <ParticleSphereAnimation shouldStart={true} />
        </div>

        <div className="mb-12 flex justify-center">
          <div className="rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)] px-6 py-3 inline-block">
            <p className="text-xs font-mono text-[#e4e4e7] uppercase tracking-widest">
              Linear Algebra Done Right
            </p>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tighter leading-[0.9] text-white uppercase mb-16 font-sans text-center">
          <span>Practice</span> <span className="text-neutral-600">Builds</span> <span>Intuition</span>
        </h1>

        <div className="flex flex-col md:flex-row justify-between items-end border-t border-neutral-800 pt-8 w-full">
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
