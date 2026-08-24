import fs from 'node:fs/promises';
import path from 'node:path';
import { query } from '../config/db.js';

const SITE_URL = String(process.env.PUBLIC_SITE_URL || 'https://flysos.ir').replace(/\/+$/, '');

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function pageUrl(row) {
  if (row.slug === 'home') return `${SITE_URL}/`;
  if (row.pageType === 'article') return `${SITE_URL}/articles/${encodeURIComponent(row.slug)}`;
  return `${SITE_URL}/${encodeURIComponent(row.slug)}`;
}

export async function writePublicSitemap() {
  const rows = await query(
    `SELECT slug,pageType,updatedAt FROM CmsPage WHERE status='published' AND publishedBlocks IS NOT NULL ORDER BY pageType,slug`
  );
  const fixed = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${SITE_URL}/claim`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${SITE_URL}/articles`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${SITE_URL}/flights`, priority: '0.7', changefreq: 'hourly' },
  ];
  const seen = new Set();
  const urls = [];
  for (const item of fixed) {
    if (seen.has(item.loc)) continue;
    seen.add(item.loc); urls.push(item);
  }
  for (const row of rows) {
    const loc = pageUrl(row);
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push({ loc, priority: row.pageType === 'article' ? '0.8' : '0.7', changefreq: row.pageType === 'article' ? 'monthly' : 'monthly', lastmod: row.updatedAt ? new Date(row.updatedAt).toISOString() : null });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((item) => `  <url><loc>${escapeXml(item.loc)}</loc>${item.lastmod ? `<lastmod>${escapeXml(item.lastmod)}</lastmod>` : ''}<changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
  const output = path.resolve(process.cwd(), '..', 'sitemap.xml');
  await fs.writeFile(output, xml, 'utf8');
  return { output, count: urls.length };
}
