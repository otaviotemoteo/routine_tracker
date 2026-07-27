import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // v1 routes folded into the Overview toggle (v2).
    return [
      { source: "/semana", destination: "/overview?view=week", permanent: true },
      { source: "/mes", destination: "/overview?view=month", permanent: true },
    ];
  },
};

export default nextConfig;
