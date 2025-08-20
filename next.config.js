
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable source maps in development to avoid console warnings
  productionBrowserSourceMaps: false,
  
  // Optimize for better performance
  swcMinify: true,
  
  // Ensure proper CSS processing
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
