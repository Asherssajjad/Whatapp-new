import type { NextConfig } from 'next';

// Backend base URL — strips /api suffix if present
const backendBase = (process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:8080');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Proxy /webhook to Express backend so Meta webhook URL stays unchanged
  async rewrites() {
    return [
      {
        source: '/webhook',
        destination: `${backendBase}/webhook`,
      },
    ];
  },
};

export default nextConfig;
