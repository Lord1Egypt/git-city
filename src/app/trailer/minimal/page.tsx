import type { Metadata } from "next";
import MinimalFilm from "./minimal-film";

// The trailer kit's smallest film (tools/trailer/README.md): runs on any fork, no data needed.

export const metadata: Metadata = {
  title: "Trailer minimal - Git City",
  robots: { index: false, follow: false },
};

export default function TrailerMinimalPage() {
  return <MinimalFilm />;
}
