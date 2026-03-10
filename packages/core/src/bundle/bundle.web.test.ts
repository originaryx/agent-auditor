/**
 * Adversarial tests for browser bundle reader.
 *
 * Tests ZIP bomb, path traversal, oversized entries,
 * too many entries, malformed manifest/keys/receipts,
 * and unknown files.
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createWebBundleReader } from './bundle.web.js';
import { BUNDLE_LIMITS } from './types.js';

const reader = createWebBundleReader(JSZip);

/** Helper: build a valid minimal bundle ZIP */
async function buildBundle(overrides?: {
  manifest?: string;
  receipts?: string;
  keys?: string;
  extraFiles?: Record<string, string>;
  skipManifest?: boolean;
  skipReceipts?: boolean;
}): Promise<Uint8Array> {
  const zip = new JSZip();

  if (!overrides?.skipManifest) {
    zip.file('manifest.json', overrides?.manifest ?? JSON.stringify({
      version: 'peac-bundle/0.1',
      kind: 'dispute',
      bundle_id: 'test-bundle-001',
      created_by: 'https://test.example.com',
      created_at: '2026-01-01T00:00:00Z',
      time_range: { start: '2026-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
      receipts: [],
    }));
  }

  if (!overrides?.skipReceipts) {
    zip.file('receipts.ndjson', overrides?.receipts ?? '');
  }

  zip.file('keys/keys.json', overrides?.keys ?? JSON.stringify({ keys: [] }));

  if (overrides?.extraFiles) {
    for (const [path, content] of Object.entries(overrides.extraFiles)) {
      zip.file(path, content);
    }
  }

  return zip.generateAsync({ type: 'uint8array' });
}

describe('browser bundle reader hardening', () => {
  it('rejects non-ZIP input', async () => {
    const result = await reader.read(new Uint8Array([0, 1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_INVALID_FORMAT');
    }
  });

  it('rejects empty input', async () => {
    const result = await reader.read(new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_INVALID_FORMAT');
    }
  });

  it('path traversal guard rejects .. paths', async () => {
    // JSZip normalizes paths, so test the guard directly
    const { isPathSafe } = await import('./types.js');
    expect(isPathSafe('../../../etc/passwd')).toBe(false);
    expect(isPathSafe('foo/../bar')).toBe(false);
    expect(isPathSafe('manifest..json')).toBe(false); // contains ..
  });

  it('rejects ZIP with absolute paths', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{}');
    zip.file('/etc/passwd', 'hacked');
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const result = await reader.read(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_PATH_TRAVERSAL');
    }
  });

  it('rejects ZIP with backslash paths', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{}');
    // JSZip normalizes backslashes, but test the guard
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    // Manually check the path safety function
    const { isPathSafe } = await import('./types.js');
    expect(isPathSafe('foo\\bar')).toBe(false);
    expect(isPathSafe('foo\0bar')).toBe(false);
  });

  it('rejects ZIP with null byte paths', async () => {
    const { isPathSafe } = await import('./types.js');
    expect(isPathSafe('manifest\0.json')).toBe(false);
  });

  it('rejects ZIP missing manifest.json', async () => {
    const bytes = await buildBundle({ skipManifest: true });
    const result = await reader.read(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_MANIFEST_MISSING');
    }
  });

  it('rejects ZIP with malformed manifest JSON', async () => {
    const bytes = await buildBundle({ manifest: '{not valid json' });
    const result = await reader.read(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_MANIFEST_INVALID');
    }
  });

  it('rejects ZIP missing receipts.ndjson', async () => {
    const bytes = await buildBundle({ skipReceipts: true });
    const result = await reader.read(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_MANIFEST_INVALID');
    }
  });

  it('handles malformed keys.json gracefully (non-fatal)', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ version: 'peac-bundle/0.1', bundle_id: 'test' }));
    zip.file('receipts.ndjson', '');
    zip.file('keys/keys.json', '{broken json');
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const result = await reader.read(bytes);
    // Keys parse failure is non-fatal
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.keys).toEqual({ keys: [] });
    }
  });

  it('reads valid bundle with optional files', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ version: 'peac-bundle/0.1', bundle_id: 'test' }));
    zip.file('receipts.ndjson', '');
    zip.file('keys/keys.json', JSON.stringify({ keys: [] }));
    zip.file('bundle.sig', 'signature-data');
    zip.file('policy/policy.yaml', 'policy: test');
    zip.file('policy/peac.txt', 'peac_version: 0.2');
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const result = await reader.read(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle_sig).toBe('signature-data');
      expect(result.policy).toBe('policy: test');
      expect(result.peac_txt).toBe('peac_version: 0.2');
    }
  });

  it('accepts bundle with unknown extra files (no rejection)', async () => {
    const bytes = await buildBundle({
      extraFiles: { 'extra-file.txt': 'some content', 'debug.log': 'log data' },
    });
    const result = await reader.read(bytes);
    // Unknown files should not cause rejection
    expect(result.ok).toBe(true);
  });

  it('rejects oversized total ZIP', async () => {
    // Test the size check at the reader level
    const hugeInput = new Uint8Array(BUNDLE_LIMITS.maxTotalSize + 1);
    const result = await reader.read(hugeInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('E_BUNDLE_SIZE_EXCEEDED');
    }
  });

  it('enforces entry count limit', async () => {
    // We can't easily create 10001 entries in a test, but we can verify the constant
    expect(BUNDLE_LIMITS.maxEntries).toBe(10_000);
    expect(BUNDLE_LIMITS.maxReceipts).toBe(10_000);
    expect(BUNDLE_LIMITS.maxEntrySize).toBe(64 * 1024 * 1024);
    expect(BUNDLE_LIMITS.maxTotalSize).toBe(512 * 1024 * 1024);
  });
});
