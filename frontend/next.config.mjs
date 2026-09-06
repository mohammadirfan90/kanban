/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the production Docker build — produces a minimal
  // `.next/standalone/server.js` that ships only the runtime deps
  // (slashes the image size from ~400MB to ~120MB). See specs/11-docker.md.
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    // Security headers applied to every response served by Next.js.
    // The API gets its own headers from helmet — these cover the
    // frontend origin only.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;