import ts from 'typescript';
import fs from 'fs';

interface TestAuditResult {
  suite: string;
  testName: string;
  line: number;
  assertionCount: number;
  assertions: string[];
  calledFunctions: string[];
  referencedIdentifiers: string[];
  isTrivialOrSelfCertifying: boolean;
  reason?: string;
}

const DOMAIN_SYMBOLS = new Set([
  'isPRMerged', 'GitHubPRClosedWebhookSchema', 'validateAndSanitizeMarkdownDraft',
  'formatSyndicationEmail', 'formatSocialThread', 'DodoCheckoutRequestSchema',
  'createCheckoutSession', 'validateSupabaseSchemaConstraint', 'evaluateMockRLS',
  'isReservedAppRoute', 'evaluatePRNoise', 'verifyGitHubSignature', 'verifyDodoSignature',
  'InMemoryPRQueue', 'GeminiSynthesisService', 'GeminiReleaseOutputSchema',
  'CategoryItemSchema', 'ReleaseCategoriesSchema', 'DistributionSchema',
  'checkCanConnectRepo', 'checkCanPublishRelease', 'checkShouldShowViralBadge',
  'WebhookIdempotencyStore', 'handleDodoWebhook', 'generateWidgetApiResponse',
  'renderSSRChangelog', 'clearMockDatabaseRegistry', 'sanitizeMarkdown',
  'queue', 'idempotencyStore', 'projectStore', 'synthesisService',
  'CONVENTION_PREFIX_REGEX', 'EXCLUSION_MARKER_REGEX', 'EXCLUDED_LABELS',
  'readFileSync', 'existsSync', 'statSync', 'createElement', 'cn'
]);

function auditFile(filePath: string): TestAuditResult[] {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  const results: TestAuditResult[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && (expr.text === 'it' || expr.text === 'test')) {
        const [titleArg, fnArg] = node.arguments;
        if (titleArg && ts.isStringLiteral(titleArg) && fnArg && (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg))) {
          const testTitle = titleArg.text;
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

          let assertionCount = 0;
          const assertions: string[] = [];
          const calledFunctions: string[] = [];
          const referencedIdentifiers: string[] = [];
          let isTrivial = false;
          let trivialReason: string | undefined;

          function inspectTest(innerNode: ts.Node) {
            // Find expect calls
            if (ts.isCallExpression(innerNode)) {
              let current: ts.LeftHandSideExpression = innerNode.expression;
              // Check if chain starts with expect(...)
              const callText = innerNode.getText(sourceFile);
              if (callText.startsWith('expect(')) {
                // If it's the full matcher call (e.g. expect(x).toBe(y))
                if (ts.isPropertyAccessExpression(current)) {
                  assertionCount++;
                  assertions.push(callText);

                  // Check trivial patterns
                  // e.g. expect(true).toBe(true)
                  if (/expect\((true|false|\d+)\)\.toBe\(\1\)/.test(callText.replace(/\s+/g, ''))) {
                    isTrivial = true;
                    trivialReason = `Tautology: ${callText}`;
                  }
                  // e.g. expect(-42 > 0).toBe(false)
                  if (/expect\(-?\d+[><]-?\d+\)\.toBe\(/.test(callText.replace(/\s+/g, ''))) {
                    isTrivial = true;
                    trivialReason = `Primitive comparison tautology: ${callText}`;
                  }
                  // e.g. expect(typeof describe).toBe('function')
                  if (/expect\(typeofdescribe\)\.toBe/.test(callText.replace(/\s+/g, ''))) {
                    isTrivial = true;
                    trivialReason = `Trivial test-runner assertion: ${callText}`;
                  }
                  // e.g. expect(1 + 1).toBe(3)
                  if (/expect\(1\+1\)\.toBe/.test(callText.replace(/\s+/g, ''))) {
                    isTrivial = true;
                    trivialReason = `Literal math assertion: ${callText}`;
                  }
                  // e.g. expect(oldId === newId).toBe(false)
                  if (/expect\(oldId===newId\)\.toBe\(false\)/.test(callText.replace(/\s+/g, ''))) {
                    isTrivial = true;
                    trivialReason = `Trivial variable inequality: ${callText}`;
                  }
                }
              }

              // Check function calls
              if (ts.isIdentifier(current)) {
                calledFunctions.push(current.text);
              } else if (ts.isPropertyAccessExpression(current)) {
                calledFunctions.push(current.name.text);
                if (ts.isIdentifier(current.expression)) {
                  calledFunctions.push(`${current.expression.text}.${current.name.text}`);
                }
              }
            }

            if (ts.isIdentifier(innerNode)) {
              referencedIdentifiers.push(innerNode.text);
            }

            ts.forEachChild(innerNode, inspectTest);
          }

          inspectTest(fnArg.body);

          // Check if test has any domain call or domain identifier
          const hasDomainSymbol = referencedIdentifiers.some(id => DOMAIN_SYMBOLS.has(id));

          if (assertionCount === 0) {
            isTrivial = true;
            trivialReason = 'No assertions (0 expect calls)';
          } else if (!hasDomainSymbol) {
            isTrivial = true;
            trivialReason = 'No domain contracts, schemas, or helpers referenced';
          }

          results.push({
            suite: filePath,
            testName: testTitle,
            line: line + 1,
            assertionCount,
            assertions,
            calledFunctions,
            referencedIdentifiers,
            isTrivialOrSelfCertifying: isTrivial,
            reason: trivialReason
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

const filesToAudit = [
  'tests/e2e/tier1-feature-coverage.test.ts',
  'tests/e2e/tier2-boundary-corner.test.ts',
  'tests/e2e/tier3-cross-feature.test.ts',
  'tests/e2e/tier4-application-scenarios.test.ts'
];

let totalTests = 0;
let totalFailed = 0;

for (const f of filesToAudit) {
  const res = auditFile(f);
  totalTests += res.length;
  const failed = res.filter(r => r.isTrivialOrSelfCertifying);
  totalFailed += failed.length;
  console.log(`\n============================================================`);
  console.log(`File: ${f}`);
  console.log(`  Tests found: ${res.length}`);
  console.log(`  Failed integrity/AST checks: ${failed.length}`);
  if (failed.length > 0) {
    for (const fail of failed) {
      console.log(`    ❌ [Line ${fail.line}] ${fail.testName}`);
      console.log(`       Reason: ${fail.reason}`);
    }
  } else {
    console.log(`  ✅ 100% of tests passed AST integrity checks!`);
  }
}

console.log(`\n============================================================`);
console.log(`AST AUDIT SUMMARY: Total tests audited: ${totalTests}, Violations: ${totalFailed}`);
if (totalFailed > 0) {
  process.exit(1);
}
