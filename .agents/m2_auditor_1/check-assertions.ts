import fs from 'node:fs';
import ts from 'typescript';

const testFiles = [
  'tests/e2e/tier1-feature-coverage.test.ts',
  'tests/e2e/tier2-boundary-corner.test.ts',
  'tests/e2e/tier3-cross-feature.test.ts',
  'tests/e2e/tier4-application-scenarios.test.ts',
];

for (const file of testFiles) {
  const content = fs.readFileSync(`/home/alok/Projects_Antigravity/bsAK/${file}`, 'utf8');
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

  const matcherCounts: Record<string, number> = {};
  let tautologyCount = 0;

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      // Check if node is matcher call: expect(A).matcher(B)
      if (ts.isPropertyAccessExpression(node.expression)) {
        const matcherName = node.expression.name.text;
        const inner = node.expression.expression;
        if (ts.isCallExpression(inner) && inner.expression.getText(sourceFile) === 'expect') {
          matcherCounts[matcherName] = (matcherCounts[matcherName] || 0) + 1;

          const actualArg = inner.arguments[0]?.getText(sourceFile);
          const expectedArg = node.arguments[0]?.getText(sourceFile);

          // Check if actualArg is literally equal to expectedArg (e.g. expect(1).toBe(1))
          if (actualArg && expectedArg && actualArg === expectedArg) {
            console.log(`[POTENTIAL TAUTOLOGY] in ${file}: expect(${actualArg}).${matcherName}(${expectedArg})`);
            tautologyCount++;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  console.log(`File: ${file}`);
  console.log(`  Matchers:`, matcherCounts);
  console.log(`  Tautologies: ${tautologyCount}\n`);
}
