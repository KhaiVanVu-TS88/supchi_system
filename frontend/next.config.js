/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Khai báo alias @ → thư mục gốc frontend
  // Đồng bộ với tsconfig.json paths
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname)
    if (process.env.NEXT_BUILD_LOW_MEMORY === '1') {
      config.parallelism = 1
    }
    return config
  },

  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },

  images: {
    domains: ['img.youtube.com', 'i.ytimg.com'],
  },
}

module.exports = nextConfig