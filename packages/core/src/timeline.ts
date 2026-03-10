/**
 * Timeline derivation from receipt claims and bundle manifests.
 *
 * Extracts timestamped events from receipt claims, extensions,
 * and bundle-level metadata to build a chronological event list.
 */

import type { ClaimsSummary, TimelineEvent, BundleSummary } from './types.js';

/**
 * Build timeline events from receipt claims.
 */
export function buildReceiptTimeline(
  claims: Record<string, unknown>,
  summary: ClaimsSummary,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Issued at
  if (summary.issued_at) {
    events.push({
      timestamp: summary.issued_at,
      label: 'Receipt issued',
      detail: `by ${summary.iss}`,
      source: 'claims.iat',
    });
  }

  // Occurred at (evidence kind)
  if (summary.occurred_at) {
    events.push({
      timestamp: summary.occurred_at,
      label: 'Interaction occurred',
      detail: summary.type ? `type: ${summary.type}` : undefined,
      source: 'claims.occurred_at',
    });
  }

  // Expiration
  if (claims.exp != null) {
    events.push({
      timestamp: formatEpoch(claims.exp as number),
      label: 'Receipt expires',
      source: 'claims.exp',
    });
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return events;
}

/**
 * Build timeline events from a bundle manifest.
 */
export function buildBundleTimeline(
  manifest: Record<string, unknown>,
  summary: BundleSummary,
  receipts: Array<{ claimsSummary: ClaimsSummary; jti: string }>,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Bundle creation
  if (summary.created_at) {
    events.push({
      timestamp: summary.created_at,
      label: 'Bundle created',
      detail: `by ${summary.created_by}`,
      source: 'manifest.created_at',
    });
  }

  // Time range from manifest
  const timeRange = manifest.time_range as { start?: string; end?: string } | undefined;
  if (timeRange?.start) {
    events.push({
      timestamp: timeRange.start,
      label: 'Time range start',
      source: 'manifest.time_range.start',
    });
  }
  if (timeRange?.end) {
    events.push({
      timestamp: timeRange.end,
      label: 'Time range end',
      source: 'manifest.time_range.end',
    });
  }

  // Per-receipt events
  for (const receipt of receipts) {
    if (receipt.claimsSummary.issued_at) {
      events.push({
        timestamp: receipt.claimsSummary.issued_at,
        label: `Receipt issued`,
        detail: `${receipt.claimsSummary.type} by ${receipt.claimsSummary.iss}`,
        source: 'receipt.iat',
        receipt_id: receipt.jti,
      });
    }
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return events;
}

function formatEpoch(epochSeconds: number): string {
  try {
    return new Date(epochSeconds * 1000).toISOString();
  } catch {
    return String(epochSeconds);
  }
}
