import { createServerSupabase } from "@/lib/supabase-server";
import { isAdminUser } from "@/lib/auth-identity";
import { preload } from "react-dom";
import { snapshotUrl } from "@/lib/city-snapshot-client";
import { SNAPSHOT_V2_PATH } from "@/lib/city-snapshot-format";
import { getTownOfWeek } from "@/lib/towns/weekly";
import HomeClient from "./_components/home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The city data is the critical path: start both downloads from the HTML
  // head so they run while the JS bundle is still loading.
  preload(snapshotUrl(SNAPSHOT_V2_PATH), { as: "fetch", crossOrigin: "anonymous" });
  preload("/maps/bay.json", { as: "fetch", crossOrigin: "anonymous" });

  const sb = await createServerSupabase();
  const [{ data: { user } }, townOfWeek] = await Promise.all([
    sb.auth.getUser(),
    // The plaza monument's town. A failed read shows the empty monument.
    getTownOfWeek().catch(() => null),
  ]);

  return <HomeClient isAdmin={isAdminUser(user)} townOfWeek={townOfWeek} />;
}
