import { pool } from '../config/db.js';
import { writePublicSitemap } from '../services/sitemapService.js';
try {
  const result = await writePublicSitemap();
  console.log(`Sitemap generated: ${result.output} (${result.count} URLs)`);
} catch (error) {
  console.error(`Sitemap generation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
