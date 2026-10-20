import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build/server use its own output folder so it never
  // overwrites the files a running `npm run dev` is serving from `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Sales pages moved under /sales; keep old links working.
  async redirects() {
    return [
      { source: "/overview", destination: "/sales", permanent: true },
      { source: "/calls", destination: "/sales/calls", permanent: true },
      { source: "/calls/:id", destination: "/sales/calls/:id", permanent: true },
      { source: "/reps", destination: "/sales/reps", permanent: true },
      { source: "/reps/:name", destination: "/sales/reps/:name", permanent: true },
    ];
  },
};

export default nextConfig;
