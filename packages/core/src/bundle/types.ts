/**
 * Shared bundle adapter interface.
 *
 * Both bundle.node.ts and bundle.web.ts implement this interface.
 * The shared core imports only this file; platform-specific
 * adapters are injected at the application level.
 */

export type { BundleReadOutcome, BundleReader } from '../types.js';

/** Bundle size limits (matches @peac/audit DoS hardening) */
export const BUNDLE_LIMITS = {
  maxEntries: 10_000,
  maxEntrySize: 64 * 1024 * 1024, // 64 MB
  maxTotalSize: 512 * 1024 * 1024, // 512 MB
  maxReceipts: 10_000,
} as const;

/** Paths allowed in a PEAC dispute bundle */
export const ALLOWED_PATHS = new Set([
  'manifest.json',
  'receipts.ndjson',
  'keys/keys.json',
  'bundle.sig',
  'policy/policy.yaml',
  'policy/peac.txt',
]);

/**
 * Check for path traversal attacks in ZIP entries.
 */
export function isPathSafe(path: string): boolean {
  if (path.includes('\\')) return false;
  if (path.includes('\0')) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('..')) return false;
  return true;
}
