const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('sitemap.xml contains only canonical public site entries', () => {
  const sitemap = fs.readFileSync(path.join(repoRoot, 'sitemap.xml'), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(locations.includes('https://flysos.ir/'));
  assert.ok(locations.includes('https://flysos.ir/track'));
  assert.ok(locations.includes('https://flysos.ir/rights'));
  assert.ok(locations.includes('https://flysos.ir/terms'));
  assert.ok(locations.every((location) => location.startsWith('https://flysos.ir/')));
  assert.ok(!locations.some((location) => /\/(?:admin|api|backend)(?:\/|$)/.test(location)));
});

test('generated sitemap uses the public tracking route', () => {
  const service = fs.readFileSync(
    path.join(repoRoot, 'backend', 'services', 'sitemapService.js'),
    'utf8',
  );

  assert.match(service, /SITE_URL}\/track/);
  assert.doesNotMatch(service, /SITE_URL}\/claim/);
});
