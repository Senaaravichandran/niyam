import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://niyam-ivory.vercel.app").replace(/\/$/, "");

const ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/console", priority: 0.9 },
  { path: "/try", priority: 0.8 },
  { path: "/jatayu", priority: 0.8 },
  { path: "/architecture", priority: 0.7 },
  { path: "/research", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE}${r.path === "/" ? "" : r.path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: r.priority,
  }));
}
