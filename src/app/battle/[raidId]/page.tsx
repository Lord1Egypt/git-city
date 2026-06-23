import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BattleRedirect } from "./battle-redirect";

type Props = {
  params: Promise<{ raidId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { raidId } = await params;

  const supabase = getSupabaseAdmin();

  const { data: raid } = await supabase
    .from("raids")
    .select("attack_score, defense_score, success, attacker_id, defender_id")
    .eq("id", raidId)
    .single();

  if (!raid) {
    return {
      title: "Battle - Git City",
      description: "Build your own dev city from your GitHub contributions.",
    };
  }

  const [{ data: atk }, { data: def }] = await Promise.all([
    supabase.from("developers").select("github_login").eq("id", raid.attacker_id).single(),
    supabase.from("developers").select("github_login").eq("id", raid.defender_id).single(),
  ]);

  const atkLogin = atk?.github_login ?? "someone";
  const defLogin = def?.github_login ?? "a rival";
  const title = raid.success
    ? `@${atkLogin} conquered @${defLogin} - Git City`
    : `@${defLogin} defended against @${atkLogin} - Git City`;
  const description = `${raid.attack_score} vs ${raid.defense_score} on Git City. Build your own dev city from your GitHub contributions.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function BattlePage() {
  return <BattleRedirect />;
}
