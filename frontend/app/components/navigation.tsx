import Image from "next/image";
import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 w-full z-40">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.75)] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="relative w-24 h-6 hover:opacity-80 transition-opacity">
              <Image
                src="https://fmanavehsizxybddlxtr.supabase.co/storage/v1/object/sign/Axlerate/logo2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZTc3ZjM5NS02NTdlLTQyMTMtOWQ4NS0zMTgyNWJlYzJlMzkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBeGxlcmF0ZS9sb2dvMi5wbmciLCJpYXQiOjE3NjU5NjQxMDAsImV4cCI6MTc5NzUwMDEwMH0.VSj6KlQ0ln1XfjOLdaER3gJsQ0Bit3IPCC7f85tB8PI"
                alt="AXLERATE"
                fill
                className="object-contain"
                priority
              />
            </Link>
          </div>
          <div className="hidden md:flex gap-10 text-sm font-mono uppercase tracking-wider text-[#e4e4e7]">
            <Link 
              href="/workspace" 
              className="hover:opacity-80 transition-opacity"
            >
              Workspace
            </Link>
            <Link 
              href="#output" 
              className="hover:opacity-80 transition-opacity"
            >
              Concept Map
            </Link>
            <Link 
              href="#system" 
              className="hover:opacity-80 transition-opacity"
            >
              Manifesto
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-[#e4e4e7]">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span>AXLERATE</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
