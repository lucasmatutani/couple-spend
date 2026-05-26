import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@splitwise/domain',
    '@splitwise/shared',
    '@splitwise/import-core',
    '@splitwise/import-ofx',
    '@splitwise/import-csv',
    '@splitwise/categorization',
  ],
}

export default nextConfig
