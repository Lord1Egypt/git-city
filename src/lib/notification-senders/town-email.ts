import { EMAIL_BASE_URL, heroImage } from "../email/components";

/** The town's share card (name, buildings, members, faces) linking to `href`. */
export function townHero(slug: string, town: string, href: string): string {
  return heroImage({
    src: `${EMAIL_BASE_URL}/town/${encodeURIComponent(slug)}/og`,
    href,
    alt: `${town} in Git City`,
  });
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export const contributions = (n: number) => `${n.toLocaleString("en-US")} contribution${n === 1 ? "" : "s"}`;
