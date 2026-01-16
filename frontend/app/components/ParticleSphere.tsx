"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RotatingGroupProps {
  shouldStart: boolean;
  children: React.ReactNode;
}

interface ParticleProps {
  position: [number, number, number];
  targetPosition: [number, number, number];
  delay: number;
}

interface ParticleWithStartProps extends ParticleProps {
  shouldStart: boolean;
}

function Particle({ position, targetPosition, delay, shouldStart }: ParticleWithStartProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!meshRef.current) return;

    if (!shouldStart) {
      // Keep particles hidden and at start position until animation should start
      meshRef.current.position.set(...position);
      if (meshRef.current.material) {
        (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      return;
    }

    // Initialize start time on first frame after shouldStart becomes true
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.getElapsedTime() + delay;
    }

    const elapsed = state.clock.getElapsedTime();
    const startTime = startTimeRef.current;

    if (elapsed < startTime) {
      // Before animation starts, keep at initial position
      meshRef.current.position.set(...position);
      return;
    }

    // Animation duration
    const duration = 2.0;
    const progress = Math.min((elapsed - startTime) / duration, 1);

    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);

    // Interpolate from start to target position
    const currentX = position[0] + (targetPosition[0] - position[0]) * eased;
    const currentY = position[1] + (targetPosition[1] - position[1]) * eased;
    const currentZ = position[2] + (targetPosition[2] - position[2]) * eased;

    meshRef.current.position.set(currentX, currentY, currentZ);

    // Fade in opacity
    if (meshRef.current.material) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(progress * 2, 1);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} />
    </mesh>
  );
}

interface ParticleSphereProps {
  shouldStart: boolean;
}

function RotatingGroup({ shouldStart, children }: RotatingGroupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const animationCompleteTimeRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!groupRef.current || !shouldStart) return;

    // Track when animation completes (max delay + duration = ~2.5 seconds)
    if (animationCompleteTimeRef.current === null) {
      animationCompleteTimeRef.current = state.clock.getElapsedTime() + 2.5;
    }

    const elapsed = state.clock.getElapsedTime();
    const animationCompleteTime = animationCompleteTimeRef.current;

    // Only start rotating after particles have formed the sphere
    if (elapsed >= animationCompleteTime) {
      // Rotate the sphere continuously
      groupRef.current.rotation.x += 0.005;
      groupRef.current.rotation.y += 0.01;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function ParticleSphere({ shouldStart }: ParticleSphereProps) {
  const particleCount = 500;
  const sphereRadius = 1.5;

  // Generate sphere positions and random start positions
  const particles = useMemo(() => {
    const positions: ParticleProps[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Generate points on a sphere using spherical coordinates
      const theta = Math.random() * Math.PI * 2; // Azimuth
      const phi = Math.acos(2 * Math.random() - 1); // Polar angle

      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
      const z = sphereRadius * Math.cos(phi);

      // Start positions - random points off-screen (far from center)
      const startDistance = 8 + Math.random() * 4;
      const startTheta = Math.random() * Math.PI * 2;
      const startPhi = Math.random() * Math.PI;

      const startX = startDistance * Math.sin(startPhi) * Math.cos(startTheta);
      const startY = startDistance * Math.sin(startPhi) * Math.sin(startTheta);
      const startZ = startDistance * Math.cos(startPhi);

      positions.push({
        position: [startX, startY, startZ] as [number, number, number],
        targetPosition: [x, y, z] as [number, number, number],
        delay: Math.random() * 0.5, // Stagger the animation
      });
    }

    return positions;
  }, []);

  return (
    <RotatingGroup shouldStart={shouldStart}>
      {particles.map((particle, index) => (
        <Particle
          key={index}
          position={particle.position}
          targetPosition={particle.targetPosition}
          delay={particle.delay}
          shouldStart={shouldStart}
        />
      ))}
    </RotatingGroup>
  );
}

interface ParticleSphereAnimationProps {
  shouldStart: boolean;
}

export default function ParticleSphereAnimation({ shouldStart }: ParticleSphereAnimationProps) {
  return (
    <div className="w-full h-[400px] flex items-center justify-center bg-black">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <ParticleSphere shouldStart={shouldStart} />
      </Canvas>
    </div>
  );
}
