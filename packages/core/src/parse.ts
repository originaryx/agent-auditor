/**
 * Receipt parsing: decode JWS, extract claims, build summary.
 *
 * Uses @peac/crypto decode() and @peac/schema detectWireVersion()
 * for consistent parsing across browser and Node.js.
 */

import { decode } from '@peac/crypto';
import { detectWireVersion } from '@peac/schema';
import type { ClaimsSummary, NormalizedReceipt, TimelineEvent } from './types.js';
import { buildReceiptTimeline } from './timeline.js';

/** Known top-level Wire 0.2 claim fields */
const KNOWN_CLAIMS_FIELDS = new Set([
  'peac_version', 'kind', 'type', 'iss', 'iat', 'jti', 'sub',
  'pillars', 'occurred_at', 'purpose_declared', 'policy', 'extensions',
  // Wire 0.1 fields
  'aud', 'rid', 'amt', 'cur', 'exp', 'subject',
]);

/**
 * Parse a JWS compact receipt into a NormalizedReceipt.
 *
 * This decodes the JWS but does NOT verify the signature.
 * For verification, use the verify module.
 *
 * @param jws - JWS compact serialization string
 * @returns NormalizedReceipt with claims, summary, timeline
 * @throws Error if JWS format is invalid
 */
export function parseReceipt(jws: string): NormalizedReceipt {
  const decoded = decode(jws);
  const header: Record<string, unknown> = { ...decoded.header };
  const claims = decoded.payload as Record<string, unknown>;
  const wireVersion = detectWireVersion(claims);

  const claimsSummary = extractClaimsSummary(claims, wireVersion);
  const extensions = extractExtensions(claims);
  const unknownFields = findUnknownFields(claims);
  const timeline = buildReceiptTimeline(claims, claimsSummary);

  return {
    jws,
    header,
    claims,
    wireVersion,
    claimsSummary,
    extensions,
    unknownFields,
    timeline,
  };
}

/**
 * Parse a JSON receipt (not JWS-wrapped) into a NormalizedReceipt.
 *
 * @param json - Parsed JSON object representing receipt claims
 * @returns NormalizedReceipt (without JWS data)
 */
export function parseReceiptJson(json: Record<string, unknown>): NormalizedReceipt {
  const wireVersion = detectWireVersion(json);
  const claimsSummary = extractClaimsSummary(json, wireVersion);
  const extensions = extractExtensions(json);
  const unknownFields = findUnknownFields(json);
  const timeline = buildReceiptTimeline(json, claimsSummary);

  return {
    jws: '',
    header: {},
    claims: json,
    wireVersion,
    claimsSummary,
    extensions,
    unknownFields,
    timeline,
  };
}

function extractClaimsSummary(
  claims: Record<string, unknown>,
  wireVersion: '0.1' | '0.2' | null,
): ClaimsSummary {
  const wire = wireVersion ?? 'unknown';

  if (wireVersion === '0.2') {
    return {
      iss: String(claims.iss ?? ''),
      kind: String(claims.kind ?? ''),
      type: String(claims.type ?? ''),
      jti: String(claims.jti ?? ''),
      sub: claims.sub != null ? String(claims.sub) : undefined,
      wire_version: wire,
      issued_at: claims.iat != null ? formatTimestamp(claims.iat as number) : undefined,
      occurred_at: claims.occurred_at != null ? String(claims.occurred_at) : undefined,
      pillars: Array.isArray(claims.pillars) ? claims.pillars.map(String) : undefined,
    };
  }

  // Wire 0.1 fallback
  return {
    iss: String(claims.iss ?? ''),
    kind: 'evidence',
    type: claims.amt != null ? 'commerce' : 'unknown',
    jti: String(claims.rid ?? claims.jti ?? ''),
    sub: claims.subject != null ? String(claims.subject) : claims.sub != null ? String(claims.sub) : undefined,
    wire_version: wire,
    issued_at: claims.iat != null ? formatTimestamp(claims.iat as number) : undefined,
  };
}

function extractExtensions(claims: Record<string, unknown>): Record<string, unknown> {
  if (claims.extensions && typeof claims.extensions === 'object') {
    return claims.extensions as Record<string, unknown>;
  }
  return {};
}

function findUnknownFields(claims: Record<string, unknown>): string[] {
  return Object.keys(claims).filter((key) => !KNOWN_CLAIMS_FIELDS.has(key));
}

function formatTimestamp(epochSeconds: number): string {
  try {
    return new Date(epochSeconds * 1000).toISOString();
  } catch {
    return String(epochSeconds);
  }
}
