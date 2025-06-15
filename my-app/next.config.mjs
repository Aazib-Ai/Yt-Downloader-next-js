/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
    serverActions: true,
  },
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  // Increase timeout for API routes
  serverRuntimeConfig: {
    // Will only be available on the server side
    apiTimeout: 600000, // 10 minutes in milliseconds
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
    apiTimeout: 600000,
  },
}

export default nextConfig
