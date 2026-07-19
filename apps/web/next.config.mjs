/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Both workspace packages must be transpiled by Next: @handly/ui ships TS
  // source, and @handly/contracts' CommonJS build otherwise trips Fast Refresh
  // ("Cannot use 'import.meta'") when imported into client components in dev.
  transpilePackages: ['@handly/ui', '@handly/contracts'],
  // Milestone 1 ships without an ESLint config; keep production builds green.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
