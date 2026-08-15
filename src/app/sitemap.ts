import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sound-clash-nu.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/browse", "/career", "/leaderboards", "/patch-notes"];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
