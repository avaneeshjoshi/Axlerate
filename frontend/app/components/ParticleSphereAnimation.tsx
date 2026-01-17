"use client";

import React, { useEffect, useRef } from "react";

interface ParticleSphereProps {
  count?: number;
  radius?: number;
  color?: string;
}

const ParticleSphereAnimation: React.FC<ParticleSphereProps> = ({
  count = 600, // Reduced slightly for better line performance
  radius = 180,
  color = "#ffffff",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    let cx = width / 2;
    let cy = height / 2;

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleResize = () => {
      width = canvas.parentElement?.offsetWidth || window.innerWidth;
      height = canvas.parentElement?.offsetHeight || 600;
      canvas.width = width;
      canvas.height = height;
      cx = width / 2;
      cy = height / 2;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Normalize mouse to -1 to 1
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / height - 0.5) * 2;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    handleResize();

    // --- SETUP PARTICLES ---
    // We use a purely local coordinate system (0,0,0 is center of sphere)
    const particles: any[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;

      // The destination (Sphere)
      const tx = Math.cos(theta) * r * radius;
      const ty = y * radius;
      const tz = Math.sin(theta) * r * radius;

      // Pre-calculate random offsets for explosion effect
      const randomOffsetX = (Math.random() - 0.5) * 100;
      const randomOffsetY = (Math.random() - 0.5) * 100;
      
      particles.push({
        // Current position (starts way off screen for explosion effect)
        x: (Math.random() - 0.5) * width * 3,
        y: (Math.random() - 0.5) * height * 3,
        z: (Math.random() - 0.5) * width * 3,
        // Target position
        tx, ty, tz,
        // Animation delay
        delay: Math.random() * 200, // ms delay
        // Pre-calculated random offsets for explosion
        randomOffsetX,
        randomOffsetY,
      });
    }

    const startTime = Date.now();

    // --- RENDER LOOP ---
    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      
      const now = Date.now();
      
      // 1. Update Rotation
      // Smoothly track mouse
      targetRotationY += (mouseX * 0.05 - targetRotationY) * 0.05;
      targetRotationX += (mouseY * 0.05 - targetRotationX) * 0.05;
      
      // Constant spin + mouse influence
      const rotY = now * 0.0003 + targetRotationY; 
      const rotX = targetRotationX * 0.5;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Arrays to store projected 2D points for line drawing and particle data
      const projected: {x: number, y: number, z: number, alpha: number}[] = [];
      const particleData: {x2D: number, y2D: number, scale: number, z2: number, progress: number, ease: number}[] = [];

      const cameraDepth = 500;

      // Calculate all particle positions
      particles.forEach((p, i) => {
        // --- PHYSICS: CONVERGENCE ---
        const timeSinceStart = Math.max(0, now - startTime - p.delay);
        const duration = 1500; // 1.5 seconds to arrive
        const progress = Math.min(1, timeSinceStart / duration);
        
        // Easing function (OutQuart)
        const ease = 1 - Math.pow(1 - progress, 4);
        const explosionFactor = (1 - ease) * 4;
        
        // Apply local rotation to the TARGET coordinates
        let x1 = p.tx * cosY - p.tz * sinY;
        let z1 = p.tz * cosY + p.tx * sinY;
        let y1 = p.ty * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.ty * sinX;

        // Apply Explosion/Implosion offset
        x1 += x1 * explosionFactor + p.randomOffsetX * explosionFactor;
        y1 += y1 * explosionFactor + p.randomOffsetY * explosionFactor;
        z2 += z2 * explosionFactor;

        // Perspective Projection
        const scale = cameraDepth / (cameraDepth + z2);
        const x2D = x1 * scale + cx;
        const y2D = y1 * scale + cy;

        // Store particle data for drawing
        particleData.push({ x2D, y2D, scale, z2, progress, ease });

        // Store for line drawing (only if visible)
        if (scale > 0 && progress > 0.1 && z2 > -cameraDepth) {
           projected.push({ 
             x: x2D, 
             y: y2D, 
             z: z2, 
             alpha: Math.min(1, scale * ease) 
           });
        }
      });

      // --- DRAW CONNECTIONS FIRST (so they appear behind particles) ---
      // Optimization: Only connect particles that are close in the array index.
      // Because it's a Fibonacci sphere, sequential indices are somewhat spatially related 
      // (spiraling down), though not perfectly neighbors. 
      // This is O(N) instead of O(N^2).
      
      const connectionDistance = 80; // Max distance to draw line (increased for better visibility)
      ctx.lineWidth = 0.5; // Slightly thicker lines

      for (let i = 0; i < projected.length; i++) {
         // Check the next 15 particles (increased for better mesh coverage)
         for (let j = 1; j < 15; j++) {
            if (i + j >= projected.length) break;
            
            const p1 = projected[i];
            const p2 = projected[i + j];

            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < connectionDistance * connectionDistance) {
               // Calculate opacity based on distance and depth
               const dist = Math.sqrt(distSq);
               const baseOpacity = (1 - dist / connectionDistance) * 0.35; // Increased for brighter appearance
               const opacity = baseOpacity * Math.min(p1.alpha, p2.alpha);
               
               if (opacity > 0.02) {
                 ctx.globalAlpha = opacity;
                 ctx.strokeStyle = `rgba(255, 255, 255, 1)`;
                 ctx.beginPath();
                 ctx.moveTo(p1.x, p1.y);
                 ctx.lineTo(p2.x, p2.y);
                 ctx.stroke();
               }
            }
         }
      }

      // Reset global alpha for particles
      ctx.globalAlpha = 1;

      // --- DRAW PARTICLES ---
      ctx.fillStyle = color;

      particleData.forEach((data, i) => {
        // Draw Point
        // Don't draw points that are barely visible yet or behind the camera
        if (data.progress > 0 && data.scale > 0 && data.z2 > -cameraDepth) {
            const dotRadius = data.scale * 1.5;
            // Ensure radius is positive
            if (dotRadius > 0) {
              const alpha = Math.max(0.3, (data.z2 + radius) / (2 * radius)) * data.ease; // Increased min alpha for brighter particles
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.arc(data.x2D, data.y2D, dotRadius, 0, Math.PI * 2);
              ctx.fill();
            }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [count, radius, color]);

  return (
    <div className="w-full h-[600px] relative flex items-center justify-center pointer-events-none -mt-20">
      <canvas ref={canvasRef} className="opacity-90" />
    </div>
  );
};

export default ParticleSphereAnimation;
