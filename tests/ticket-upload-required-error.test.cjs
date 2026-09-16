const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('stage-two ticket upload errors render at the top and scroll into view', () => {
  const publicHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const publicBundle = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'index-CmsReadyAdminFix20260820.js'),
    'utf8',
  );
  const uploadErrorScript = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'ticket-upload-error-position-20260915.js'),
    'utf8',
  );

  assert.match(publicHtml, /index-CmsReadyAdminFix20260820\.js/);
  assert.match(
    publicHtml,
    /ticket-upload-error-position-20260915\.js\?v=20260915-ticket-upload-error-v1/,
  );
  assert.match(publicBundle, /m\.currentStep===2&&/);
  assert.match(publicBundle, /if\(!m\.ticketFile\)\{q\("بارگذاری فایل بلیت الزامی است\."\);return\}/);
  assert.match(uploadErrorScript, /بارگذاری فایل بلیت الزامی است/);
  assert.match(uploadErrorScript, /data-ticket-upload-error-top/);
  assert.match(uploadErrorScript, /role', 'alert'/);
  assert.match(uploadErrorScript, /insertBefore\(alert, headingBlock\.nextSibling\)/);
  assert.match(uploadErrorScript, /scrollIntoView/);
  assert.match(uploadErrorScript, /block: 'start'/);
});

test('stage-two continue action keeps the user on the step when the ticket is missing', () => {
  const publicBundle = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'index-CmsReadyAdminFix20260820.js'),
    'utf8',
  );
  const uploadErrorScript = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'ticket-upload-error-position-20260915.js'),
    'utf8',
  );

  assert.match(publicBundle, /if\(!m\.ticketFile\)\{q\("بارگذاری فایل بلیت الزامی است\."\);return\}/);
  assert.match(uploadErrorScript, /SUBMIT_TEXT_MARKER = 'ادامه و تکمیل پرسشنامه'/);
  assert.match(uploadErrorScript, /window\.setTimeout\(showAndScroll, 0\)/);
  assert.match(uploadErrorScript, /if \(!source\)/);
});
