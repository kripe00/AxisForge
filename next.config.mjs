/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', 'openscad-wasm'],
  },
};

export default nextConfig;
