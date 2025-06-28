
import withGenkit from '@genkit-ai/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* your existing config... */
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
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['@genkit-ai/firebase'],
  },
  transpilePackages: ['@genkit-ai/googleai', 'genkit', '@genkit-ai/next'],
};

export default withGenkit(nextConfig);
