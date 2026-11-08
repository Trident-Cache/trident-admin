const fs = require('fs');
const path = require('path');

// The SDK comes from the sibling folder (`file:../js-library`) in the
// monorepo, and from `./sdk` inside the published snapshot. Turbopack (the
// default bundler since Next 16) only resolves files under its root, so the
// root is the parent folder when the sibling SDK is there, and this project
// otherwise.
const sibling = path.join(__dirname, '..', 'js-library');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: fs.existsSync(sibling) ? path.join(__dirname, '..') : __dirname,
  },
  reactStrictMode: true,

  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        { key: 'Surrogate-Control', value: 'no-store' },
        { key: 'Pragma', value: 'no-cache' },
      ],
    },
  ],
};

module.exports = nextConfig;
