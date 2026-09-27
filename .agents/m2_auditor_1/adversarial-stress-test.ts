import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {
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
} from '../../tests/e2e/helpers/test-harness';

console.log('=== RUNNING ADVERSARIAL STRESS TESTS ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    failCount++;
  } else {
    passCount++;
  }
}

// 1. Noise Filter Adversarial Tests
console.log('1. Stress-testing Noise Filter...');
assert(evaluatePRNoise({ pr_number: 1, title: 'CHORE: uppercase' }).isNoise === true, 'Uppercase CHORE should be noise');
assert(evaluatePRNoise({ pr_number: 2, title: 'ci(linux): nested parens' }).isNoise === true, 'Scoped CI should be noise');
assert(evaluatePRNoise({ pr_number: 3, title: 'feat: valid feature with [SKIP]' }).isNoise === true, 'Uppercase [SKIP] should be noise');
assert(evaluatePRNoise({ pr_number: 4, title: 'feat: normal', body: 'some notes [internal]' }).isNoise === true, 'Body [internal] should be noise');
assert(evaluatePRNoise({ pr_number: 5, title: 'feat: normal', body: 'some notes [no-log]' }).isNoise === true, 'Body [no-log] should be noise');
assert(evaluatePRNoise({ pr_number: 6, title: 'feat: normal', labels: ['SKIP-CHANGELOG'] }).isNoise === true, 'Case-insensitive label skip-changelog');
assert(evaluatePRNoise({ pr_number: 7, title: 'feat: authentic feature' }).isNoise === false, 'Standard feat is not noise');
assert(evaluatePRNoise({ pr_number: 8, title: 'fix: authentic bugfix' }).isNoise === false, 'Standard fix is not noise');

// 2. Cryptographic HMAC Security
console.log('2. Stress-testing Crypto HMAC Verification...');
const secret = 'super_secret_test_key';
const body = JSON.stringify({ pr: 123, action: 'closed' });
const validSig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
const wrongSecretSig = 'sha256=' + crypto.createHmac('sha256', 'wrong_secret').update(body).digest('hex');
const tamperedBody = JSON.stringify({ pr: 123, action: 'opened' });

assert(verifyGitHubSignature(body, validSig, secret) === true, 'Valid signature verifies');
assert(verifyGitHubSignature(body, wrongSecretSig, secret) === false, 'Wrong secret fails');
assert(verifyGitHubSignature(tamperedBody, validSig, secret) === false, 'Tampered payload fails');
assert(verifyGitHubSignature(body, 'invalid_format', secret) === false, 'Invalid format fails');
assert(verifyGitHubSignature(body, '', secret) === false, 'Empty signature fails');
assert(verifyGitHubSignature(body, null, secret) === false, 'Null signature fails');

// Dodo Signature Bypass
assert(verifyDodoSignature(body, 'any', secret, true, 'test_bypass_key') === true, 'Dev bypass key works in dev');
assert(verifyDodoSignature(body, 'any', secret, false, 'test_bypass_key') === false, 'Dev bypass key rejected in prod');

// 3. Schema Strictness
console.log('3. Stress-testing Zod Schemas...');
let caughtExtraField = false;
try {
  GeminiReleaseOutputSchema.parse({
    release_title: 'v1.0.0 — Test',
    overview_summary: 'Sufficiently long overview summary',
    categories: { features: [], improvements: [], fixes: [] },
    distribution: { email_plain_text: 'Email body long enough', social_post_thread: ['Social post'] },
    extra_field: 'should fail',
  });
} catch {
  caughtExtraField = true;
}
assert(caughtExtraField, 'GeminiReleaseOutputSchema rejects unknown fields (strict)');

let caughtShortTitle = false;
try {
  GeminiReleaseOutputSchema.parse({
    release_title: 'AB',
    overview_summary: 'Sufficiently long overview summary',
    categories: { features: [], improvements: [], fixes: [] },
    distribution: { email_plain_text: 'Email body long enough', social_post_thread: ['Social post'] },
  });
} catch {
  caughtShortTitle = true;
}
assert(caughtShortTitle, 'GeminiReleaseOutputSchema rejects short title');

// 4. Feature Gating & Quotas
console.log('4. Stress-testing Feature Gating...');
assert(checkCanConnectRepo({ tier: 'free', active_repos_count: 0, monthly_releases_count: 0 }).allowed === true, 'Free 0 repos allowed');
assert(checkCanConnectRepo({ tier: 'free', active_repos_count: 1, monthly_releases_count: 0 }).allowed === false, 'Free 1 repo blocked from 2nd');
assert(checkCanConnectRepo({ tier: 'pro', active_repos_count: 100, monthly_releases_count: 100 }).allowed === true, 'Pro unlimited repos');

assert(checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 1 }).allowed === true, 'Free 1 release allowed');
assert(checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 2 }).allowed === false, 'Free 2 releases blocked from 3rd');
assert(checkCanPublishRelease({ tier: 'pro', active_repos_count: 1, monthly_releases_count: 100 }).allowed === true, 'Pro unlimited releases');

assert(checkShouldShowViralBadge(false) === true, 'Free shows viral badge');
assert(checkShouldShowViralBadge(true) === false, 'Pro suppresses viral badge');

// 5. Idempotency & Webhook handling
console.log('5. Stress-testing Webhook Idempotency...');
const idem = new WebhookIdempotencyStore();
const projects = new Map<string, { id: string; is_pro: boolean }>();
const evt1 = {
  event_id: 'evt_1001',
  type: 'subscription.created' as const,
  data: { customer_id: 'c1', project_id: 'p1', status: 'active', plan_id: 'pro' },
};
const res1 = handleDodoWebhook(evt1, idem, projects);
assert(res1.status === 'processed' && res1.is_pro === true, 'First event processed & upgraded to Pro');
const res2 = handleDodoWebhook(evt1, idem, projects);
assert(res2.status === 'already_processed' && res2.is_pro === true, 'Duplicate event detected as already_processed');

console.log(`\nStress Test Summary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exit(1);
}
