import type { NextConfig } from "next";

const nextConfig:NextConfig = {
  eslint: {
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.rdpdatacenter.in',
        port: '',
        pathname: '/profiles/**',
      }
    ],
  }
};

export default nextConfig;

