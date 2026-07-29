import type { MetadataRoute } from "next";

const SITE_URL = "https://www.uselenswise.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/app",
        "/inventory",
        "/sales",
        "/settings",
        "/account",
        "/admin",
        "/platform-admin",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
