import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:9002', '127.0.0.1:61909'],
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  serverExternalPackages: [
    'express',
    '@genkit-ai/core',
    'genkit',
    '@genkit-ai/google-genai',
    '@opentelemetry/instrumentation',
    'import-in-the-middle',
    'require-in-the-middle',
    'node-llama-cpp',
    '@node-llama-cpp/win-x64',
    '@node-llama-cpp/win-arm64',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
