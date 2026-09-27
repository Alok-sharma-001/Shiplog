import fs from 'node:fs';
import path from 'node:path';

const testFiles = [
  'tests/e2e/tier1-feature-coverage.test.ts',
  'tests/e2e/tier2-boundary-corner.test.ts',
  'tests/e2e/tier3-cross-feature.test.ts',
  'tests/e2e/tier4-application-scenarios.test.ts',
];

console.log('=== TEST SUITE STATIC AUDIT ===\n');

for (const file of testFiles) {
  const fullPath = path.resolve('/home/alok/Projects_Antigravity/bsAK', file);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Check for skipped tests
  const skippedIt = (content.match(/\b(it\.skip|xit|test\.skip|xtest)\b/g) || []).length;
  const skippedDesc = (content.match(/\b(describe\.skip|xdescribe)\b/g) || []).length;
  const onlyCalls = (content.match(/\b(it\.only|test\.only|describe\.only)\b/g) || []).length;

  // Extract all "it('..." or "test('..." blocks
  const testBlocks = content.match(/it\s*\(\s*['"`](.*?)['"`]\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\)/g) || [];

  // Count total "it(" calls
  const itMatches = content.match(/\bit\s*\(/g) || [];

  // Check empty tests
  let emptyCount = 0;
  let noExpectCount = 0;
  for (const block of testBlocks) {
    const bodyMatch = block.match(/=>\s*\{([\s\S]*)\}/);
    const body = bodyMatch ? bodyMatch[1].trim() : '';
    if (!body || body.length === 0) {
      emptyCount++;
    }
    if (!body.includes('expect(')) {
      noExpectCount++;
      console.log(`[NO EXPECT] in ${file}:`, block.slice(0, 100));
    }
  }

  console.log(`File: ${file}`);
  console.log(`  Total test statements (it): ${itMatches.length}`);
  console.log(`  Parsed full test blocks: ${testBlocks.length}`);
  console.log(`  Skipped tests: ${skippedIt}, Skipped suites: ${skippedDesc}`);
  console.log(`  Exclusive tests (.only): ${onlyCalls}`);
  console.log(`  Empty test bodies: ${emptyCount}`);
  console.log(`  Tests without expect(): ${noExpectCount}\n`);
}
