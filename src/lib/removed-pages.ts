// Pages removed when Git City stopped taking money. Old links land on the
// city. Temporary redirects, so browsers don't cache them if a page returns.
export const REMOVED_PAGE_REDIRECTS = [
  { source: "/jobs/:path*", destination: "/", permanent: false },
  { source: "/hire/:path*", destination: "/", permanent: false },
  { source: "/for-companies", destination: "/", permanent: false },
] as const;
