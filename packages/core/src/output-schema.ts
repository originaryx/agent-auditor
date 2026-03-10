/**
 * Frozen JSON output contract for Agent Auditor.
 *
 * These types define the stable --json output format.
 * Breaking changes require a major version bump.
 * The GitHub Action (Phase 3) will consume this contract directly.
 */

import type { TimelineEvent, ClaimsSummary, BundleSummary, ArtifactKind } from './types.js';

/** Inspect output (decode without verification) */
export interface InspectOutput {
  ok: true;
  artifact_kind: ArtifactKind;
  header?: Record<string, unknown>;
  claims_summary?: ClaimsSummary;
  full_claims?: Record<string, unknown>;
  bundle_summary?: BundleSummary;
  timeline: TimelineEvent[];
  extensions: Record<string, unknown>;
  unknown_fields: string[];
  verified: false;
}

/** Verify output (with cryptographic verification) */
export interface VerifyOutput {
  ok: boolean;
  artifact_kind: 'receipt-jws' | 'bundle-zip';
  status: 'valid' | 'invalid' | 'error';
  checks?: Array<{ name: string; passed: boolean; message?: string }>;
  claims_summary?: ClaimsSummary;
  policy_binding?: 'verified' | 'unavailable' | 'failed';
  bundle_summary?: {
    bundle_id: string;
    kind: string;
    content_hash_valid: boolean;
    bundle_signature_valid?: boolean;
    total_receipts: number;
    valid_receipts: number;
    invalid_receipts: number;
  };
  receipts?: Array<{
    receipt_id: string;
    status: 'valid' | 'invalid';
    claims_summary?: Pick<ClaimsSummary, 'iss' | 'kind' | 'type' | 'jti' | 'wire_version'>;
    error?: { code: string; message: string };
  }>;
  warnings: Array<{ code: string; message: string; pointer?: string }>;
  errors: Array<{ code: string; message: string }>;
  timeline: TimelineEvent[];
}

/** Build an InspectOutput from a decoded receipt */
export function buildInspectReceiptOutput(
  receipt: {
    header: Record<string, unknown>;
    claims: Record<string, unknown>;
    claimsSummary: ClaimsSummary;
    extensions: Record<string, unknown>;
    unknownFields: string[];
    timeline: TimelineEvent[];
  },
): InspectOutput {
  return {
    ok: true,
    artifact_kind: 'receipt-jws',
    header: receipt.header,
    claims_summary: receipt.claimsSummary,
    full_claims: receipt.claims,
    timeline: receipt.timeline,
    extensions: receipt.extensions,
    unknown_fields: receipt.unknownFields,
    verified: false,
  };
}

/** Build an InspectOutput from a decoded bundle */
export function buildInspectBundleOutput(
  bundle: {
    manifest: Record<string, unknown>;
    bundleSummary: BundleSummary;
    timeline: TimelineEvent[];
  },
): InspectOutput {
  return {
    ok: true,
    artifact_kind: 'bundle-zip',
    bundle_summary: bundle.bundleSummary,
    timeline: bundle.timeline,
    extensions: {},
    unknown_fields: [],
    verified: false,
  };
}
