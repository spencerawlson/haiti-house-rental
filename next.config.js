/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trace files from this folder only (another lockfile higher up on a
  // dev machine made Next guess the wrong root for the standalone build).
  outputFileTracingRoot: __dirname,
  // Baseline security headers (Phase 1b). No CSP yet: the inline theme
  // script and Leaflet need a nonce-based policy, planned separately.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
