const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('robots.txt keeps public pages crawlable and blocks internal paths', () => {
  const robots = fs.readFileSync(path.join(__dirname, '..', 'robots.txt'), 'utf8');

  assert.match(robots, /^User-agent:\s*\*/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.match(robots, /^Disallow:\s*\/admin\s*$/m);
  assert.match(robots, /^Disallow:\s*\/api\s*$/m);
  assert.match(robots, /^Disallow:\s*\/backend\s*$/m);
  assert.match(robots, /^Sitemap:\s*https:\/\/flysos\.ir\/sitemap\.xml\s*$/m);
});
