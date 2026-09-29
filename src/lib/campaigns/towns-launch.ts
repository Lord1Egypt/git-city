import { EMAIL_BASE_URL, button, heading, heroImage, paragraph, spacer, trackedUrl } from "../email/components";
import { renderLayout, renderText } from "../email/layout";
import type { CampaignDefinition, CampaignRenderContext } from "./types";

const CAMPAIGN = "towns_launch";

function announce(ctx: CampaignRenderContext) {
  const townsUrl = trackedUrl("/towns", CAMPAIGN);
  const buildings = ctx.stats.buildings.toLocaleString("en-US");
  const subject = "Claude vs Codex starts Monday";
  const preheader = "Pick your side. The side whose devs code more wins the week.";
  const lines = [
    `Git City just passed ${buildings} buildings. Now it has a war.`,
    "Pick your side. From Monday, the side whose devs code more wins the week. Every week.",
    "Meanwhile, drive into any town and knock its buildings down. Anyone's but yours.",
  ];
  const reason = "You're getting this because you have a building in Git City. We only email product news for big launches.";

  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: `${EMAIL_BASE_URL}/towns/opengraph-image`, href: townsUrl, alt: "Git City Towns: Claude vs Codex. Pick your side. Battle starts Monday." }),
    body: [heading("Claude vs Codex"), ...lines.map((l) => paragraph(l)), button("Pick your side", townsUrl)].join("\n"),
    reason,
    links: ctx.links,
  });
  const text = renderText({ lines: ["Claude vs Codex", "", ...lines.flatMap((l) => [l, ""]), `Pick your side: ${townsUrl}`], reason, links: ctx.links });
  return { subject, preheader, html, text };
}

// Players idle 180+ days: ask before sending them product news again. No
// click and product news turns off for them (campaign "sunset" action).
function repermission(ctx: CampaignRenderContext) {
  const buildings = ctx.stats.buildings.toLocaleString("en-US");
  const subject = "Still want Git City news?";
  const preheader = "Claude vs Codex starts Monday. Tell us if you want updates like this.";
  const lines = [
    `It's been a while. Git City passed ${buildings} buildings, and on Monday it starts a weekly war: Claude devs against Codex devs, and the side that codes more wins.`,
    "We'll only keep emailing you about launches like this if you say so.",
  ];
  const skip = "Not interested? Do nothing and we'll stop sending product news.";
  const reason = "You're getting this because you have a building in Git City and haven't visited in a while.";

  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: `${EMAIL_BASE_URL}/towns/opengraph-image`, href: ctx.confirmUrl, alt: "Git City Towns: Claude vs Codex. Pick your side. Battle starts Monday." }),
    body: [heading("Still want Git City news?"), ...lines.map((l) => paragraph(l)), button("Yes, keep me posted", ctx.confirmUrl), spacer(20), paragraph(skip, { muted: true })].join("\n"),
    reason,
    links: ctx.links,
  });
  const text = renderText({ lines: [subject, "", ...lines.flatMap((l) => [l, ""]), `Yes, keep me posted: ${ctx.confirmUrl}`, "", skip], reason, links: ctx.links });
  return { subject, preheader, html, text };
}

export const TOWNS_LAUNCH: CampaignDefinition = {
  slug: "towns-launch",
  topic: "product_news",
  // Engaged first, then outward; each cohort spread over days so a young
  // sending domain never jumps in volume (Resend/Postmark warm-up guides).
  schedule: [
    { cohort: "active30", offsetHours: 0, perDay: 5000 },
    { cohort: "active90", offsetHours: 3, perDay: 5000 },
    { cohort: "active180", offsetHours: 48, perDay: 5000 },
    { cohort: "dormant", offsetHours: 168, perDay: 5000 },
  ],
  variantFor: (cohort) => (cohort === "dormant" ? "repermission" : "announce"),
  render: (variant, ctx) => (variant === "repermission" ? repermission(ctx) : announce(ctx)),
};
