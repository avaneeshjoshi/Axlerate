import React from "react";
import { ArrowUpRight } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="min-h-screen flex flex-col md:px-12 border-neutral-900 border-b pt-20 pr-6 pl-6 relative justify-center z-10">
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
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

      <div className="max-w-7xl mx-auto w-full z-10">
        <div className="mb-12 overflow-hidden">
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            Linear Algebra Done Right
          </p>
        </div>

        <h1 className="text-6xl md:text-8xl lg:text-9xl font-semibold tracking-tighter leading-[0.9] text-white uppercase mb-16 font-sans">
          <span className="block">
            Practice
          </span>
          <span className="block text-neutral-600">
            Builds
          </span>
          <span className="block">
            Intuition
          </span>
        </h1>

        <div className="flex flex-col md:flex-row justify-between items-end border-t border-neutral-800 pt-8 w-full">
          <div className="max-w-md text-sm text-neutral-400 leading-relaxed mb-8 md:mb-0">
          Every solution starts with the right definition. We construct complete, Axler-style proofs with correct logic and clean LaTeX, helping you build intuition for proof-based mathematics rather than just copying what to write.
          </div>

          <button className="group flex items-center gap-4 cursor-pointer">
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
