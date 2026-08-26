const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bundlePath = path.join(__dirname, '..', 'assets', 'index-CmsReadyAdminFix20260820.js');
const source = fs.readFileSync(bundlePath, 'utf8');
const renderStart = source.indexOf('return xl.useEffect');
const successBranchStart = source.indexOf('m.currentStep===4&&s.jsxs("div"', renderStart);

assert.notEqual(renderStart, -1, 'claim-flow render function was not found');
assert.notEqual(successBranchStart, -1, 'final success branch was not found');

let parenDepth = 0;
let braceDepth = 0;
let bracketDepth = 0;
let quote = null;
let escaped = false;

for (let index = renderStart; index < successBranchStart; index += 1) {
  const character = source[index];

  if (quote) {
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === quote) quote = null;
    continue;
  }

  if (character === '"' || character === "'" || character === '`') {
    quote = character;
    continue;
  }

  if (character === '(') parenDepth += 1;
  else if (character === ')') parenDepth -= 1;
  else if (character === '{') braceDepth += 1;
  else if (character === '}') braceDepth -= 1;
  else if (character === '[') bracketDepth += 1;
  else if (character === ']') bracketDepth -= 1;
}

assert.deepEqual(
  { parenDepth, braceDepth, bracketDepth },
  { parenDepth: 1, braceDepth: 1, bracketDepth: 1 },
  'the final success card must be a sibling of the step panels, not a child of step 3',
);

console.log('claim-final-step-structure: PASS');
