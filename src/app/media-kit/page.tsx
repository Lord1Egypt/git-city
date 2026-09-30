import { permanentRedirect } from "next/navigation";

// The media kit grew into the partners page.
export default function MediaKitPage() {
  permanentRedirect("/partners");
}
