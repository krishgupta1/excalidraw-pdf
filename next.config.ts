import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // This tells Next.js NOT to bundle these packages
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
};

export default nextConfig;