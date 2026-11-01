import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React-Leaflet 5's MapContainer is incompatible with React's dev-only
  // Strict Mode effect replay; it can leave a removed Leaflet instance
  // attached to a reused DOM node during development navigation.
  reactStrictMode: false,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
