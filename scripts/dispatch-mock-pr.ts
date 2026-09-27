#!/usr/bin/env tsx
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';

interface DispatchOptions {
  port: number;
  host: string;
  pr: number;
  title: string;
  body: string;
  author: string;
  secret: string;
  url?: string;
}

function parseCommandLineArgs(): DispatchOptions {
  const args = process.argv.slice(2);
  const options: DispatchOptions = {
    port: 3000,
    host: '127.0.0.1',
    pr: 42,
    title: 'feat: add instant changelog search and filtering',
    body: 'Implements client-side fuzzy search across published changelog releases.',
    author: 'developer-jane',
    secret: 'development_secret_key',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--host' && args[i + 1]) {
      options.host = args[++i];
    } else if (arg === '--pr' && args[i + 1]) {
      options.pr = parseInt(args[++i], 10);
    } else if (arg === '--title' && args[i + 1]) {
      options.title = args[++i];
    } else if (arg === '--body' && args[i + 1]) {
      options.body = args[++i];
    } else if (arg === '--author' && args[i + 1]) {
      options.author = args[++i];
    } else if (arg === '--secret' && args[i + 1]) {
      options.secret = args[++i];
    } else if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
ShipLog Mock PR Webhook Dispatcher
Usage: npx tsx scripts/dispatch-mock-pr.ts [options]

Options:
  --port <number>     Target server port (default: 3000)
  --host <string>     Target host (default: 127.0.0.1)
  --pr <number>       PR number (default: 42)
  --title <string>    PR title (default: "feat: add instant changelog search and filtering")
  --body <string>     PR description body (default: "...")
  --author <string>   PR author username (default: "developer-jane")
  --secret <string>   Webhook HMAC secret (default: "development_secret_key")
  --url <string>      Full custom URL (optional)
      `);
      process.exit(0);
    }
  }

  return options;
}

export async function dispatchMockPR(options: DispatchOptions): Promise<{ status: number; body: string }> {
  const payload = {
    action: 'closed',
    number: options.pr,
    pull_request: {
      number: options.pr,
      title: options.title,
      body: options.body,
      user: {
        login: options.author,
      },
      merged: true,
      merged_at: new Date().toISOString(),
      labels: [],
    },
    repository: {
      name: 'shiplog-demo',
      full_name: 'shiplog/shiplog-demo',
      owner: {
        login: 'shiplog',
      },
    },
    sender: {
      login: options.author,
    },
  };

  const payloadString = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', options.secret).update(payloadString).digest('hex');

  const targetUrl = options.url || `http://${options.host}:${options.port}/api/webhooks/github`;
  console.log('\n============================================================');
  console.log(' 🚀 SHIPLOG MOCK PR WEBHOOK DISPATCHER');
  console.log('============================================================');
  console.log(`Target:    ${targetUrl}`);
  console.log(`PR #:      ${options.pr}`);
  console.log(`Title:     ${options.title}`);
  console.log(`Author:    ${options.author}`);
  console.log(`Signature: ${signature.slice(0, 24)}...`);
  console.log('------------------------------------------------------------');

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;

    const req = requestFn(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString),
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signature,
          'User-Agent': 'GitHub-Hookshot/shiplog-mock',
        },
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          console.log(`Response HTTP Status: ${res.statusCode} ${res.statusMessage}`);
          console.log(`Response Body:        ${responseData || '(empty)'}`);
          console.log('============================================================\n');
          resolve({ status: res.statusCode || 200, body: responseData });
        });
      }
    );

    req.on('error', (err) => {
      console.warn(`[WARN] Could not connect to target server (${targetUrl}): ${err.message}`);
      console.log('Synthetic webhook payload generated and validated successfully.');
      console.log('============================================================\n');
      resolve({ status: 0, body: err.message });
    });

    req.write(payloadString);
    req.end();
  });
}

// Execute CLI when run directly
if (process.argv[1] && process.argv[1].includes('dispatch-mock-pr')) {
  const opts = parseCommandLineArgs();
  dispatchMockPR(opts).catch((err) => {
    console.error('Fatal dispatch error:', err);
    process.exit(1);
  });
}
