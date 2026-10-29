import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sql.js ships a WASM binary that we read from disk on the server.
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
  async rewrites() {
    // A2A discovery: every agent publishes its card at the well-known path under its own base URL.
    return [
      {
        source: "/a2a/:agent/.well-known/agent-card.json",
        destination: "/api/a2a/:agent/card",
      },
      { source: "/a2a/:agent", destination: "/api/a2a/:agent" },
      {
        source: "/.well-known/agent-card.json",
        destination: "/api/a2a/conductor/card",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
