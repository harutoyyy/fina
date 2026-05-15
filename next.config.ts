import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "0.0.0.0", "127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jeeuvubjmqoxtitgiugw.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./prisma/**/*"],
  },
};

export default nextConfig;
