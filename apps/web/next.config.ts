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
  webpack(config) {
    // Workspace packages use ESM-style ".js" imports that point to ".ts" sources.
    // Without this alias webpack can't find the actual files during bundling.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default nextConfig
