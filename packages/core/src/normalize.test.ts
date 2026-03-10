import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { normalizeBundle } from './normalize.js';
import type { BundleReadResult } from './types.js';

const fixturesDir = join(import.meta.dirname, '../../..', 'fixtures');

describe('normalizeBundle', () => {
  it('normalizes a valid bundle read result', async () => {
    const zipBytes = readFileSync(join(fixturesDir, 'valid_minimal.zip'));
    const zip = await new JSZip().loadAsync(zipBytes);

    const manifestText = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestText);

    const receiptsText = await zip.file('receipts.ndjson')!.async('string');
    const receipts = receiptsText.trim().split('\n').filter(Boolean);

    const keysText = await zip.file('keys/keys.json')!.async('string');
    const keys = JSON.parse(keysText);

    const readResult: BundleReadResult = {
      ok: true,
      manifest,
      receipts,
      keys,
      files: ['manifest.json', 'receipts.ndjson', 'keys/keys.json'],
    };

    const normalized = normalizeBundle(readResult);

    expect(normalized.bundleSummary.bundle_id).toBe('01HQXG0000TESTBUNDLE001');
    expect(normalized.bundleSummary.kind).toBe('dispute');
    expect(normalized.bundleSummary.total_receipts).toBe(1);
    expect(normalized.bundleSummary.keys_included).toBe(1);
    expect(normalized.receipts).toHaveLength(1);
    expect(normalized.timeline.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts per-receipt claims summaries', async () => {
    const zipBytes = readFileSync(join(fixturesDir, 'valid_minimal.zip'));
    const zip = await new JSZip().loadAsync(zipBytes);

    const manifestText = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestText);

    const receiptsText = await zip.file('receipts.ndjson')!.async('string');
    const receipts = receiptsText.trim().split('\n').filter(Boolean);

    const keysText = await zip.file('keys/keys.json')!.async('string');
    const keys = JSON.parse(keysText);

    const readResult: BundleReadResult = {
      ok: true,
      manifest,
      receipts,
      keys,
      files: ['manifest.json', 'receipts.ndjson', 'keys/keys.json'],
    };

    const normalized = normalizeBundle(readResult);

    for (const receipt of normalized.receipts) {
      expect(receipt.claimsSummary.iss).toBeTruthy();
      expect(receipt.claimsSummary.jti).toBeTruthy();
    }
  });
});
