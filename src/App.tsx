/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, Environment } from "@react-three/drei";
import { Tunnel } from "./components/Tunnel";
import { Suspense } from "react";

export default function App() {
  return (
    <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Header UI Overlay */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-white text-4xl font-sans font-medium tracking-tighter opacity-80">
          CUBIC_VOID
        </h1>
        <p className="text-neutral-500 font-mono text-xs mt-2 uppercase tracking-widest">
          Continuous geometric iteration // v1.0.4
        </p>
      </div>

      <Canvas shadows>
        <Suspense fallback={null}>
          <Tunnel />
          <Environment preset="city" />
          <fog attach="fog" args={["#111214", 500, 5000]} />
        </Suspense>
      </Canvas>

      {/* Footer UI Overlay */}
      <div className="absolute bottom-8 right-8 z-10 pointer-events-none text-right">
        <p className="text-neutral-600 font-mono text-[10px] uppercase tracking-[0.2em]">
          Scroll up/down to turn 90°
        </p>
      </div>
    </div>
  );
}

