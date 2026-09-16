const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('admin claim loading includes saved message logs and notes', () => {
  const adminController = read('backend/controllers/adminController.js');

  assert.match(adminController, /SELECT[\s\S]+FROM MessageLog[\s\S]+WHERE claimId = \?/u);
  assert.match(adminController, /claim\.smsLogs\s*=\s*smsLogs\.map/u);
  assert.match(adminController, /SELECT[\s\S]+FROM ClaimNote[\s\S]+WHERE cn\.claimId = \?/u);
  assert.match(adminController, /claim\.notes\s*=\s*notes\.map/u);
});

test('dashboard claim loading keeps the same message and note contract', () => {
  const platformController = read('backend/controllers/platformController.js');

  assert.match(platformController, /SELECT[\s\S]+FROM MessageLog[\s\S]+WHERE claimId = \?/u);
  assert.match(platformController, /claim\.smsLogs\s*=\s*smsLogs\.map/u);
  assert.match(platformController, /SELECT[\s\S]+FROM ClaimNote[\s\S]+WHERE cn\.claimId = \?/u);
  assert.match(platformController, /claim\.notes\s*=\s*notes\.map/u);
});

test('direct SMS requests accept a related claim and pass it to the message log', () => {
  const schema = read('backend/validation/platformSchemas.js');
  const platformController = read('backend/controllers/platformController.js');

  assert.match(schema, /sendDirectSmsSchema[\s\S]+claimId/u);
  assert.match(platformController, /recordSmsLog\(/u);
  assert.match(platformController, /claimId:\s*body\.claimId/u);
  assert.match(platformController, /adminId:\s*req\.admin\.id/u);
});

test('admin SMS UI sends the selected related claim id to the API', () => {
  const mainBundle = read('assets/index-CmsReadyAdminFix20260820.js');
  const adminBundle = read('assets/AdminPanel-CmsReadyAdminFix20260820.js');

  assert.match(mainBundle, /body:JSON\.stringify\(\{message:u,.*claimId/u);
  assert.match(adminBundle, /rN\(Wr\.id,Fn\.trim\(\),Wr\.smsClaim\?\.id\)/u);
});
