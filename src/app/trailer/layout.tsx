import type { ReactNode } from "react";

// Every film page: the kit's studio in Git City's pixel font, and without the
// site's lo-fi radio (GlobalRadio floats bottom left on pages without its slot).

const CSS = `
.tk-studio { --tk-font: var(--font-pixel); }
body > .fixed.bottom-4.left-3 { display: none !important; }
`;

export default function TrailerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{CSS}</style>
      {children}
    </>
  );
}
