import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node-postgres is only loaded for a non-Neon connection string; keep it
  // out of the bundle so Next does not try to trace its optional drivers.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
