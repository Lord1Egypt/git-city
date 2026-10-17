import * as THREE from "three";

// Drawing only the instances worth drawing: the main city's tree cull
// (SFMapLayers' Trees), for any instanced set. Every instance's matrix stays
// in a source array with its x/z; when the camera actually moves or turns
// (at most 10 times a second) the visible ones are packed to the front of the
// meshes and `count` cut to them. Visible: inside the fog (plus a margin, and
// under maxDistance when given), and either close or inside a widened view
// cone, so turns don't reveal gaps. The meshes need frustumCulled={false}.

export interface CullSet {
  /** Every instance's matrix, 16 floats each. */
  src: Float32Array;
  /** Every instance's x, z. */
  pos: Float32Array;
  /** The meshes drawing this set (one per submesh), all fed the same instances. */
  meshes: THREE.InstancedMesh[];
}

export interface CullState {
  t: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  dirty: boolean;
}

export const createCullState = (): CullState => ({ t: -1, x: NaN, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, dirty: true });

const _fwd = new THREE.Vector3();

export function cullInstances(
  c: CullState,
  camera: THREE.Camera,
  scene: THREE.Scene,
  t: number,
  sets: CullSet[],
  opts: { near?: number; maxDistance?: number; groundY?: number; minMove?: number } = {},
): void {
  const cp = camera.position;
  const cq = camera.quaternion;
  if (!c.dirty && t - c.t < 0.1) return;
  const moved = Math.hypot(cp.x - c.x, cp.y - c.y, cp.z - c.z);
  const turned = 1 - Math.abs(cq.x * c.qx + cq.y * c.qy + cq.z * c.qz + cq.w * c.qw);
  if (!c.dirty && moved < (opts.minMove ?? 60) && turned < 0.0015) return;
  c.t = t;
  c.x = cp.x;
  c.y = cp.y;
  c.z = cp.z;
  c.qx = cq.x;
  c.qy = cq.y;
  c.qz = cq.z;
  c.qw = cq.w;
  c.dirty = false;

  const fog = scene.fog as THREE.Fog | null;
  const far = Math.min((fog && "far" in fog ? fog.far : 16000) + 400, opts.maxDistance ?? Infinity);
  const near = opts.near ?? 400;
  const far2 = far * far;
  const near2 = near * near;
  const groundY = opts.groundY ?? 5;
  camera.getWorldDirection(_fwd);
  const cam = camera as THREE.PerspectiveCamera;
  const halfV = ((cam.fov ?? 55) * Math.PI) / 360;
  const halfDiag = Math.atan(Math.tan(halfV) * Math.hypot(1, cam.aspect ?? 1.8)) + 0.35;
  const minCos = Math.cos(Math.min(Math.PI, halfDiag));

  for (const { src, pos, meshes } of sets) {
    if (meshes.length === 0) continue;
    const n = pos.length / 2;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const dx = pos[i * 2] - cp.x;
      const dy = groundY - cp.y;
      const dz = pos[i * 2 + 1] - cp.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > far2) continue;
      if (d2 > near2 && dx * _fwd.x + dy * _fwd.y + dz * _fwd.z < minCos * Math.sqrt(d2)) continue;
      for (const mesh of meshes) (mesh.instanceMatrix.array as Float32Array).set(src.subarray(i * 16, i * 16 + 16), k * 16);
      k++;
    }
    for (const mesh of meshes) {
      mesh.count = k;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, k * 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
