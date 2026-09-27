import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const testFiles = [
  'tests/e2e/tier1-feature-coverage.test.ts',
  'tests/e2e/tier2-boundary-corner.test.ts',
  'tests/e2e/tier3-cross-feature.test.ts',
  'tests/e2e/tier4-application-scenarios.test.ts',
];

console.log('=== AST-LEVEL TEST SUITE AUDIT ===\n');

for (const file of testFiles) {
  const fullPath = path.resolve('/home/alok/Projects_Antigravity/bsAK', file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

  let itCount = 0;
  let describeCount = 0;
  let expectCount = 0;
  const testsWithoutExpect: string[] = [];

  function visit(node: ts.Node, currentTestTitle?: string) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      let callName = '';
      if (ts.isIdentifier(expr)) {
        callName = expr.text;
      } else if (ts.isPropertyAccessExpression(expr)) {
        callName = `${expr.expression.getText(sourceFile)}.${expr.name.text}`;
      }

      if (callName === 'describe') {
        describeCount++;
      } else if (callName === 'expect') {
        expectCount++;
      } else if (callName === 'it' || callName === 'test') {
        itCount++;
        const titleArg = node.arguments[0];
        const title = titleArg && ts.isStringLiteral(titleArg) ? titleArg.text : 'unknown';
        const callbackArg = node.arguments[1];
        
        let foundExpectInThisTest = 0;
        function checkExpect(subNode: ts.Node) {
          if (ts.isCallExpression(subNode)) {
            const subExpr = subNode.expression;
            let subName = '';
            if (ts.isIdentifier(subExpr)) subName = subExpr.text;
            else if (ts.isPropertyAccessExpression(subExpr)) {
              // could be expect(...).toBe(...)
              let cur: ts.Expression = subExpr;
              while (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) {
                if (ts.isCallExpression(cur)) cur = cur.expression;
                else if (ts.isPropertyAccessExpression(cur)) {
                  if (cur.expression.getText(sourceFile) === 'expect') {
                    subName = 'expect';
                    break;
                  }
                  cur = cur.expression;
                }
              }
            }
            if (subName === 'expect') {
              foundExpectInThisTest++;
            }
          }
          ts.forEachChild(subNode, checkExpect);
        }

        if (callbackArg) {
          checkExpect(callbackArg);
        }

        if (foundExpectInThisTest === 0) {
          testsWithoutExpect.push(title);
        }
      }
    }
    ts.forEachChild(node, (n) => visit(n, currentTestTitle));
  }

  visit(sourceFile);

  console.log(`File: ${file}`);
  console.log(`  Suites (describe): ${describeCount}`);
  console.log(`  Tests (it/test): ${itCount}`);
  console.log(`  Total expect() calls: ${expectCount}`);
  console.log(`  Tests without expect(): ${testsWithoutExpect.length}`);
  if (testsWithoutExpect.length > 0) {
    testsWithoutExpect.forEach((t) => console.log(`    - ${t}`));
  }
  console.log('');
}
