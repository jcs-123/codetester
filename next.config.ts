import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM packages that must not be bundled into the server build.
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "bcryptjs", "exceljs"],
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    // Excel uploads (5 MB) go through Server Actions; leave headroom for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
