// ─── Town templates ─────────────────────────────────────────
// What a new town starts as: a starter city layout (starter.ts) and the
// settings that fit it. Picked on /towns/new; after that the town is the
// admin's to change, nothing remembers which template it came from.

import type { JoinMode } from "@/lib/towns/joining";

export const TEMPLATE_IDS = ["crew", "race", "hq", "park", "blank"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TownTemplate {
  id: TemplateId;
  name: string;
  /** One line on the card: what the town is for. */
  blurb: string;
  join: JoinMode;
}

export const TEMPLATES: readonly TownTemplate[] = [
  { id: "crew", name: "Crew", blurb: "A main street and a plaza for your friends.", join: "request" },
  { id: "race", name: "Race track", blurb: "A loop with ramps and boost pads.", join: "request" },
  { id: "hq", name: "Company HQ", blurb: "Downtown blocks for your team.", join: "request" },
  { id: "park", name: "Park village", blurb: "Few streets, lots of trees, a big plaza.", join: "request" },
  { id: "blank", name: "Blank", blurb: "Just the gate. Build everything yourself.", join: "request" },
];

export const DEFAULT_TEMPLATE: TemplateId = "crew";
/** A company town's starter city unless its creator picks another. */
export const COMPANY_TEMPLATE: TemplateId = "hq";

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

export function templateFor(id: TemplateId): TownTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export const JOIN_LABEL: Record<JoinMode, string> = {
  open: "Anyone",
  request: "Ask first",
  invite: "Invite only",
};
