
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['@genkit-ai/googleai', '@genkit-ai/firebase', 'genkit', '@genkit-ai/next'],
  experimental: {
    allowedDevOrigins: [
      "https://9005-firebase-studio-1748345624802.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev",
      "https://9000-firebase-studio-1748345624802.cluster-hf4yr35cmnbd4vhbxvfvc6cp5q.cloudworkstations.dev"
    ],
  },
};

export default nextConfig;
