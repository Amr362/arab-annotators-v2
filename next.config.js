/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify removed (default in Next 14, no longer a config option)

  // Prevent ESLint errors from failing Vercel build
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: [
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
