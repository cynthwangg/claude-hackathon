import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default config;
