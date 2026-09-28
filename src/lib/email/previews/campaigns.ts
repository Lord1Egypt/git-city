import { TOWNS_LAUNCH } from "../../campaigns/towns-launch";
import { LEGAL_POSTAL_ADDRESS } from "../../legal";
import { PREVIEW_LINKS, type EmailPreviews } from "./types";

const ctx = {
  login: "srizzon",
  links: { ...PREVIEW_LINKS, settingsUrl: "https://thegitcity.com/email-preferences?dev=0&token=preview", postalAddress: LEGAL_POSTAL_ADDRESS },
  confirmUrl: "https://thegitcity.com/email-preferences/confirm?dev=0&token=preview&campaign=0",
  stats: { buildings: 87591 },
};

// Sample renders for the admin preview (?template=<key>) and test sends.
export const CAMPAIGN_PREVIEWS: EmailPreviews = {
  "campaign-towns-launch": () => TOWNS_LAUNCH.render("announce", ctx),
  "campaign-towns-launch-repermission": () => TOWNS_LAUNCH.render("repermission", ctx),
};
