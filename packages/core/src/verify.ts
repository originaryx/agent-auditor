/**
 * Receipt verification wrapper.
 *
 * Wraps @peac/protocol verifyLocal() and maps the result to
 * Agent Auditor's output format with checks array.
 *
 * Browser-safe: imports from @peac/protocol/verify-local subpath.
 */

import { verifyLocal } from '@peac/protocol/verify-local';
import { base64urlDecode } from '@peac/crypto';
import type { ClaimsSummary, TimelineEvent } from './types.js';
import { parseReceipt } from './parse.js';

/** Single verification check result */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  message?: string;
}

/** Receipt verification result */
export interface ReceiptVerifyResult {
  ok: boolean;
  status: 'valid' | 'invalid' | 'error';
  checks: VerificationCheck[];
  claimsSummary?: ClaimsSummary;
  policyBinding?: 'verified' | 'unavailable' | 'failed';
  warnings: Array<{ code: string; message: string; pointer?: string }>;
  errors: Array<{ code: string; message: string }>;
  timeline: TimelineEvent[];
}

/**
 * Verify a receipt JWS against a public key.
 *
 * @param jws - JWS compact serialization
 * @param publicKey - Ed25519 public key as Uint8Array or base64url string
 * @returns Verification result with checks, claims summary, warnings
 */
export async function verifyReceipt(
  jws: string,
  publicKey: Uint8Array | string,
): Promise<ReceiptVerifyResult> {
  const keyBytes = typeof publicKey === 'string' ? base64urlDecode(publicKey) : publicKey;

  // Parse first (for display even if verification fails)
  let parsed;
  try {
    parsed = parseReceipt(jws);
  } catch (err: unknown) {
    return {
      ok: false,
      status: 'error',
      checks: [{ name: 'JWS decode', passed: false, message: err instanceof Error ? err.message : 'Invalid JWS format' }],
      warnings: [],
      errors: [{ code: 'E_INVALID_FORMAT', message: err instanceof Error ? err.message : 'Invalid JWS format' }],
      timeline: [],
    };
  }

  // Verify
  try {
    const result = await verifyLocal(jws, keyBytes);

    if (result.valid) {
      const checks: VerificationCheck[] = [
        { name: 'JWS decode', passed: true },
        { name: 'Ed25519 signature', passed: true },
        { name: 'Schema validation', passed: true },
        { name: 'Wire format', passed: true, message: `Wire ${result.wireVersion}` },
      ];

      const warnings = result.warnings.map((w) => ({
        code: w.code,
        message: w.message,
        pointer: w.pointer,
      }));

      return {
        ok: true,
        status: 'valid',
        checks,
        claimsSummary: parsed.claimsSummary,
        policyBinding: result.policy_binding,
        warnings,
        errors: [],
        timeline: parsed.timeline,
      };
    }

    // Verification failed
    const checks: VerificationCheck[] = [
      { name: 'JWS decode', passed: true },
      { name: 'Ed25519 signature', passed: result.code !== 'E_INVALID_SIGNATURE', message: result.code === 'E_INVALID_SIGNATURE' ? result.message : undefined },
      { name: 'Schema validation', passed: !result.code?.startsWith('E_INVALID_FORMAT'), message: result.code?.startsWith('E_INVALID_FORMAT') ? result.message : undefined },
    ];

    return {
      ok: false,
      status: 'invalid',
      checks,
      claimsSummary: parsed.claimsSummary,
      warnings: [],
      errors: [{ code: result.code, message: result.message }],
      timeline: parsed.timeline,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 'error',
      checks: [{ name: 'Verification', passed: false, message: err instanceof Error ? err.message : 'Verification failed' }],
      claimsSummary: parsed.claimsSummary,
      warnings: [],
      errors: [{ code: 'E_INTERNAL', message: err instanceof Error ? err.message : 'Unexpected verification error' }],
      timeline: parsed.timeline,
    };
  }
}

/**
 * Verify all receipts in a bundle against included keys.
 *
 * @param receipts - Array of JWS strings
 * @param keys - JWKS object with keys array
 * @returns Per-receipt verification results
 */
export async function verifyBundleReceipts(
  receipts: string[],
  keys: Record<string, unknown>,
): Promise<Array<{ receiptId: string; result: ReceiptVerifyResult }>> {
  const jwks = (keys as { keys?: Array<{ kid?: string; x?: string }> }).keys ?? [];
  const results: Array<{ receiptId: string; result: ReceiptVerifyResult }> = [];

  for (const jws of receipts) {
    let parsed;
    try {
      parsed = parseReceipt(jws);
    } catch {
      results.push({
        receiptId: 'unknown',
        result: {
          ok: false,
          status: 'error',
          checks: [{ name: 'JWS decode', passed: false }],
          warnings: [],
          errors: [{ code: 'E_INVALID_FORMAT', message: 'Failed to decode receipt JWS' }],
          timeline: [],
        },
      });
      continue;
    }

    const kid = parsed.header.kid as string | undefined;
    const matchingKey = jwks.find((k) => k.kid === kid);

    if (!matchingKey?.x) {
      results.push({
        receiptId: parsed.claimsSummary.jti,
        result: {
          ok: false,
          status: 'invalid',
          checks: [
            { name: 'JWS decode', passed: true },
            { name: 'Key lookup', passed: false, message: `No key found for kid "${kid}"` },
          ],
          claimsSummary: parsed.claimsSummary,
          warnings: [],
          errors: [{ code: 'E_BUNDLE_KEY_MISSING', message: `No matching key for kid "${kid}"` }],
          timeline: parsed.timeline,
        },
      });
      continue;
    }

    const verifyResult = await verifyReceipt(jws, matchingKey.x);
    results.push({
      receiptId: parsed.claimsSummary.jti,
      result: verifyResult,
    });
  }

  return results;
}
