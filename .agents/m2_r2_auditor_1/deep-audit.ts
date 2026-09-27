import ts from 'typescript';
import fs from 'fs';

const DOMAIN_IDENTIFIERS = new Set([
  'isPRMerged',
  'GitHubPRClosedWebhookSchema',
  'validateAndSanitizeMarkdownDraft',
  'formatSyndicationEmail',
  'formatSocialThread',
  'DodoCheckoutRequestSchema',
  'createCheckoutSession',
  'validateSupabaseSchemaConstraint',
  'evaluateMockRLS',
  'isReservedAppRoute',
  'evaluatePRNoise',
  'verifyGitHubSignature',
  'verifyDodoSignature',
  'InMemoryPRQueue',
  'GeminiSynthesisService',
  'GeminiReleaseOutputSchema',
  'CategoryItemSchema',
  'ReleaseCategoriesSchema',
  'DistributionSchema',
  'MarkdownDraftSchema',
  'checkCanConnectRepo',
  'checkCanPublishRelease',
  'checkShouldShowViralBadge',
  'WebhookIdempotencyStore',
  'handleDodoWebhook',
  'generateWidgetApiResponse',
  'renderSSRChangelog',
  'clearMockDatabaseRegistry',
  'sanitizeMarkdown',
  'dispatchMockPR',
  'runSimulation',
  'cn',
  'queue',
  'idempotencyStore',
  'projectStore',
  'aiService',
  'synthesisService',
  'CONVENTION_PREFIX_REGEX',
  'EXCLUSION_MARKER_REGEX',
  'EXCLUDED_LABELS',
  'readFileSync',
  'existsSync',
  'statSync',
  'gzipSync',
  'createElement',
  'localStorage',
  'sessionStorage'
]);

interface Finding {
  file: string;
  testId: string;
  line: number;
  type: 'TAUTOLOGY' | 'NO_DOMAIN_CALL' | 'LOCAL_DUMMY_ASSERTION' | 'ZERO_ASSERTIONS';
  details: string;
  codeSnippet: string;
}

const findings: Finding[] = [];

function checkFile(filePath: string) {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && (expr.text === 'it' || expr.text === 'test')) {
        const [titleArg, fnArg] = node.arguments;
        if (titleArg && ts.isStringLiteral(titleArg) && fnArg && (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg))) {
          const testTitle = titleArg.text;
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const testCode = fnArg.body.getText(sourceFile);

          let expectCount = 0;
          const identifiersInTest = new Set<string>();

          function scanInner(inner: ts.Node) {
            if (ts.isIdentifier(inner)) {
              identifiersInTest.add(inner.text);
            }
            if (ts.isCallExpression(inner)) {
              const callText = inner.expression.getText(sourceFile);
              if (callText === 'expect' || callText.endsWith('.expect')) {
                expectCount++;
              }
            }
            ts.forEachChild(inner, scanInner);
          }

          scanInner(fnArg.body);

          if (expectCount === 0) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'ZERO_ASSERTIONS',
              details: 'Test has 0 expect() calls',
              codeSnippet: testCode.slice(0, 150)
            });
          }

          // Check if ANY domain identifier is referenced
          const domainRefs = Array.from(identifiersInTest).filter(id => DOMAIN_IDENTIFIERS.has(id));
          if (domainRefs.length === 0 && !testCode.includes('import(')) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'NO_DOMAIN_CALL',
              details: 'No domain contracts, schemas, or helpers referenced',
              codeSnippet: testCode.slice(0, 150)
            });
          }

          // Specific suspicious patterns:
          if (/expect\s*\(\s*event\.event_id\.length\s*===/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts only on local inline object property (event.event_id.length === 0)',
              codeSnippet: testCode.trim()
            });
          }

          if (/expect\s*\(\s*fakeLargeBuffer\.length\s*>\s*MAX_LIMIT\s*\)\.toBe\(true\)/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts on local buffer length comparison without calling check-widget-size',
              codeSnippet: testCode.trim()
            });
          }

          if (/count\s*>\s*99\s*\?\s*['"]99\+['"]/i.test(testCode) && !testCode.includes('public/widget.js')) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts on inline ternary count > 99 without testing widget implementation',
              codeSnippet: testCode.trim()
            });
          }

          if (/safeSet\s*=\s*\([^)]*\)\s*=>/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Defines and tests a local mock function safeSet instead of application code',
              codeSnippet: testCode.trim()
            });
          }

          if (/publishedAt\s*=\s*new\s*Date\(\)\.getTime\(\)/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts Date.now() timestamp on local variable without testing publication contract',
              codeSnippet: testCode.trim()
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const files = [
  'tests/e2e/tier1-feature-coverage.test.ts',
  'tests/e2e/tier2-boundary-corner.test.ts',
  'tests/e2e/tier3-cross-feature.test.ts',
  'tests/e2e/tier4-application-scenarios.test.ts'
];

for (const f of files) {
  checkFile(f);
}

console.log(`\n=== DEEP AST AUDIT RESULTS ===`);
console.log(`Total Findings: ${findings.length}\n`);

for (const finding of findings) {
  console.log(`[${finding.type}] ${finding.file}:${finding.line}`);
  console.log(`  Test: ${finding.testId}`);
  console.log(`  Details: ${finding.details}`);
  console.log(`  Snippet: ${finding.codeSnippet.replace(/\n\s*/g, ' ')}\n`);
}

