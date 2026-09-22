import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  // The PDF routes read the .ttf files from disk at runtime, so nothing statically imports
  // them and the file trace would leave them out of the deployed function — react-pdf would
  // then silently fall back to Helvetica. Keys are route paths, values are globs from the
  // project root.
  outputFileTracingIncludes: {
    '/plans/[planId]/pdf': ['./src/pdf-fonts/**'],
    '/p/[slug]/pdf': ['./src/pdf-fonts/**'],
  },
};

export default nextConfig;
