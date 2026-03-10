import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyReceipt, verifyBundleReceipts } from './verify.js';

const fixturesDir = join(import.meta.dirname, '../../..', 'fixtures');

describe('verifyReceipt', () => {
  it('verifies valid receipt', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = await verifyReceipt(fixture.jws, fixture.publicKey);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('valid');
    expect(result.checks.length).toBeGreaterThanOrEqual(3);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    expect(result.claimsSummary?.iss).toBe('https://demo.peacprotocol.org');
    expect(result.claimsSummary?.kind).toBe('evidence');
    expect(result.policyBinding).toBe('unavailable');
    expect(result.errors).toHaveLength(0);
  });

  it('rejects receipt with wrong key', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'invalid-sig.json'), 'utf-8'));
    const result = await verifyReceipt(fixture.jws, fixture.publicKey);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('invalid');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('E_INVALID_SIGNATURE');
  });

  it('returns error for malformed JWS', async () => {
    const result = await verifyReceipt('not-a-jws', 'aaaa');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('produces timeline on valid receipt', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = await verifyReceipt(fixture.jws, fixture.publicKey);

    expect(result.timeline.length).toBeGreaterThanOrEqual(1);
  });

  it('produces warnings array', async () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = await verifyReceipt(fixture.jws, fixture.publicKey);

    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

describe('verifyBundleReceipts', () => {
  it('verifies receipts from a bundle with included keys', async () => {
    // Read the valid bundle to get receipts and keys
    const JSZip = (await import('jszip')).default;
    const zipBytes = readFileSync(join(fixturesDir, 'valid_minimal.zip'));
    const zip = await new JSZip().loadAsync(zipBytes);

    const receiptsText = await zip.file('receipts.ndjson')!.async('string');
    const receipts = receiptsText.trim().split('\n').filter(Boolean);

    const keysText = await zip.file('keys/keys.json')!.async('string');
    const keys = JSON.parse(keysText);

    const results = await verifyBundleReceipts(receipts, keys);
    expect(results.length).toBe(receipts.length);
  });

  it('identifies invalid signatures in bundle', async () => {
    const JSZip = (await import('jszip')).default;
    const zipBytes = readFileSync(join(fixturesDir, 'invalid_signature.zip'));
    const zip = await new JSZip().loadAsync(zipBytes);

    const receiptsText = await zip.file('receipts.ndjson')!.async('string');
    const receipts = receiptsText.trim().split('\n').filter(Boolean);

    const keysText = await zip.file('keys/keys.json')!.async('string');
    const keys = JSON.parse(keysText);

    const results = await verifyBundleReceipts(receipts, keys);
    expect(results.length).toBe(receipts.length);

    // At least one should be invalid
    const invalidCount = results.filter((r) => !r.result.ok).length;
    expect(invalidCount).toBeGreaterThanOrEqual(1);
  });
});
