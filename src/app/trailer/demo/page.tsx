import type { Metadata } from "next";
import DemoFilm from "./demo-film";

// The trailer kit's smallest film (tools/trailer/README.md): runs on any fork, no data needed.

export const metadata: Metadata = {
  title: "Trailer demo - Git City",
  robots: { index: false, follow: false },
};

export default function TrailerDemoPage() {
  return <DemoFilm />;
}
