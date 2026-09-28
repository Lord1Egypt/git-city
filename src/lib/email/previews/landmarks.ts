import { withUnsubscribeFooter } from "../../admin-emails";
import { renderLandmarkWelcomeEmail } from "../../landmarks/welcome-email";
import type { Landmark } from "../../landmarks/types";
import type { EmailPreviews } from "./types";

const LANDMARK: Landmark = {
  id: "preview",
  slug: "acme",
  name: "Acme",
  tagline: "",
  description: "",
  url: "https://example.com",
  features: [],
  accent: "#c8e64a",
  hitboxRadius: 0,
  hitboxHeight: 0,
  buildingKind: "tower",
  customComponent: null,
  templateConfig: null,
  priority: 0,
  ownerGithubLogins: ["srizzon"],
  active: true,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

const UPDATE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><BODY style="margin:0; background:#0d0d0f;">
<div style="max-width:600px; margin:0 auto; padding:40px 20px; font-family:sans-serif; color:#e8dcc8;"><h1>Sample product update</h1><p>Hand-written HTML sent by the broadcast route. The footer below is injected.</p></div>
</BODY></html>`;

// Sample renders for the admin preview (?template=<key>) and test sends.
export const LANDMARK_PREVIEWS: EmailPreviews = {
  "ad-landmark-welcome": () => renderLandmarkWelcomeEmail(LANDMARK),
  "admin-update-footer": () => ({
    subject: "Sample product update",
    html: withUnsubscribeFooter(UPDATE_HTML, "https://thegitcity.com/api/unsubscribe?dev=0&cat=marketing&token=preview"),
  }),
};
