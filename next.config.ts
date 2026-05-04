import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// When run via `npx`, a lockfile also exists above this package (npx cache root).
// Without an explicit root, Turbopack can pick the wrong workspace and fail to resolve
// `.next/dev/.../build-manifest.json` for the app.
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: packageRoot,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'radix-ui',
      'date-fns',
      'react-day-picker',
    ],
  },
};

export default nextConfig;
