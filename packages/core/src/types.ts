/**
 * Core types for Agent Auditor.
 *
 * These types define the internal data model. The frozen JSON output
 * contract (InspectOutput, VerifyOutput) is in output-schema.ts.
 */

/** Detected artifact type */
export type ArtifactKind =
  | 'receipt-jws'
  | 'receipt-json'
  | 'bundle-zip'
  | 'spool-jsonl'
  | 'unknown';

/** Timeline event extracted from receipt claims, bundle manifest, or spool entries */
export interface TimelineEvent {
  timestamp: string;
  label: string;
  detail?: string;
  source: string;
  receipt_id?: string;
}

/** Normalized receipt record (decoded but not verified) */
export interface NormalizedReceipt {
  jws: string;
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  wireVersion: '0.1' | '0.2' | null;
  claimsSummary: ClaimsSummary;
  extensions: Record<string, unknown>;
  unknownFields: string[];
  timeline: TimelineEvent[];
}

/** Claims summary matching PEAC MCP handler conventions */
export interface ClaimsSummary {
  iss: string;
  kind: string;
  type: string;
  jti: string;
  sub?: string;
  wire_version: string;
  issued_at?: string;
  occurred_at?: string;
  pillars?: string[];
}

/** Normalized bundle record (read but not verified) */
export interface NormalizedBundle {
  manifest: Record<string, unknown>;
  bundleSummary: BundleSummary;
  receipts: NormalizedReceipt[];
  timeline: TimelineEvent[];
}

/** Bundle summary for display */
export interface BundleSummary {
  bundle_id: string;
  kind: string;
  created_by: string;
  created_at: string;
  total_receipts: number;
  keys_included: number;
  policy_included: boolean;
}

/** Result of reading a bundle (platform-agnostic) */
export interface BundleReadResult {
  ok: true;
  manifest: Record<string, unknown>;
  receipts: string[];
  keys: Record<string, unknown>;
  policy?: string;
  peac_txt?: string;
  bundle_sig?: string;
  files: string[];
}

export interface BundleReadError {
  ok: false;
  code: string;
  message: string;
}

export type BundleReadOutcome = BundleReadResult | BundleReadError;

/** Platform-specific bundle reader interface */
export interface BundleReader {
  read(input: Uint8Array | ArrayBuffer): Promise<BundleReadOutcome>;
}

/** Known extension display names */
export const EXTENSION_DISPLAY_NAMES: Record<string, string> = {
  'org.peacprotocol/commerce': 'Commerce',
  'org.peacprotocol/access': 'Access',
  'org.peacprotocol/challenge': 'Challenge',
  'org.peacprotocol/identity': 'Identity',
  'org.peacprotocol/correlation': 'Correlation',
};
