import type { Metadata } from "next";
import DemoFilm from "./demo-film";

// The trailer kit's demo film (.claude/skills/gg/kit/README.md): a short teaser in a
// world made in code, so it runs on any fork with no data. Not linked from
// anywhere.

export const metadata: Metadata = {
  title: "Trailer demo - Git City",
  robots: { index: false, follow: false },
};

export default function TrailerDemoPage() {
  return <DemoFilm />;
}
