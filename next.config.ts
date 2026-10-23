import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) — alias Node.js built-ins to empty
  // so node-forge and xlsx bundle cleanly in the browser.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      fs: { browser: "./src/lib/empty.ts" },
      net: { browser: "./src/lib/empty.ts" },
      tls: { browser: "./src/lib/empty.ts" },
      stream: { browser: "./src/lib/empty.ts" },
      path: { browser: "./src/lib/empty.ts" },
      os: { browser: "./src/lib/empty.ts" },
    },
  },
  // Kept for environments that still run Webpack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        buffer: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
