/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/games',
        destination: '/games/index.html',
        permanent: false,
      },
      {
        source: '/',
        destination: '/games/index.html',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
