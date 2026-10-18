"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { rotToRadians } from "@/lib/league-city/grid";
import { M_TO_UNIT, UNIT_TO_M } from "@/lib/league-city/drive/tuning";
import { TREE_TYPES, type TreeType } from "@/lib/league-city/types";
import { treeScale, useTreeVariants, type TreeVariant } from "../LeagueTrees";

// ─── Trees you can knock over, on a map with thousands ──────
// A physics bubble round the car: the trees nearest it (at most MAX) are real
// bodies the car hits, shoves and carries off, like the lamps; every other
// tree is scenery, drawn instanced and with no collider. A body sleeps (costs
// nothing) until the car touches it. Out of the bubble a tree goes back to
// scenery where it stood. `onHidden` tells the instanced trees which ones the
// bubble draws, so nothing is drawn twice.

export interface BubbleTree {
  id: string;
  /** Where it stands (city units). */
  x: number;
  z: number;
  type: TreeType;
  rot: number;
}

/** Trees this close to the car (units) become bodies, nearest first, at most MAX at once. */
const NEAR = 70;
const MAX = 16;
/** A body this far from the car (units) goes back to being scenery. */
const FAR = 170;
const CELL = 64;
/** The trunk as the car feels it (m), and how heavy the tree is: light enough to carry off. */
const TRUNK = { radius: 0.7, halfHeight: 4 };
const MASS = 90;
const PICK_EVERY = 0.25;

export default function TreeBubble({ trees, car, onHidden }: { trees: BubbleTree[]; car: () => { x: number; z: number } | null; onHidden: (ids: ReadonlySet<string>) => void }) {
  const variants = useTreeVariants();
  const byId = useMemo(() => new Map(trees.map((t) => [t.id, t])), [trees]);
  const grid = useMemo(() => {
    const g = new Map<string, BubbleTree[]>();
    for (const t of trees) {
      const k = `${Math.floor(t.x / CELL)},${Math.floor(t.z / CELL)}`;
      (g.get(k) ?? g.set(k, []).get(k)!).push(t);
    }
    return g;
  }, [trees]);
  const [active, setActive] = useState<string[]>([]);
  const bodies = useRef(new Map<string, RapierRigidBody>());
  const last = useRef(0);

  useEffect(() => () => onHidden(new Set()), [onHidden]);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < PICK_EVERY) return;
    last.current = clock.elapsedTime;
    const at = car();
    if (!at) return;
    // Keep the bodies still near the car (wherever they rolled to); let the far ones go.
    const keep = active.filter((id) => {
      const b = bodies.current.get(id);
      const p = b?.translation();
      const [x, z] = p ? [p.x * M_TO_UNIT, p.z * M_TO_UNIT] : [byId.get(id)!.x, byId.get(id)!.z];
      return Math.hypot(x - at.x, z - at.z) < FAR;
    });
    // Fill up with the nearest trees still standing.
    const cx = Math.floor(at.x / CELL);
    const cz = Math.floor(at.z / CELL);
    const near: [number, string][] = [];
    for (let gx = cx - 2; gx <= cx + 2; gx++)
      for (let gz = cz - 2; gz <= cz + 2; gz++)
        for (const t of grid.get(`${gx},${gz}`) ?? []) {
          const d = Math.hypot(t.x - at.x, t.z - at.z);
          if (d < NEAR && !keep.includes(t.id)) near.push([d, t.id]);
        }
    near.sort((a, b) => a[0] - b[0]);
    const next = [...keep, ...near.slice(0, Math.max(0, MAX - keep.length)).map(([, id]) => id)];
    if (next.length === active.length && next.every((id, i) => id === active[i])) return;
    setActive(next);
    onHidden(new Set(next));
  });

  return (
    <>
      {active.map((id) => {
        const t = byId.get(id);
        const v = t && variants[TREE_TYPES.indexOf(t.type)];
        if (!t || !v) return null;
        return (
          <LooseTree key={id} tree={t} variant={v} bodies={bodies} />
        );
      })}
    </>
  );
}

/** One tree as a body: asleep where it stands until the car hits it, then shoved, tipped, carried off. */
function LooseTree({ tree, variant, bodies }: { tree: BubbleTree; variant: TreeVariant; bodies: React.MutableRefObject<Map<string, RapierRigidBody>> }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const rotY = rotToRadians(tree.rot);
  const scale = treeScale(variant, tree.x, tree.z);

  // Once, on arriving in the bubble: asleep where it stands, listed for the distance check.
  useEffect(() => {
    const map = bodies.current;
    if (body.current) {
      map.set(tree.id, body.current);
      body.current.sleep();
    }
    return () => {
      map.delete(tree.id);
    };
  }, [bodies, tree.id]);

  useFrame(() => {
    const b = body.current;
    const g = visual.current;
    if (!b || !g) return;
    const p = b.translation();
    const q = b.rotation();
    g.position.set(p.x * M_TO_UNIT, p.y * M_TO_UNIT, p.z * M_TO_UNIT);
    g.quaternion.set(q.x, q.y, q.z, q.w);
  });

  return (
    <>
      <RigidBody ref={body} type="dynamic" colliders={false} position={[tree.x * UNIT_TO_M, TRUNK.halfHeight, tree.z * UNIT_TO_M]} rotation={[0, rotY, 0]} userData={{ prop: "tree" }} canSleep>
        <CylinderCollider args={[TRUNK.halfHeight, TRUNK.radius]} mass={MASS} friction={0.6} />
      </RigidBody>
      <group ref={visual}>
        {/* The trunk's base sits at the body's bottom. */}
        <group position={[0, -TRUNK.halfHeight * M_TO_UNIT, 0]} scale={scale}>
          {variant.subs.map((s, i) => (
            <mesh key={i} geometry={s.geo} material={s.mat} />
          ))}
        </group>
      </group>
    </>
  );
}
