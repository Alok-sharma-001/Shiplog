import fs from 'node:fs';
import path from 'node:path';

function auditFile(filePath: string, tierName: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`Checking ${tierName}...`);
  for (let f = 1; f <= 36; f++) {
    const fStr = f < 10 ? `0${f}` : `${f}`;
    // Match either Feature XX or Feature X
    const featureRegex = new RegExp(`describe\\(['"\`]Feature (${fStr}|${f}):`, 'i');
    if (!featureRegex.test(content)) {
      console.error(`  MISSING describe block for Feature ${f} in ${tierName}`);
      continue;
    }
    // Count TC-T*-FXX-*
    const tcRegex = new RegExp(`it\\(['"\`]TC-T[12]-F${fStr}-\\d+`, 'g');
    const matches = content.match(tcRegex) || [];
    if (matches.length < 5) {
      console.error(`  INSUFFICIENT tests for Feature ${f} in ${tierName}: found ${matches.length}, expected >= 5`);
    } else {
      // console.log(`  Feature ${fStr}: ${matches.length} tests`);
    }
  }
}

auditFile('/home/alok/Projects_Antigravity/bsAK/tests/e2e/tier1-feature-coverage.test.ts', 'Tier 1');
auditFile('/home/alok/Projects_Antigravity/bsAK/tests/e2e/tier2-boundary-corner.test.ts', 'Tier 2');
console.log('Feature matrix check completed.');
