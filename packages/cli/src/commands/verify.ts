/**
 * verify command: verify receipt with key, or bundle with included keys.
 *
 * Exit codes: 0 = valid, 1 = invalid, 2 = error.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  detectArtifactKind,
  parseReceipt,
  verifyReceipt,
  verifyBundleReceipts,
  normalizeBundle,
} from '@originaryx/agent-auditor-core';
import type { VerifyOutput } from '@originaryx/agent-auditor-core';
import { readBundle } from '../read-bundle.js';
import {
  formatReceiptSummary,
  formatVerifyResult,
  formatBundleSummary,
  formatBundleVerifyResults,
} from '../format.js';

interface VerifyOptions {
  key?: string;
  jwks?: string;
  kid?: string;
  json?: boolean;
}

export async function verify(
  data: Buffer,
  filePath: string,
  opts: VerifyOptions,
): Promise<void> {
  const kind = detectArtifactKind(new Uint8Array(data));

  if (kind === 'receipt-jws') {
    await verifyReceiptFile(data, opts);
    return;
  }

  if (kind === 'bundle-zip') {
    await verifyBundleFile(data, opts);
    return;
  }

  console.error(`Error: could not detect artifact type for "${filePath}"`);
  console.error('verify supports .jws (receipt) and .zip (bundle) files');
  process.exit(2);
}

async function verifyReceiptFile(data: Buffer, opts: VerifyOptions): Promise<void> {
  const jws = data.toString('utf-8').trim();

  // Resolve public key
  const publicKey = resolvePublicKey(opts);
  if (!publicKey) {
    console.error('Error: receipt verification requires a public key');
    console.error('  --key <path>   Raw Ed25519 public key file (32 bytes)');
    console.error('  --jwks <path>  JWKS file (use --kid to select key)');
    process.exit(2);
  }

  const receipt = parseReceipt(jws);
  const result = await verifyReceipt(jws, publicKey);

  if (opts.json) {
    const output: VerifyOutput = {
      ok: result.ok,
      artifact_kind: 'receipt-jws',
      status: result.status,
      checks: result.checks,
      claims_summary: result.claimsSummary,
      policy_binding: result.policyBinding,
      warnings: result.warnings,
      errors: result.errors,
      timeline: result.timeline,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  console.log(formatReceiptSummary(receipt));
  console.log('');
  console.log(formatVerifyResult(result));

  process.exit(result.ok ? 0 : 1);
}

async function verifyBundleFile(data: Buffer, opts: VerifyOptions): Promise<void> {
  const readResult = await readBundle(data);

  if (!readResult.ok) {
    if (opts.json) {
      const output: VerifyOutput = {
        ok: false,
        artifact_kind: 'bundle-zip',
        status: 'error',
        warnings: [],
        errors: [{ code: readResult.code, message: readResult.message }],
        timeline: [],
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.error(`Error reading bundle: ${readResult.code}: ${readResult.message}`);
    }
    process.exit(2);
  }

  const bundle = normalizeBundle(readResult);
  const results = await verifyBundleReceipts(readResult.receipts, readResult.keys);

  const validCount = results.filter((r) => r.result.ok).length;
  const invalidCount = results.filter((r) => !r.result.ok).length;

  if (opts.json) {
    const output: VerifyOutput = {
      ok: invalidCount === 0,
      artifact_kind: 'bundle-zip',
      status: invalidCount === 0 ? 'valid' : 'invalid',
      bundle_summary: {
        bundle_id: bundle.bundleSummary.bundle_id,
        kind: bundle.bundleSummary.kind,
        content_hash_valid: true,
        total_receipts: results.length,
        valid_receipts: validCount,
        invalid_receipts: invalidCount,
      },
      receipts: results.map((r) => ({
        receipt_id: r.receiptId,
        status: r.result.ok ? 'valid' as const : 'invalid' as const,
        claims_summary: r.result.claimsSummary
          ? {
              iss: r.result.claimsSummary.iss,
              kind: r.result.claimsSummary.kind,
              type: r.result.claimsSummary.type,
              jti: r.result.claimsSummary.jti,
              wire_version: r.result.claimsSummary.wire_version,
            }
          : undefined,
        error: !r.result.ok && r.result.errors.length > 0
          ? { code: r.result.errors[0].code, message: r.result.errors[0].message }
          : undefined,
      })),
      warnings: results.flatMap((r) => r.result.warnings),
      errors: results.flatMap((r) => r.result.errors),
      timeline: bundle.timeline,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(invalidCount === 0 ? 0 : 1);
  }

  console.log(formatBundleSummary(bundle));
  console.log('');
  console.log(formatBundleVerifyResults(results));

  process.exit(invalidCount === 0 ? 0 : 1);
}

function resolvePublicKey(opts: VerifyOptions): Uint8Array | string | null {
  if (opts.key) {
    const keyPath = resolve(opts.key);
    const keyData = readFileSync(keyPath);

    // If 32 bytes, raw Ed25519
    if (keyData.length === 32) {
      return new Uint8Array(keyData);
    }

    // Try as base64url string
    const keyStr = keyData.toString('utf-8').trim();
    if (keyStr.length > 0) {
      return keyStr;
    }

    console.error(`Error: key file must be 32-byte raw Ed25519 or base64url-encoded`);
    process.exit(2);
  }

  if (opts.jwks) {
    const jwksPath = resolve(opts.jwks);
    const jwksData = JSON.parse(readFileSync(jwksPath, 'utf-8'));
    const keys = jwksData.keys as Array<{ kid?: string; x?: string; kty?: string }>;

    if (!keys || keys.length === 0) {
      console.error('Error: JWKS file contains no keys');
      process.exit(2);
    }

    // Select by kid if specified, otherwise use first Ed25519 key
    let key;
    if (opts.kid) {
      key = keys.find((k) => k.kid === opts.kid);
      if (!key) {
        console.error(`Error: no key found with kid "${opts.kid}" in JWKS`);
        console.error(`Available kids: ${keys.map((k) => k.kid).join(', ')}`);
        process.exit(2);
      }
    } else {
      key = keys.find((k) => k.kty === 'OKP') ?? keys[0];
    }

    if (!key?.x) {
      console.error('Error: selected key has no "x" (public key) field');
      process.exit(2);
    }

    return key.x;
  }

  return null;
}
