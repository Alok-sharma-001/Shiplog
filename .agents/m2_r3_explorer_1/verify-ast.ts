import ts from 'typescript';
import fs from 'fs';
import path from 'path';

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
  type: string;
  details: string;
}

function checkSource(filePath: string, code: string): Finding[] {
  const findings: Finding[] = [];
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
            });
          }

          const domainRefs = Array.from(identifiersInTest).filter(id => DOMAIN_IDENTIFIERS.has(id));
          if (domainRefs.length === 0 && !testCode.includes('import(')) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'NO_DOMAIN_CALL',
              details: 'No domain contracts, schemas, or helpers referenced',
            });
          }

          if (/expect\s*\(\s*event\.event_id\.length\s*===/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts only on local inline object property (event.event_id.length === 0)',
            });
          }

          if (/expect\s*\(\s*fakeLargeBuffer\.length\s*>\s*MAX_LIMIT\s*\)\.toBe\(true\)/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts on local buffer length comparison without calling check-widget-size',
            });
          }

          if (/count\s*>\s*99\s*\?\s*['"]99\+['"]/i.test(testCode) && !testCode.includes('public/widget.js')) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts on inline ternary count > 99 without testing widget implementation',
            });
          }

          if (/safeSet\s*=\s*\([^)]*\)\s*=>/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Defines and tests a local mock function safeSet instead of application code',
            });
          }

          if (/publishedAt\s*=\s*new\s*Date\(\)\.getTime\(\)/i.test(testCode)) {
            findings.push({
              file: filePath,
              testId: testTitle,
              line: line + 1,
              type: 'LOCAL_DUMMY_ASSERTION',
              details: 'Asserts Date.now() timestamp on local variable without testing publication contract',
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// Read current files
let tier2Code = fs.readFileSync('tests/e2e/tier2-boundary-corner.test.ts', 'utf8');
let tier3Code = fs.readFileSync('tests/e2e/tier3-cross-feature.test.ts', 'utf8');

// Replacement 1: TC-T2-F19-04
const oldT2_F19_04 = `    it('TC-T2-F19-04: verifies publication timestamp is not in the future', () => {
      const publishedAt = new Date().getTime();
      expect(publishedAt).toBeLessThanOrEqual(Date.now() + 1000);
    });`;

const newT2_F19_04 = `    it('TC-T2-F19-04: verifies publication timestamp is not in the future', () => {
      const futureTimestamp = new Date(Date.now() + 86400000).toISOString();
      const futureRes = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: 'v1.0.0',
        release_title: 'Future Release',
        status: 'published',
        published_at: futureTimestamp,
      });
      expect(futureRes.valid).toBe(false);
      expect(futureRes.error).toMatch(/published_at cannot be in the future/);

      const validTimestamp = new Date().toISOString();
      const validRes = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: 'v1.0.0',
        release_title: 'Valid Release',
        status: 'published',
        published_at: validTimestamp,
      });
      expect(validRes.valid).toBe(true);
    });`;

// Replacement 2: TC-T2-F24-05
const oldT2_F24_05 = `    it('TC-T2-F24-05: check-widget-size script throws error if size exceeds limit', () => {
      const fakeLargeBuffer = Buffer.alloc(5121);
      expect(fakeLargeBuffer.length > MAX_LIMIT).toBe(true);
    });`;

const newT2_F24_05 = `    it('TC-T2-F24-05: check-widget-size script throws error if size exceeds limit', () => {
      const fakeLargeBuffer = Buffer.alloc(5121);
      const res = validateWidgetBundleSize(fakeLargeBuffer, MAX_LIMIT);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds limit/);
      expect(res.sizeBytes).toBe(5121);

      const scriptContent = fs.readFileSync(path.resolve(process.cwd(), 'scripts/check-widget-size.ts'), 'utf8');
      expect(scriptContent).toContain('process.exit(1)');
      expect(scriptContent).toContain('MAX_LIMIT_BYTES');
    });`;

// Replacement 3: TC-T2-F26-03
const oldT2_F26_03 = `    it('TC-T2-F26-03: formats large unread count (e.g. 150) to 99+', () => {
      const count = 150;
      const formatted = count > 99 ? '99+' : count.toString();
      expect(formatted).toBe('99+');
    });`;

const newT2_F26_03 = `    it('TC-T2-F26-03: formats large unread count (e.g. 150) to 99+', () => {
      localStorage.setItem('shiplog_unread_badge', '150');
      const stored = parseInt(localStorage.getItem('shiplog_unread_badge') || '0', 10);
      const formatted = formatUnreadCountBadge(stored);
      expect(formatted).toBe('99+');
      expect(formatUnreadCountBadge(99)).toBe('99');
      expect(formatUnreadCountBadge(100)).toBe('99+');
    });`;

// Replacement 4: TC-T2-F26-04
const oldT2_F26_04 = `    it('TC-T2-F26-04: handles localStorage exception in private browsing mode gracefully', () => {
      let memoryStore: Record<string, string> = {};
      const safeSet = (key: string, val: string) => {
        try {
          memoryStore[key] = val;
        } catch {
          // fallback
        }
      };
      safeSet('shiplog_unread_private', '2');
      expect(memoryStore['shiplog_unread_private']).toBe('2');
    });`;

const newT2_F26_04 = `    it('TC-T2-F26-04: handles localStorage exception in private browsing mode gracefully', () => {
      const widgetCode = fs.readFileSync(path.resolve(process.cwd(), 'public/widget.js'), 'utf8');
      expect(widgetCode).toMatch(/try\\s*\\{\\s*localStorage\\.setItem/);

      const store = new SafeLocalStorageStore(true);
      const saved = store.setItem('shiplog_unread_private', '2');
      expect(saved).toBe(false);
      expect(store.getItem('shiplog_unread_private')).toBe('2');
    });`;

// Replacement 5: TC-T2-F31-01
const oldT2_F31_01 = `    it('TC-T2-F31-01: handles missing event_id safely by rejecting event', () => {
      const event = { event_id: '', type: 'subscription.created' };
      expect(event.event_id.length === 0).toBe(true);
    });`;

const newT2_F31_01 = `    it('TC-T2-F31-01: handles missing event_id safely by rejecting event', () => {
      const res = validateSupabaseSchemaConstraint('dodo_webhook_events', {
        event_id: '',
        type: 'subscription.created',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/event_id/);
    });`;

// Replacement 6: TC-T3-16 in tier3
// Note tier3 needs imports: validateAndSanitizeMarkdownDraft, validateSupabaseSchemaConstraint
const oldT3Imports = `import {
  evaluatePRNoise,
  verifyGitHubSignature,
  verifyDodoSignature,
  InMemoryPRQueue,
  GeminiSynthesisService,
  CategoryItemSchema,
  ReleaseCategoriesSchema,
  DistributionSchema,
  GeminiReleaseOutputSchema,
  checkCanConnectRepo,
  checkCanPublishRelease,
  checkShouldShowViralBadge,
  WebhookIdempotencyStore,
  handleDodoWebhook,
  generateWidgetApiResponse,
  renderSSRChangelog,
  PublishedChangelog,
} from './helpers/test-harness';`;

const newT3Imports = `import {
  evaluatePRNoise,
  verifyGitHubSignature,
  verifyDodoSignature,
  InMemoryPRQueue,
  GeminiSynthesisService,
  CategoryItemSchema,
  ReleaseCategoriesSchema,
  DistributionSchema,
  GeminiReleaseOutputSchema,
  checkCanConnectRepo,
  checkCanPublishRelease,
  checkShouldShowViralBadge,
  WebhookIdempotencyStore,
  handleDodoWebhook,
  generateWidgetApiResponse,
  renderSSRChangelog,
  PublishedChangelog,
  validateAndSanitizeMarkdownDraft,
  validateSupabaseSchemaConstraint,
} from './helpers/test-harness';`;

const oldT3_16 = `    it('TC-T3-16: editor modifications are preserved upon publishing release', () => {
      const draft: PublishedChangelog = {
        id: 'draft_editor',
        project_id: 'p1',
        project_slug: 'demo',
        version_tag: 'v1.5.0',
        release_title: 'Draft Title',
        overview_summary: 'Draft summary from AI',
        categories: { features: [{ title: 'Feat', description: 'Desc' }], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
        published_at: '',
        status: 'draft',
      };

      // Founder reviews and edits
      draft.overview_summary = 'Founder reviewed and polished summary.';
      draft.status = 'published';
      draft.published_at = new Date().toISOString();

      expect(draft.status).toBe('published');
      expect(draft.overview_summary).toBe('Founder reviewed and polished summary.');
    });`;

const newT3_16 = `    it('TC-T3-16: editor modifications are preserved upon publishing release', () => {
      const draft: PublishedChangelog = {
        id: 'draft_editor',
        project_id: 'p1',
        project_slug: 'demo',
        version_tag: 'v1.5.0',
        release_title: 'Draft Title',
        overview_summary: 'Draft summary from AI',
        categories: { features: [{ title: 'Feat', description: 'Desc' }], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
        published_at: '',
        status: 'draft',
      };

      // Founder reviews and edits in inline editor
      const updatedOverview = 'Founder reviewed and polished summary with <script>evil()</script> sanitized.';
      const editResult = validateAndSanitizeMarkdownDraft({
        release_title: draft.release_title,
        overview_summary: updatedOverview,
        categories: draft.categories,
      });

      expect(editResult.valid).toBe(true);
      expect(editResult.sanitizedDraft?.overview_summary).not.toContain('<script>');
      expect(editResult.sanitizedDraft?.overview_summary).toBe('Founder reviewed and polished summary with  sanitized.');

      // Update draft and publish
      draft.overview_summary = editResult.sanitizedDraft!.overview_summary;
      draft.status = 'published';
      draft.published_at = new Date().toISOString();

      // Validate published record against database constraints
      const dbValidation = validateSupabaseSchemaConstraint('changelogs', {
        project_id: draft.project_id,
        version_tag: draft.version_tag,
        release_title: draft.release_title,
        status: draft.status,
        published_at: draft.published_at,
      });

      expect(dbValidation.valid).toBe(true);
      expect(draft.status).toBe('published');
      expect(draft.overview_summary).toBe('Founder reviewed and polished summary with  sanitized.');
    });`;

// Apply replacements
if (!tier2Code.includes(oldT2_F19_04)) console.error('T2 F19-04 not found');
if (!tier2Code.includes(oldT2_F24_05)) console.error('T2 F24-05 not found');
if (!tier2Code.includes(oldT2_F26_03)) console.error('T2 F26-03 not found');
if (!tier2Code.includes(oldT2_F26_04)) console.error('T2 F26-04 not found');
if (!tier2Code.includes(oldT2_F31_01)) console.error('T2 F31-01 not found');
if (!tier3Code.includes(oldT3Imports)) console.error('T3 Imports not found');
if (!tier3Code.includes(oldT3_16)) console.error('T3 16 not found');

tier2Code = tier2Code.replace(oldT2_F19_04, newT2_F19_04);
tier2Code = tier2Code.replace(oldT2_F24_05, newT2_F24_05);
tier2Code = tier2Code.replace(oldT2_F26_03, newT2_F26_03);
tier2Code = tier2Code.replace(oldT2_F26_04, newT2_F26_04);
tier2Code = tier2Code.replace(oldT2_F31_01, newT2_F31_01);

tier3Code = tier3Code.replace(oldT3Imports, newT3Imports);
tier3Code = tier3Code.replace(oldT3_16, newT3_16);

console.log('Testing modified Tier 2:');
const t2Findings = checkSource('tests/e2e/tier2-boundary-corner.test.ts', tier2Code);
console.log(`Tier 2 findings: ${t2Findings.length}`);
for (const f of t2Findings) {
  console.log(` - [${f.type}] Line ${f.line}: ${f.testId} -> ${f.details}`);
}

console.log('\nTesting modified Tier 3:');
const t3Findings = checkSource('tests/e2e/tier3-cross-feature.test.ts', tier3Code);
console.log(`Tier 3 findings: ${t3Findings.length}`);
for (const f of t3Findings) {
  console.log(` - [${f.type}] Line ${f.line}: ${f.testId} -> ${f.details}`);
}
