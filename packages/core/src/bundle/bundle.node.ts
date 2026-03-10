/**
 * Node.js bundle reader using @peac/audit.
 *
 * Platform-specific adapter for reading PEAC dispute bundles in Node.js.
 * Delegates to @peac/audit's readDisputeBundle() for full spec compliance.
 */

import type { BundleReadOutcome, BundleReader } from './types.js';

/**
 * Create a Node.js bundle reader using @peac/audit.
 *
 * @param readDisputeBundle - The readDisputeBundle function from @peac/audit (injected)
 */
export function createNodeBundleReader(
  readDisputeBundle: (buffer: Uint8Array) => Promise<{ ok: true; value: NodeBundleValue } | { ok: false; error: { code: string; message: string } }>,
): BundleReader {
  return {
    async read(input: Uint8Array | ArrayBuffer): Promise<BundleReadOutcome> {
      const buffer = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

      const result = await readDisputeBundle(buffer);

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

      // Convert keys
      const keys = bundle.keys ?? { keys: [] };

      return {
        ok: true,
        manifest: bundle.manifest as Record<string, unknown>,
        receipts,
        keys: keys as Record<string, unknown>,
        policy: bundle.policy,
        peac_txt: bundle.peac_txt,
        bundle_sig: bundle.bundle_sig,
        files: ['manifest.json', 'receipts.ndjson', 'keys/keys.json'],
      };
    },
  };
}

/** Type for the @peac/audit bundle value (loosely typed to avoid direct import) */
interface NodeBundleValue {
  manifest: Record<string, unknown>;
  receipts: Map<string, string>;
  keys: { keys?: unknown[] };
  policy?: string;
  peac_txt?: string;
  bundle_sig?: string;
}
