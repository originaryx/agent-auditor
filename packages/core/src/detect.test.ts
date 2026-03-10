import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectArtifactKind } from './detect.js';

const fixturesDir = join(import.meta.dirname, '../../..', 'fixtures');

describe('detectArtifactKind', () => {
  it('detects JWS compact receipt', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    expect(detectArtifactKind(fixture.jws)).toBe('receipt-jws');
  });

  it('detects JWS from bytes', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const bytes = new TextEncoder().encode(fixture.jws);
    expect(detectArtifactKind(bytes)).toBe('receipt-jws');
  });

  it('detects JSON receipt', () => {
    const json = JSON.stringify({ iss: 'https://example.com', kind: 'evidence' });
    expect(detectArtifactKind(json)).toBe('receipt-json');
  });

  it('detects bundle ZIP from bytes', () => {
    const zipBytes = readFileSync(join(fixturesDir, 'valid_minimal.zip'));
    expect(detectArtifactKind(new Uint8Array(zipBytes))).toBe('bundle-zip');
  });

  it('detects JSONL spool', () => {
    const jsonl = '{"type":"tool.call","timestamp":"2026-01-01T00:00:00Z"}\n{"type":"tool.result","timestamp":"2026-01-01T00:00:01Z"}\n';
    expect(detectArtifactKind(jsonl)).toBe('spool-jsonl');
  });

  it('returns unknown for random text', () => {
    expect(detectArtifactKind('hello world')).toBe('unknown');
  });

  it('returns unknown for empty input', () => {
    expect(detectArtifactKind('')).toBe('unknown');
  });

  it('returns unknown for random bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
    expect(detectArtifactKind(bytes)).toBe('unknown');
  });
});
