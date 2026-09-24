import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  // The PDF routes, the share link preview and the story cards read the .ttf files from disk at runtime, so nothing statically imports
  // them and the file trace would leave them out of the deployed function — react-pdf would
  // then silently fall back to Helvetica (the preview would fail outright). Keys are route paths, values are globs from the
  // project root.
  outputFileTracingIncludes: {
    '/plans/[planId]/pdf': ['./src/pdf-fonts/**'],
    '/p/[slug]/pdf': ['./src/pdf-fonts/**'],
    '/p/[slug]/opengraph-image': ['./src/pdf-fonts/**'],
    '/p/[slug]/story/[design]/[day]': ['./src/pdf-fonts/**'],
  },
};

export default nextConfig;
