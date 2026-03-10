/**
 * @originaryx/agent-auditor-core
 *
 * Core detection, parsing, normalization, verification, and timeline
 * derivation for Agent Auditor. Browser-safe: no Node.js imports.
 *
 * Bundle adapters are in separate entry points:
 *   @originaryx/agent-auditor-core/bundle/node  (Node.js, uses @peac/audit)
 *   @originaryx/agent-auditor-core/bundle/web   (browser, uses jszip)
 */

// Detection
export { detectArtifactKind } from './detect.js';

// Parsing
export { parseReceipt, parseReceiptJson } from './parse.js';

// Normalization
export { normalizeBundle } from './normalize.js';

// Timeline
export { buildReceiptTimeline, buildBundleTimeline } from './timeline.js';

// Verification
export { verifyReceipt, verifyBundleReceipts } from './verify.js';
export type { VerificationCheck, ReceiptVerifyResult } from './verify.js';

// Output schema (frozen contract)
export {
  buildInspectReceiptOutput,
  buildInspectBundleOutput,
} from './output-schema.js';
export type { InspectOutput, VerifyOutput } from './output-schema.js';

// Types
export type {
  ArtifactKind,
  TimelineEvent,
  NormalizedReceipt,
  NormalizedBundle,
  ClaimsSummary,
  BundleSummary,
  BundleReadResult,
  BundleReadError,
  BundleReadOutcome,
  BundleReader,
} from './types.js';

export { EXTENSION_DISPLAY_NAMES } from './types.js';

// Bundle adapter types (shared interface)
export { BUNDLE_LIMITS, ALLOWED_PATHS, isPathSafe } from './bundle/types.js';
