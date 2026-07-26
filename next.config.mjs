/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.framesdata.com",
        pathname: "/ColorSm/**",
      },
      {
        protocol: "https",
        hostname: "www.framesdata.com",
        pathname: "/Q120WEB/color_b/**",
      },
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
