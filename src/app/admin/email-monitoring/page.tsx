import { redirect } from "next/navigation";

// Replaced by /admin/emails (health, catalog, campaigns, chores).
export default function EmailMonitoringRedirect() {
  redirect("/admin/emails");
}
