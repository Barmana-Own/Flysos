const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const bundlePath = path.join(repoRoot, 'assets', 'index-CmsReadyAdminFix20260820.js');
const indexPath = path.join(repoRoot, 'index.html');

test('footer service links recover the tracking route from legacy home CMS values', () => {
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  const footerStart = bundle.indexOf('function mx({setActivePage');
  const footerEnd = bundle.indexOf('const xx=', footerStart);

  assert.notEqual(footerStart, -1, 'active footer component was not found');
  assert.notEqual(footerEnd, -1, 'footer component boundary was not found');

  const footer = bundle.slice(footerStart, footerEnd);
  assert.match(
    footer,
    /S=\(I,Q\)=>\{const ne=Bb\(I\),W=String\(Q\|\|""\)\.trim\(\);return[^;]*ne==="home"\?"\/track"/u,
    'legacy service links must resolve to /track',
  );
  assert.match(footer, /S\(W,Q\.label\)/u, 'service labels must participate in route resolution');
  assert.match(footer, /g\(W,Q\.label\)/u, 'service clicks must update the active tracking page');

  const index = fs.readFileSync(indexPath, 'utf8');
  assert.match(index, /index-CmsReadyAdminFix20260820\.js\?v=20260916-claim-assignment-selector-v1/u);
});
