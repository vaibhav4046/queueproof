"use client";

/**
 * Evidence World — a strictly additive Three.js progressive-enhancement layer
 * behind Evidence Orbit's SVG/DOM scene. It is never the source of truth:
 * EvidenceOrbit (and EvidenceGraph) keep rendering and functioning exactly as
 * before, on every device, with or without this component mounted.
 *
 * This layer renders an icosahedral "proof core" — dark glass interior, an
 * emissive wireframe edge that recolors per OrbitStage, and a limited pointer
 * parallax on the camera (never free-flight, never OrbitControls). It mounts
 * only when every capability check below passes; otherwise it renders null
 * with zero layout shift, and the SVG scene is all the user ever sees.
 *
 * Capability gate lives in ./evidence-world-capability.ts (a module with zero
 * dependency on "three"/"@react-three/fiber") and is checked twice:
 *   1. In QueueProofApp.tsx, via useEvidenceWorldCapability(), BEFORE this
 *      component is even rendered — so the ~230KB gzip Three.js chunk this
 *      file pulls in is only ever downloaded (dynamic import fires) for
 *      devices that will actually use it, not for every visitor to the Proof
 *      screen.
 *   2. Here, again, as defense in depth once this module has loaded.
 * All checks must hold:
 *   - a real WebGL context can be created (not just window.WebGLRenderingContext
 *     existing — some locked-down browsers expose the constructor but refuse
 *     context creation)
 *   - prefers-reduced-motion is NOT set
 *   - the viewport is wide enough that Evidence Orbit itself is visible.
 *     globals.css hides `.evidence-orbit` below 1024px
 *     (`@media (max-width: 1023px) { .evidence-orbit { display: none; } }`),
 *     so this layer uses that same threshold rather than a generic tablet
 *     breakpoint — there is no point paying for a WebGL layer sitting behind
 *     a `display: none` scene.
 *   - no cheap low-end-device signal fires (hardwareConcurrency or
 *     deviceMemory very low). Absence of either API is treated as "assume
 *     capable" per spec — never assume incapable from a missing API.
 *
 * Stage mapping reuses OrbitStage/OrbitProps from EvidenceOrbit.tsx verbatim
 * (idle | routing | retrieving | linking | contradiction | verified |
 * insufficient) so both layers stay driven by one state source — no parallel
 * stage vocabulary is introduced here.
 *
 * Cleanup: on unmount, every geometry and material reachable from the scene
 * graph is disposed explicitly, and the WebGLRenderer is disposed via
 * gl.dispose(). This is on top of (not a replacement for) React Three
 * Fiber's own automatic dispose-on-unmount behaviour, to make the guarantee
 * explicit and independently verifiable rather than relying on library
 * defaults.
 */
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitProps, OrbitStage } from "./EvidenceOrbit";
import { detectEvidenceWorldCapability } from "./evidence-world-capability";

export type EvidenceWorldProps = OrbitProps;

const MAX_PARALLAX_OFFSET = 0.32;
const PARALLAX_EASE = 0.06;

const STAGE_EDGE_COLOR: Record<OrbitStage, string> = {
  idle: "#7d867a",
  routing: "#d7ff48",
  retrieving: "#7f9bff",
  linking: "#64f2c2",
  contradiction: "#ffb45e",
  verified: "#d7ff48",
  insufficient: "#4c534a",
};

const STAGE_ROTATION_SPEED: Record<OrbitStage, number> = {
  idle: 0.05,
  routing: 0.14,
  retrieving: 0.18,
  linking: 0.22,
  contradiction: 0.34,
  verified: 0, // locked / stable geometry once the answer is proven
  insufficient: 0.02,
};

/** Limited pointer parallax: a small clamped camera offset that follows the
 * pointer, always looking back at the core. Not orbit controls — there is no
 * drag, no zoom, no free rotation. */
function ParallaxRig() {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(({ camera }) => {
    const targetX = THREE.MathUtils.clamp(pointer.current.x * MAX_PARALLAX_OFFSET, -MAX_PARALLAX_OFFSET, MAX_PARALLAX_OFFSET);
    const targetY = THREE.MathUtils.clamp(-pointer.current.y * MAX_PARALLAX_OFFSET, -MAX_PARALLAX_OFFSET, MAX_PARALLAX_OFFSET);
    camera.position.x += (targetX - camera.position.x) * PARALLAX_EASE;
    camera.position.y += (targetY - camera.position.y) * PARALLAX_EASE;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function ProofCore({ stage }: { stage: OrbitStage }) {
  const glassRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.Mesh>(null);
  const edgeColor = STAGE_EDGE_COLOR[stage] ?? STAGE_EDGE_COLOR.idle;
  const rotationSpeed = STAGE_ROTATION_SPEED[stage] ?? STAGE_ROTATION_SPEED.idle;

  useFrame((_state, delta) => {
    if (rotationSpeed === 0) return;
    if (glassRef.current) glassRef.current.rotation.y += delta * rotationSpeed;
    if (edgeRef.current) edgeRef.current.rotation.y += delta * rotationSpeed;
  });

  return (
    <group>
      {/* Dark glass interior — low-poly icosahedron, detail 0 keeps the
          faceted look consistent with EvidenceOrbit's flat-faceted core. */}
      <mesh ref={glassRef}>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshPhysicalMaterial
          color="#050a05"
          roughness={0.2}
          metalness={0.05}
          transmission={0.82}
          thickness={1.3}
          ior={1.4}
          clearcoat={0.35}
          attenuationColor="#0a1a0a"
          attenuationDistance={1.5}
        />
      </mesh>
      {/* Emissive edge — shifts per stage, calm at idle, amber for
          contradiction, frozen/stable once verified. */}
      <mesh ref={edgeRef} scale={1.002}>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshBasicMaterial color={edgeColor} wireframe transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function WorldScene({ stage }: { stage: OrbitStage }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[2.4, 1.8, 2.6]} intensity={12} color="#d7ff48" />
      <pointLight position={[-2.2, -1.4, -1.8]} intensity={4} color="#64f2c2" />
      <ProofCore stage={stage} />
      <ParallaxRig />
    </>
  );
}

export default function EvidenceWorld({ stage }: EvidenceWorldProps) {
  // Computed once via a lazy initializer, not an effect: this component is
  // always loaded through next/dynamic with ssr:false (see QueueProofApp.tsx),
  // so its render function only ever executes in the browser — there is no
  // server pass to mismatch against. detectEvidenceWorldCapability() also
  // carries its own `typeof window` guard as defense in depth (this is the
  // second, redundant check — QueueProofApp already gates whether this
  // component's dynamic import fires at all on the same predicate), matching
  // the useMemo-at-render convention EvidenceOrbit.tsx uses for reducedMotion.
  const [capable] = useState(() => detectEvidenceWorldCapability());
  const [hidden, setHidden] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Same visibilitychange pause pattern as EvidenceOrbit.tsx: flip a hidden
  // flag, which is fed into the Canvas frameloop below so no
  // requestAnimationFrame work happens while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Explicit teardown on unmount: dispose every geometry/material reachable
  // from the scene graph, then dispose the renderer itself. This is the most
  // common Three.js/React memory leak, so it is handled explicitly here
  // rather than left entirely to R3F's own automatic disposal.
  useEffect(() => {
    return () => {
      const scene = sceneRef.current;
      if (scene) {
        scene.traverse((object: THREE.Object3D) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry?.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material?.dispose();
        });
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  if (!capable) return null;

  function handleCreated(state: RootState) {
    rendererRef.current = state.gl;
    sceneRef.current = state.scene;
    state.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  return (
    <div className="evidence-world" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={hidden ? "never" : "always"}
        camera={{ position: [0, 0, 4.4], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={handleCreated}
      >
        <WorldScene stage={stage} />
      </Canvas>
    </div>
  );
}
