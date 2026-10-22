import type { NextConfig } from "next";

const isCapacitor = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  ...(isCapacitor ? { output: "export" as const } : {}),
  allowedDevOrigins: ["192.168.1.28"],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;