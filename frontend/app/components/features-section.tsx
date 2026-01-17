"use client";

import { Terminal, Sparkles, Workflow, Shield } from "lucide-react";

export default function FeaturesSection() {
  return (
    <section className="w-full bg-[#09090b] relative">
      <div className="container mx-auto max-w-7xl">
        
        {/* --- THE FEATURE GRID --- */}
        {/* 2 Columns: Left Features | Right Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-dashed border-white/10">
          
          {/* --- LEFT COLUMN --- */}
          <div className="flex flex-col border-r border-dashed border-white/10">
            
            {/* Block 1: Clean, powerful APIs */}
            <div className="flex-1 p-8 md:p-10 border-b border-dashed border-white/10 flex flex-col justify-start group hover:bg-white/[0.02] transition-colors">
               <div className="mb-4 text-white/80 group-hover:text-white transition-colors">
                  <Terminal className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-lg font-medium text-white mb-2">Clean, powerful APIs</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Integrate your systems instantly with well-documented, developer-first API endpoints.
                  </p>
               </div>
            </div>

            {/* Block 2: AI-enhanced insights */}
            <div className="flex-1 p-8 md:p-10 border-b border-dashed border-white/10 flex flex-col justify-start group hover:bg-white/[0.02] transition-colors">
               <div className="mb-4 text-white/80 group-hover:text-white transition-colors">
                  <Sparkles className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-lg font-medium text-white mb-2">AI-enhanced insights</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Analyze performance, detect issues, and optimize reliability with intelligent, real-time metrics.
                  </p>
               </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN --- */}
          <div className="flex flex-col border-l border-dashed border-white/10">
            
            {/* Block 3: Automation tools built in */}
            <div className="flex-1 p-8 md:p-10 border-b border-dashed border-white/10 flex flex-col justify-start group hover:bg-white/[0.02] transition-colors">
               <div className="mb-4 text-white/80 group-hover:text-white transition-colors">
                  <Workflow className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-lg font-medium text-white mb-2">Automation tools built in</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Create workflows, triggers, and background jobs without external services or extra infrastructure.
                  </p>
               </div>
            </div>

            {/* Block 4: Enterprise-level control */}
            <div className="flex-1 p-8 md:p-10 border-b border-dashed border-white/10 flex flex-col justify-start group hover:bg-white/[0.02] transition-colors">
               <div className="mb-4 text-white/80 group-hover:text-white transition-colors">
                  <Shield className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-lg font-medium text-white mb-2">Enterprise-level control</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Manage roles, permissions, compliance, and security — all from a single dashboard.
                  </p>
               </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
