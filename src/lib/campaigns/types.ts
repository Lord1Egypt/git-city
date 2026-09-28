import type { NotificationCategory } from "../notifications";
import type { EmailLinks } from "../email/layout";

/** How long ago a player was last active, which decides wave order and variant. */
export type Cohort = "active30" | "active90" | "active180" | "dormant";

export interface CohortSchedule {
  cohort: Cohort;
  /** Hours after the campaign starts when this cohort's first emails go out. */
  offsetHours: number;
  /** Most emails of this cohort sent per day; the rest roll to the next days. */
  perDay: number;
}

export interface CampaignRenderContext {
  login: string;
  links: EmailLinks;
  /** Signed link that confirms "keep sending me product news". */
  confirmUrl: string;
  stats: { buildings: number };
}

export interface RenderedCampaignEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

/** A campaign's template and audience rules. Code, so it's versioned in git. */
export interface CampaignDefinition {
  slug: string;
  topic: NotificationCategory;
  schedule: CohortSchedule[];
  variantFor: (cohort: Cohort) => string;
  render: (variant: string, ctx: CampaignRenderContext) => RenderedCampaignEmail;
}
