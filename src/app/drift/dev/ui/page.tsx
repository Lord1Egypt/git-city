import { notFound } from "next/navigation";
import UiPreview from "./preview";

// Throwaway: the drift results card with sample numbers, to look at without driving a lap. Dev only.
export default function DriftUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiPreview />;
}
