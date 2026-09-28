import type { Metadata } from "next";
import KitPage from "./kit-page";

// The trailer kit's landing page: the Towns teaser, the one command that
// installs the game-trailer skill (which carries the kit), and what Claude
// does with it. The films themselves play under /trailer/minimal, /demo, /towns.

const TITLE = "Trailer kit - Git City";
const DESCRIPTION =
  "Claude makes your game's trailer: played live in your engine, recorded in one take. One command installs the skill.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, images: ["/trailer-kit/towns-teaser.jpg"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/trailer-kit/towns-teaser.jpg"] },
};

export default function TrailerKitPage() {
  return <KitPage />;
}
