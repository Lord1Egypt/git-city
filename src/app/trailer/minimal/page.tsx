import type { Metadata } from "next";
import MinimalFilm from "@trailer-kit/examples/MinimalFilm";

// The trailer kit's smallest film, straight from the kit
// (.claude/skills/game-trailer/kit/README.md): runs on any fork, no data needed.

export const metadata: Metadata = {
  title: "Trailer minimal - Git City",
  robots: { index: false, follow: false },
};

export default function TrailerMinimalPage() {
  return <MinimalFilm />;
}
