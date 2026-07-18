/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.VERCEL
    ? {}
    : { turbopack: { root: __dirname }, outputFileTracingRoot: __dirname }),
};

module.exports = nextConfig;
