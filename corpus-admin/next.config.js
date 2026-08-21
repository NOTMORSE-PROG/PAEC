/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['pg', 'pg-native'],
}
module.exports = nextConfig
