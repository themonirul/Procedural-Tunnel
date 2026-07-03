import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { SCENE_DATA } from "../data/sceneData";
import { TunnelEngine } from "../lib/TunnelEngine";
import { TunnelTransform } from "../types";
import { TypographyLayer, ImageLayer, ParticleLayer, EffectsLayer } from "./Layers";

// --- Configuration ---
const CONFIG = {
  L: 2000,
  CORNER_RADIUS: 200,
  TOTAL_CUBES: 120,
  SCROLL_FORCE: 0.00004,
  FRICTION: 0.94,
  MAX_SPEED: 0.05,
  CAMERA_HEIGHT: -35,
  CAMERA_FOV: 80,
};

// --- Pre-allocated Objects (Optimization - Improvement 9) ---
const _tempObj = new THREE.Object3D();
const _tempVec = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();

// --- Lighting System ---
const Lighting = () => (
  <group>
    <ambientLight intensity={0.4} />
    <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
    <directionalLight position={[1000, 1000, 500]} intensity={1} />
    <directionalLight position={[-1000, 500, -500]} intensity={0.5} />
  </group>
);

// --- Tunnel Geometry System ---
const TunnelGeometry = ({ material }: { material: THREE.Material }) => {
  const sceneMeshes = useMemo(() => {
    const edgeMaterial = new THREE.LineBasicMaterial({ 
      color: "#ffffff", 
      transparent: true, 
      opacity: 0.2,
      depthWrite: false,
    });

    return Object.entries(SCENE_DATA).map(([name, geo]) => {
      const { vertices, faces } = geo as any;
      let minIdx = Infinity;
      faces.forEach((f: number[]) => f.forEach((v: number) => { if (v < minIdx) minIdx = v; }));

      const positions = new Float32Array(vertices.length * 3);
      vertices.forEach((v: number[], i: number) => {
        positions[i * 3] = v[0];
        positions[i * 3 + 1] = v[1];
        positions[i * 3 + 2] = v[2];
      });

      const indices: number[] = [];
      faces.forEach((f: number[]) => {
        const a = f[0] - minIdx;
        const b = f[1] - minIdx;
        const c = f[2] - minIdx;
        const d = f[3] - minIdx;
        indices.push(a, b, c, a, c, d);
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const edges = new THREE.EdgesGeometry(geometry, 15);

      return (
        <group key={name}>
          <mesh geometry={geometry} material={material} />
          <lineSegments geometry={edges} material={edgeMaterial} />
        </group>
      );
    });
  }, [material]);

  return <>{sceneMeshes}</>;
};

// --- Floating Cubes System ---
const FloatingCubes = ({ material, progressRef }: { material: THREE.Material, progressRef: React.RefObject<number> }) => {
  const instancedRef = useRef<THREE.InstancedMesh>(null);

  // Deterministic Animation: Pre-calculate static cube data (Improvement 5)
  const cubeBaseData = useMemo(() => {
    const data = [];
    const { L } = CONFIG;
    const WALL_LEN = 1600;
    const WIDTH = 400;
    const CUBE_COUNT = 30;
    
    const wallConfigs = [
      { pos: [L / 2, 0, 0], rotY: 0 },
      { pos: [L, 0, -L / 2], rotY: -Math.PI / 2 },
      { pos: [L / 2, 0, -L], rotY: 0 },
      { pos: [0, 0, -L / 2], rotY: -Math.PI / 2 },
    ];

    wallConfigs.forEach((wall, wallIdx) => {
      for (let i = 0; i < CUBE_COUNT; i++) {
        const seed = wallIdx * 100 + i;
        const offset = (i + 1) * (WALL_LEN / (CUBE_COUNT + 1)) - WALL_LEN / 2;
        
        const w = 40 + seededRandom(seed * 2) * 60;
        const h = 40 + seededRandom(seed * 3) * 60;
        const d = 20 + seededRandom(seed * 4) * 40;

        const isAlongZ = wall.rotY !== 0;
        const jitter = (seededRandom(seed * 5) - 0.5) * 100;
        const wallPosOffset = offset + jitter;

        const basePosX = !isAlongZ ? (wall.pos[0] + wallPosOffset) : (wall.pos[0] + (WIDTH / 2 - d / 2) + (seededRandom(seed * 6) - 0.5) * 40);
        const basePosZ = isAlongZ ? (wall.pos[2] + wallPosOffset) : (wall.pos[2] + (WIDTH / 2 - d / 2) + (seededRandom(seed * 7) - 0.5) * 40);

        data.push({ seed, w, h, d, basePosX, basePosZ });
      }
    });
    return data;
  }, []);

  useFrame(() => {
    if (!instancedRef.current) return;
    
    const time = progressRef.current * 100;

    cubeBaseData.forEach((cube, i) => {
      const { seed, w, h, d, basePosX, basePosZ } = cube;

      const wy = (Math.sin(time * 0.2 + seed) * 12) + (Math.cos(time * 0.35 + seed * 0.5) * 6) - 10;

      _tempObj.position.set(basePosX, wy, basePosZ);
      const scalePulse = 1 + Math.sin(time * 0.2 + seed) * 0.02;
      _tempObj.scale.set((w/100) * scalePulse, (h/100) * scalePulse, (d/100) * scalePulse);
      _tempObj.rotation.set(
        time * 0.06 + seed * 0.5,
        time * 0.04 + seed,
        time * 0.03 + seed * 0.2
      );
      _tempObj.updateMatrix();
      instancedRef.current!.setMatrixAt(i, _tempObj.matrix);
    });
    instancedRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={instancedRef} args={[undefined, undefined, CONFIG.TOTAL_CUBES]} material={material}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
};

// --- Camera Rig (Improvement 4) ---
const CameraRig = ({ progressRef, engine }: { progressRef: React.RefObject<number>, engine: TunnelEngine }) => {
  const rigRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const [transform, setTransform] = useState<TunnelTransform | null>(null);

  useFrame(() => {
    if (!rigRef.current || !pivotRef.current) return;
    
    const currentTransform = engine.getTransform(progressRef.current);
    
    // 1. Camera Rig follows the path (Improvement 4)
    rigRef.current.position.copy(currentTransform.position);
    rigRef.current.quaternion.copy(currentTransform.quaternion);
    
    // 2. Camera Pivot handles height and future secondary movement (Improvement 4)
    pivotRef.current.position.y = CONFIG.CAMERA_HEIGHT;

    // Optional: We can update the transform state to drive the layer hooks
    // but useFrame is better for performance if the layers also use useFrame.
    // For now, we'll expose the values via state if needed, or just let layers handle it.
  });

  return (
    <group ref={rigRef}>
      <group ref={pivotRef}>
        <PerspectiveCamera makeDefault fov={CONFIG.CAMERA_FOV} far={20000} />
      </group>
      
      {/* Object Pool Ready Hook Architecture (Improvement 7 & 8) */}
      <LayerHooks engine={engine} progressRef={progressRef} />
    </group>
  );
};

// Separate component for layers to avoid rig re-renders
const LayerHooks = ({ engine, progressRef }: { engine: TunnelEngine, progressRef: React.RefObject<number> }) => {
  const layerData = useRef({
    progress: 0,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion()
  });

  useFrame(() => {
    const transform = engine.getTransform(progressRef.current);
    layerData.current.progress = transform.progress;
    layerData.current.position.copy(transform.position);
    layerData.current.quaternion.copy(transform.quaternion);
  });

  return (
    <>
      <TypographyLayer {...layerData.current} />
      <ImageLayer {...layerData.current} />
      <ParticleLayer {...layerData.current} />
      <EffectsLayer {...layerData.current} />
    </>
  );
};

// --- Main Component ---
export const Tunnel = () => {
  const progress = useRef(0);
  const velocity = useRef(0);
  
  // Improvement: TunnelEngine encapsulates path and coordinate logic
  const engine = useMemo(() => new TunnelEngine(CONFIG.L, CONFIG.CORNER_RADIUS), []);

  const sharedMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ 
      color: "#888888", 
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide,
      flatShading: true 
    });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
    return mat;
  }, []);

  // --- Input Controller ---
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      velocity.current += e.deltaY * CONFIG.SCROLL_FORCE;
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  useFrame((_, delta) => {
    const dampingFactor = Math.pow(CONFIG.FRICTION, delta * 60);
    velocity.current *= dampingFactor;
    velocity.current = THREE.MathUtils.clamp(velocity.current, -CONFIG.MAX_SPEED, CONFIG.MAX_SPEED);
    
    // Constant Path Speed (Improvement 6) is handled by TunnelEngine.getTransform using getPointAt
    progress.current += velocity.current;
    progress.current = THREE.MathUtils.euclideanModulo(progress.current, 1);
  });

  return (
    <group>
      <Lighting />
      <TunnelGeometry material={sharedMaterial} />
      
      <CameraRig progressRef={progress} engine={engine} />
      <FloatingCubes material={sharedMaterial} progressRef={progress} />
    </group>
  );
};

// --- Utilities ---
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
