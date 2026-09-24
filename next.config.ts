import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Thêm dòng này để build ra các file tĩnh cho Capacitor
  allowedDevOrigins: ["192.168.1.28"],
  images: {
    unoptimized: true, // Bắt buộc phải có khi dùng output: "export" với thẻ next/image
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;