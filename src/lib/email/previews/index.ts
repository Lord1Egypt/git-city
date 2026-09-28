import { CAMPAIGN_PREVIEWS } from "./campaigns";
import { GAME_PREVIEWS } from "./game";
import { LANDMARK_PREVIEWS } from "./landmarks";
import { TOWNS_PREVIEWS } from "./towns";
import type { EmailPreviews } from "./types";

export const EMAIL_PREVIEWS: EmailPreviews = {
  ...GAME_PREVIEWS,
  ...TOWNS_PREVIEWS,
  ...LANDMARK_PREVIEWS,
  ...CAMPAIGN_PREVIEWS,
};
