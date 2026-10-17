import { redirect } from "next/navigation";
import { BRASIL_SLUG } from "@/lib/towns/brasil-server";

// The link in bio: the Brasil map, keeping ?at= and ?uf= (a building or a state) and the utm_ tags.
export default async function BrasilLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  // ?at= and ?uf= open a building or a state; utm_* tell analytics where the visit came from (the bio link).
  for (const [k, v] of Object.entries(await searchParams)) if ((k === "at" || k === "uf" || k.startsWith("utm_")) && typeof v === "string") q.set(k, v);
  redirect(`/town/${BRASIL_SLUG}${q.size ? `?${q}` : ""}`);
}
