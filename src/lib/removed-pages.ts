// Pages removed when Git City stopped taking money. Old links land on the
// city. Temporary redirects, so browsers don't cache them if a page returns.
export const REMOVED_PAGE_REDIRECTS = [
  { source: "/jobs/:path*", destination: "/", permanent: false },
  { source: "/hire/:path*", destination: "/", permanent: false },
  { source: "/for-companies", destination: "/", permanent: false },
  { source: "/advertise/:path*", destination: "/", permanent: false },
  { source: "/ads/:path*", destination: "/", permanent: false },
  { source: "/business/:path*", destination: "/", permanent: false },
  { source: "/sponsorship", destination: "/", permanent: false },
  { source: "/media-kit", destination: "/", permanent: false },
  { source: "/pitch", destination: "/", permanent: false },
] as const;
