import * as THREE from 'three';

export interface TunnelTransform {
  progress: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface TunnelEngineAPI {
  getTransform: (progress: number) => TunnelTransform;
  getPoint: (progress: number) => THREE.Vector3;
  getTangent: (progress: number) => THREE.Vector3;
  getOrientation: (progress: number) => THREE.Quaternion;
  worldToTunnel: (worldPoint: THREE.Vector3) => { progress: number; radius: number; angle: number };
  tunnelToWorld: (progress: number, radius: number, angle: number) => THREE.Vector3;
}
