import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "slelguoygbfzlpylpxfs.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fmanavehsizxybddlxtr.supabase.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
