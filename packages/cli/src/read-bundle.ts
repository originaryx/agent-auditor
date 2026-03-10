/**
 * Node.js bundle reading for CLI.
 *
 * Calls @peac/audit readDisputeBundle() directly with Buffer
 * (yauzl requires Buffer.copy() which Uint8Array doesn't have).
 */

import { readDisputeBundle } from '@peac/audit';
import type { BundleReadResult } from '@originaryx/agent-auditor-core';

export async function readBundle(data: Buffer): Promise<BundleReadResult> {
  const result = await readDisputeBundle(data);

  if (!result.ok) {
    return {
      ok: false,
      code: result.error.code,
      message: result.error.message,
    };
  }

  const bundle = result.value;

  // Convert Map<string, string> receipts to string[]
  const receipts: string[] = [];
  if (bundle.receipts instanceof Map) {
    for (const jws of bundle.receipts.values()) {
      receipts.push(jws);
    }
  }

  const keys = bundle.keys ?? { keys: [] };

  return {
    ok: true,
    manifest: bundle.manifest as Record<string, unknown>,
    receipts,
    keys: keys as Record<string, unknown>,
    files: ['manifest.json', 'receipts.ndjson', 'keys/keys.json'],
  };
}
