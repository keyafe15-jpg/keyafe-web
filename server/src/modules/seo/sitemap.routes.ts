import { Router } from "express";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";

export const sitemapRouter = Router();

/** Static, indexable routes. Private and transactional paths are excluded. */
const STATIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/get-quote", priority: "0.9", changefreq: "monthly" },
  { path: "/same-day", priority: "0.8", changefreq: "daily" },
  { path: "/healthy", priority: "0.6", changefreq: "weekly" },
  { path: "/pan-india", priority: "0.6", changefreq: "weekly" },
  { path: "/about", priority: "0.5", changefreq: "monthly" },
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, opts: { lastmod?: Date; priority?: string; changefreq?: string }) {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (opts.lastmod) parts.push(`    <lastmod>${opts.lastmod.toISOString().slice(0, 10)}</lastmod>`);
  if (opts.changefreq) parts.push(`    <changefreq>${opts.changefreq}</changefreq>`);
  if (opts.priority) parts.push(`    <priority>${opts.priority}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

/**
 * Generated rather than committed so new categories, products and tags are
 * discoverable without anyone remembering to update a static file.
 *
 * Must be served from the storefront's own origin to be valid, so in
 * production the web server should proxy /sitemap.xml here.
 */
sitemapRouter.get("/sitemap.xml", async (_req, res) => {
  // CLIENT_ORIGIN is the storefront's own origin, which is where these URLs
  // must resolve for the sitemap to be considered valid.
  const base = env.CLIENT_ORIGIN.replace(/\/$/, "");

  const [departments, categories, products, tags] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, isAvailable: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.tag.findMany({ select: { slug: true } }),
  ]);

  const entries = [
    ...STATIC_PATHS.map((s) =>
      urlEntry(`${base}${s.path}`, { priority: s.priority, changefreq: s.changefreq }),
    ),
    ...departments.map((d) =>
      urlEntry(`${base}/store/${d.slug}`, { lastmod: d.updatedAt, changefreq: "weekly" }),
    ),
    ...categories.map((c) =>
      urlEntry(`${base}/category/${c.slug}`, { lastmod: c.updatedAt, changefreq: "weekly" }),
    ),
    ...products.map((p) =>
      urlEntry(`${base}/product/${p.slug}`, { lastmod: p.updatedAt, changefreq: "weekly" }),
    ),
    ...tags.map((t) => urlEntry(`${base}/tag/${t.slug}`, { changefreq: "weekly" })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});
