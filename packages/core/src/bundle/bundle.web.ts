/**
 * Browser bundle reader using jszip.
 *
 * Platform-specific adapter for reading PEAC dispute bundles in the browser.
 * Produces the same BundleReadOutcome as the Node.js adapter.
 */

import type JSZip from 'jszip';
import type { BundleReadOutcome, BundleReader } from './types.js';
import { BUNDLE_LIMITS, ALLOWED_PATHS, isPathSafe } from './types.js';

/**
 * Create a browser bundle reader.
 *
 * @param jszip - JSZip constructor (injected to avoid direct import)
 */
export function createWebBundleReader(jszip: typeof JSZip): BundleReader {
  return {
    async read(input: Uint8Array | ArrayBuffer): Promise<BundleReadOutcome> {
      const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

      // Size check
      if (bytes.length > BUNDLE_LIMITS.maxTotalSize) {
        return {
          ok: false,
          code: 'E_BUNDLE_SIZE_EXCEEDED',
          message: `Bundle exceeds maximum size of ${BUNDLE_LIMITS.maxTotalSize} bytes`,
        };
      }

      let zip: JSZip;
      try {
        zip = await new jszip().loadAsync(bytes);
      } catch (err: unknown) {
        return {
          ok: false,
          code: 'E_BUNDLE_INVALID_FORMAT',
          message: `Failed to parse ZIP: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // Entry count check
      const entries = Object.keys(zip.files).filter((f) => !zip.files[f].dir);
      if (entries.length > BUNDLE_LIMITS.maxEntries) {
        return {
          ok: false,
          code: 'E_BUNDLE_SIZE_EXCEEDED',
          message: `Bundle contains ${entries.length} entries (max ${BUNDLE_LIMITS.maxEntries})`,
        };
      }

      // Path safety and allowlist check
      for (const path of entries) {
        if (!isPathSafe(path)) {
          return {
            ok: false,
            code: 'E_BUNDLE_PATH_TRAVERSAL',
            message: `Unsafe path detected: ${path}`,
          };
        }
      }

      // Per-entry decompressed size check (via extraction)
      for (const path of entries) {
        const file = zip.files[path];
        if (file) {
          const content = await file.async('uint8array');
          if (content.length > BUNDLE_LIMITS.maxEntrySize) {
            return {
              ok: false,
              code: 'E_BUNDLE_SIZE_EXCEEDED',
              message: `Entry "${path}" exceeds maximum size of ${BUNDLE_LIMITS.maxEntrySize} bytes (${content.length} bytes)`,
            };
          }
        }
      }

      // Extract manifest
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        return {
          ok: false,
          code: 'E_BUNDLE_MANIFEST_MISSING',
          message: 'manifest.json not found in bundle',
        };
      }

      let manifest: Record<string, unknown>;
      try {
        const manifestText = await manifestFile.async('string');
        manifest = JSON.parse(manifestText);
      } catch (err: unknown) {
        return {
          ok: false,
          code: 'E_BUNDLE_MANIFEST_INVALID',
          message: `Failed to parse manifest.json: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // Extract receipts
      const receiptsFile = zip.file('receipts.ndjson');
      if (!receiptsFile) {
        return {
          ok: false,
          code: 'E_BUNDLE_MANIFEST_INVALID',
          message: 'receipts.ndjson not found in bundle',
        };
      }

      const receiptsText = await receiptsFile.async('string');
      const receipts = receiptsText.trim().split('\n').filter(Boolean);

      // Receipt count limit
      if (receipts.length > BUNDLE_LIMITS.maxReceipts) {
        return {
          ok: false,
          code: 'E_BUNDLE_SIZE_EXCEEDED',
          message: `Bundle contains ${receipts.length} receipts (max ${BUNDLE_LIMITS.maxReceipts})`,
        };
      }

      // Extract keys
      const keysFile = zip.file('keys/keys.json');
      let keys: Record<string, unknown> = { keys: [] };
      if (keysFile) {
        try {
          const keysText = await keysFile.async('string');
          keys = JSON.parse(keysText);
        } catch {
          // Keys parse failure is non-fatal for reading
        }
      }

      // Optional files
      const policyFile = zip.file('policy/policy.yaml');
      const policy = policyFile ? await policyFile.async('string') : undefined;

      const peacTxtFile = zip.file('policy/peac.txt');
      const peac_txt = peacTxtFile ? await peacTxtFile.async('string') : undefined;

      const bundleSigFile = zip.file('bundle.sig');
      const bundle_sig = bundleSigFile ? await bundleSigFile.async('string') : undefined;

      return {
        ok: true,
        manifest,
        receipts,
        keys,
        policy,
        peac_txt,
        bundle_sig,
        files: entries,
      };
    },
  };
}
