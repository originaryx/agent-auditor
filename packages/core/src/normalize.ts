/**
 * Bundle normalization: extract and normalize bundle contents
 * into the platform-agnostic NormalizedBundle shape.
 *
 * This module does NOT import any platform-specific ZIP library.
 * It operates on the already-extracted BundleReadResult.
 */

import { parseReceipt } from './parse.js';
import { buildBundleTimeline } from './timeline.js';
import type {
  BundleReadResult,
  BundleSummary,
  NormalizedBundle,
  NormalizedReceipt,
} from './types.js';

/**
 * Normalize a bundle read result into the display-ready shape.
 *
 * @param readResult - Successful bundle read result (from either Node or browser adapter)
 * @returns NormalizedBundle with manifest, receipts, timeline
 */
export function normalizeBundle(readResult: BundleReadResult): NormalizedBundle {
  const manifest = readResult.manifest;

  // Parse each receipt JWS
  const receipts: NormalizedReceipt[] = [];
  for (const jws of readResult.receipts) {
    try {
      receipts.push(parseReceipt(jws));
    } catch {
      // Skip unparseable receipts; verification will catch them
      receipts.push({
        jws,
        header: {},
        claims: {},
        wireVersion: null,
        claimsSummary: {
          iss: 'unknown',
          kind: 'unknown',
          type: 'unknown',
          jti: 'unknown',
          wire_version: 'unknown',
        },
        extensions: {},
        unknownFields: [],
        timeline: [],
      });
    }
  }

  const bundleSummary = extractBundleSummary(manifest, readResult);

  const timeline = buildBundleTimeline(
    manifest,
    bundleSummary,
    receipts.map((r) => ({
      claimsSummary: r.claimsSummary,
      jti: r.claimsSummary.jti,
    })),
  );

  return {
    manifest,
    bundleSummary,
    receipts,
    timeline,
  };
}

function extractBundleSummary(
  manifest: Record<string, unknown>,
  readResult: BundleReadResult,
): BundleSummary {
  const keys = readResult.keys as { keys?: unknown[] } | undefined;
  return {
    bundle_id: String(manifest.bundle_id ?? ''),
    kind: String(manifest.kind ?? ''),
    created_by: String(manifest.created_by ?? ''),
    created_at: String(manifest.created_at ?? ''),
    total_receipts: readResult.receipts.length,
    keys_included: keys?.keys?.length ?? 0,
    policy_included: readResult.policy != null,
  };
}
