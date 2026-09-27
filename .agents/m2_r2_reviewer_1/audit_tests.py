import re
import os

files = [
    'tests/e2e/tier1-feature-coverage.test.ts',
    'tests/e2e/tier2-boundary-corner.test.ts'
]

domain_keywords = [
    'evaluatePRNoise', 'verifyGitHubSignature', 'verifyDodoSignature', 'InMemoryPRQueue',
    'GeminiSynthesisService', 'checkCanConnectRepo', 'checkCanPublishRelease',
    'checkShouldShowViralBadge', 'handleDodoWebhook', 'WebhookIdempotencyStore',
    'generateWidgetApiResponse', 'renderSSRChangelog', 'isPRMerged',
    'GitHubPRClosedWebhookSchema', 'validateAndSanitizeMarkdownDraft',
    'formatSyndicationEmail', 'formatSocialThread', 'DodoCheckoutRequestSchema',
    'createCheckoutSession', 'validateSupabaseSchemaConstraint', 'evaluateMockRLS',
    'isReservedAppRoute', 'GeminiReleaseOutputSchema', 'sanitizeMarkdown',
    'fs.', 'document.', 'window.', 'import(', 'queue.', 'cn(', 'idempotencyStore',
    'projectStore', 'runSimulation', 'clearMockDatabaseRegistry'
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern to match: it('TC-T...: ...', ... () => { ... });
    # Since tests can be multi-line and nested, let's parse using test headers
    test_splits = re.split(r"(it\s*\(\s*['\"]TC-T[12]-F\d+-\d+:[^'\"]+['\"])", content)
    
    print(f"\n============================================================")
    print(f"FILE: {filepath}")
    print(f"============================================================")
    
    tests = []
    # test_splits has alternating: prefix/body, test_header, test_body, test_header, test_body...
    for i in range(1, len(test_splits), 2):
        header = test_splits[i]
        body = test_splits[i+1] if i+1 < len(test_splits) else ''
        # extract until next it( or describe(
        # Let's extract the function body of this test
        tests.append((header, body))

    print(f"Total test cases detected: {len(tests)}")
    
    no_domain_list = []
    tautology_list = []

    for header, raw_body in tests:
        # Extract just this test's block (up to the matching closing '});')
        # Simple heuristic: find first '});'
        idx = raw_body.find('});')
        body = raw_body[:idx] if idx != -1 else raw_body[:500]

        has_domain = any(kw in body for kw in domain_keywords)
        
        # Check for literal tautologies
        lines = [l.strip() for l in body.split('\n') if l.strip() and not l.strip().startswith('//')]
        test_tautologies = []
        for l in lines:
            # e.g. expect(x).toBe(x)
            m1 = re.search(r'expect\s*\(\s*([a-zA-Z0-9_]+)\s*\)\.toBe\s*\(\s*\1\s*\)', l)
            if m1:
                test_tautologies.append(l)
            # e.g. expect('abc').toBe('abc')
            m2 = re.search(r"expect\s*\(\s*(['\"][^'\"]*['\"])\s*\)\.toBe\s*\(\s*\1\s*\)", l)
            if m2:
                test_tautologies.append(l)
            # e.g. expect(1+1).toBe(3)
            if 'expect(1 + 1)' in l or 'expect(1+1)' in l:
                test_tautologies.append(l)
            # e.g. expect(true).toBe(true)
            if re.search(r'expect\s*\(\s*true\s*\)\.toBe\s*\(\s*true\s*\)', l):
                test_tautologies.append(l)
            # e.g. expect(false).toBe(false)
            if re.search(r'expect\s*\(\s*false\s*\)\.toBe\s*\(\s*false\s*\)', l):
                test_tautologies.append(l)
            # e.g. expect(event.event_id.length === 0).toBe(true)
            if re.search(r'expect\s*\([^)]*===[^)]*\)\.toBe\s*\(\s*(?:true|false)\s*\)', l):
                # Check if it's comparing local variables without any domain call
                if not has_domain:
                    test_tautologies.append(l)

        tc_id_match = re.search(r"TC-T[12]-F\d+-\d+", header)
        tc_id = tc_id_match.group(0) if tc_id_match else header

        if not has_domain:
            no_domain_list.append((tc_id, header, lines))
        if test_tautologies:
            tautology_list.append((tc_id, header, test_tautologies))

    print(f"Tests with NO recognized domain calls: {len(no_domain_list)}")
    for tc_id, header, lines in no_domain_list:
        print(f"  -> {tc_id}: {header}")
        for l in lines[:4]:
            print(f"       {l}")

    print(f"\nTests with suspected tautologies: {len(tautology_list)}")
    for tc_id, header, tauts in tautology_list:
        print(f"  -> {tc_id}: {tauts}")
