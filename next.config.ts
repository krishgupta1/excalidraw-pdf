/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tells Next.js NOT to bundle these packages
  // We include both flags to be safe across different Next.js versions
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  },
};

module.exports = nextConfig;