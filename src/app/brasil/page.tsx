import { redirect } from "next/navigation";
import { BRASIL_SLUG } from "@/lib/towns/brasil-server";

// The link in bio: the Brasil map, keeping ?at= and ?uf= for links to a building or a state.
export default async function BrasilLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if ((k === "at" || k === "uf") && typeof v === "string") q.set(k, v);
  redirect(`/town/${BRASIL_SLUG}${q.size ? `?${q}` : ""}`);
}
