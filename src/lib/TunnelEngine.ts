import * as THREE from 'three';
import { TunnelTransform } from '../types';

/**
 * A perfectly uniform procedural path for the cubic tunnel.
 * Built on top of THREE.CurvePath to ensure constant speed and stable Frenet Frames.
 */
export class TunnelPath extends THREE.Curve<THREE.Vector3> {
  private curvePath: THREE.CurvePath<THREE.Vector3>;
  public frenetFrames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] };
  
  constructor(L: number, R: number, segments = 200) {
    super();
    this.curvePath = new THREE.CurvePath<THREE.Vector3>();

    // Side 1 (+X)
    this.curvePath.add(new THREE.LineCurve3(new THREE.Vector3(R, 0, 0), new THREE.Vector3(L - R, 0, 0)));
    this.curvePath.add(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(L - R, 0, 0),
      new THREE.Vector3(L, 0, 0),
      new THREE.Vector3(L, 0, -R)
    ));

    // Side 2 (-Z)
    this.curvePath.add(new THREE.LineCurve3(new THREE.Vector3(L, 0, -R), new THREE.Vector3(L, 0, -(L - R))));
    this.curvePath.add(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(L, 0, -(L - R)),
      new THREE.Vector3(L, 0, -L),
      new THREE.Vector3(L - R, 0, -L)
    ));

    // Side 3 (-X)
    this.curvePath.add(new THREE.LineCurve3(new THREE.Vector3(L - R, 0, -L), new THREE.Vector3(R, 0, -L)));
    this.curvePath.add(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(R, 0, -L),
      new THREE.Vector3(0, 0, -L),
      new THREE.Vector3(0, 0, -(L - R))
    ));

    // Side 4 (+Z)
    this.curvePath.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, -(L - R)), new THREE.Vector3(0, 0, -R)));
    this.curvePath.add(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, -R),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(R, 0, 0)
    ));

    // Pre-calculate Frenet Frames for stable orientation (Improvement 2)
    // We use a high segment count to ensure smoothness when interpolating
    this.frenetFrames = this.computeFrenetFrames(segments, true);
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    // Note: getPoint on CurvePath is not necessarily arc-length parameterized.
    // However, our getTransform uses getPointAt.
    return this.curvePath.getPoint(t, optionalTarget);
  }

  getPointAt(u: number, optionalTarget = new THREE.Vector3()) {
    return this.curvePath.getPointAt(u, optionalTarget);
  }

  getTangentAt(u: number, optionalTarget = new THREE.Vector3()) {
    return this.curvePath.getTangentAt(u, optionalTarget);
  }
}

export class TunnelEngine {
  public path: TunnelPath;
  
  // Reusable workspace objects (Improvement 9)
  private _transform: TunnelTransform;
  private _vecA = new THREE.Vector3();
  private _vecB = new THREE.Vector3();
  private _vecC = new THREE.Vector3();
  private _mat4 = new THREE.Matrix4();
  private _quat = new THREE.Quaternion();

  constructor(L: number, R: number) {
    this.path = new TunnelPath(L, R, 400); // 400 segments for high stability
    this._transform = {
      progress: 0,
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      binormal: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    };
  }

  /**
   * REUSABLE CAMERA PATH API (Improvement 1)
   */
  getTransform(progress: number): TunnelTransform {
    const u = THREE.MathUtils.euclideanModulo(progress, 1);
    
    // Constant Path Speed (Improvement 6)
    // getPointAt uses arc-length parameterization
    this.path.getPointAt(u, this._transform.position);
    this.path.getTangentAt(u, this._transform.tangent);

    // Stable Frenet Frames (Improvement 2)
    // Instead of computing every frame, we could interpolate from pre-computed frames
    // but for simple tunnels, computing them via cross-products is often more stable
    // if the "Up" vector is well-defined.
    // However, the user specifically requested curve.computeFrenetFrames usage.
    
    // Since computeFrenetFrames is pre-calculated, we interpolate:
    const segments = this.path.frenetFrames.tangents.length - 1;
    const index = u * segments;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, segments);
    const f = index - i0;

    this._transform.normal.lerpVectors(this.path.frenetFrames.normals[i0], this.path.frenetFrames.normals[i1], f).normalize();
    this._transform.binormal.lerpVectors(this.path.frenetFrames.binormals[i0], this.path.frenetFrames.binormals[i1], f).normalize();
    
    // Refine tangent from position delta if needed, or just use the lerped tangent
    this._transform.tangent.lerpVectors(this.path.frenetFrames.tangents[i0], this.path.frenetFrames.tangents[i1], f).normalize();

    // Generate stable quaternion
    this._mat4.makeBasis(this._transform.normal, this._transform.binormal, this._transform.tangent);
    this._transform.quaternion.setFromRotationMatrix(this._mat4);
    
    this._transform.progress = u;
    
    return this._transform;
  }

  /**
   * STABLE LOCAL COORDINATE SYSTEM (Improvement 3)
   */
  getPoint(progress: number): THREE.Vector3 {
    return this.path.getPointAt(THREE.MathUtils.euclideanModulo(progress, 1));
  }

  getTangent(progress: number): THREE.Vector3 {
    return this.path.getTangentAt(THREE.MathUtils.euclideanModulo(progress, 1));
  }

  getOrientation(progress: number): THREE.Quaternion {
    const transform = this.getTransform(progress);
    return transform.quaternion;
  }

  tunnelToWorld(progress: number, radius: number, angle: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const transform = this.getTransform(progress);
    
    // P = Pos + Normal * cos(a) * r + Binormal * sin(a) * r
    optionalTarget.copy(transform.position);
    this._vecA.copy(transform.normal).multiplyScalar(Math.cos(angle) * radius);
    this._vecB.copy(transform.binormal).multiplyScalar(Math.sin(angle) * radius);
    
    optionalTarget.add(this._vecA).add(this._vecB);
    return optionalTarget;
  }

  worldToTunnel(worldPoint: THREE.Vector3): { progress: number; radius: number; angle: number } {
    // This is a complex projection. For now, we return a placeholder or 
    // a simple nearest-point search if absolutely necessary.
    // Given the "Future Typography Hooks" requirement, we'll keep it as a stub
    // that the typography system will use later.
    return { progress: 0, radius: 0, angle: 0 };
  }
}
