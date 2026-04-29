/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@receipts/shared"],
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
