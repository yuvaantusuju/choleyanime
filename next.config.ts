import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cloudflare's edge network doesn't optimize images. We disable the
  // built-in image optimization and let the browser load remote images
  // directly from animeheaven.me (the same way the upstream site does).
  images: {
    unoptimized: true,
  },
};

// Required by @opennextjs/cloudflare for `next dev` to work.
// In recent versions this takes no args.
initOpenNextCloudflareForDev();

export default nextConfig;
