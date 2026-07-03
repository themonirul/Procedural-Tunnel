import React from 'react';
import * as THREE from 'three';

interface LayerProps {
  progress: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export const TypographyLayer = ({ progress, position, quaternion }: LayerProps) => {
  // Receives engine data but renders nothing for now (Improvement 8)
  return null;
};

export const ImageLayer = ({ progress, position, quaternion }: LayerProps) => {
  return null;
};

export const ParticleLayer = ({ progress, position, quaternion }: LayerProps) => {
  return null;
};

export const EffectsLayer = ({ progress, position, quaternion }: LayerProps) => {
  return null;
};
