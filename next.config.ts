import path from 'path';
import { NextConfig } from 'next';
import { Configuration } from 'webpack';

const nextConfig: NextConfig = {
  reactStrictMode: true,
   eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config: Configuration) {
    if (config.resolve) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@': path.resolve(__dirname, 'src'),
      };
    }
    return config;
  },
};

export default nextConfig;
