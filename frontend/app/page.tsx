"use client"

import React, { useState } from 'react'
import { DotLottiePlayer } from '@dotlottie/react-player'
import Navigation from "./components/navigation"
import HeroSection from "./components/hero"

export default function Home() {
  const [isAnimationFinished, setIsAnimationFinished] = useState(false)
  const [shouldRenderOverlay, setShouldRenderOverlay] = useState(true)

  const lottieUrl = "https://fmanavehsizxybddlxtr.supabase.co/storage/v1/object/sign/Axlerate/Axlerate.lottie?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZTc3ZjM5NS02NTdlLTQyMTMtOWQ4NS0zMTgyNWJlYzJlMzkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBeGxlcmF0ZS9BeGxlcmF0ZS5sb3R0aWUiLCJpYXQiOjE3NjYxMjQ3MjYsImV4cCI6MTc5NzY2MDcyNn0.KeAguL89ctoQbyl0GD_t5GutT4BYpxkyGfXdKq6tEXc"

  // Standard completion with the "Hold" beat
  const handleAnimationComplete = () => {
    setTimeout(() => {
      setIsAnimationFinished(true)
      setTimeout(() => setShouldRenderOverlay(false), 700)
    }, 800)
  }

  // Instant skip (bypasses the 800ms hold)
  const skipIntro = () => {
    setIsAnimationFinished(true)
    setTimeout(() => setShouldRenderOverlay(false), 700)
  }

  return (
    <div className="relative min-h-screen bg-[#050505]">
      {/* 1. THE HERO SECTION */}
      {/* It's always 'there', but we fade it in as the splash fades out */}
      <main className={`transition-opacity duration-1000 ${isAnimationFinished ? 'opacity-100' : 'opacity-0'}`}>
        <Navigation />
        <HeroSection />
      </main>

      {/* 2. SPLASH OVERLAY */}
      {shouldRenderOverlay && (
        <div 
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-700 ease-in-out ${
            isAnimationFinished ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Full-screen container - matches 1920x1080 Figma design */}
          <div className="w-screen h-screen">
            <DotLottiePlayer
              src={lottieUrl}
              autoplay
              loop={false}
              style={{ width: '100%', height: '100%' }}
              onEvent={(event) => {
                if (event === 'complete') handleAnimationComplete()
              }}
            />
          </div>

          {/* SKIP INTRO BUTTON - Styled like a Concept Map Node */}
          <button
            onClick={skipIntro}
            className="absolute bottom-12 px-5 py-2 rounded-full 
                       border border-white/10 bg-white/5 
                       backdrop-blur-md text-white/40 text-xs tracking-widest uppercase
                       hover:bg-white hover:text-black hover:border-white
                       transition-all duration-300 z-[110] cursor-pointer"
          >
            Skip Intro
          </button>
        </div>
      )}
    </div>
  )
}