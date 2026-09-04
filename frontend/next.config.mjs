/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the production Docker build — produces a minimal
  // `.next/standalone/server.js` that ships only the runtime deps
  // (slashes the image size from ~400MB to ~120MB). See specs/11-docker.md.
  output: 'standalone',
};

export default nextConfig;