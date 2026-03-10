/**
 * JSON output contract snapshot tests.
 *
 * These tests freeze the --json output shape so accidental schema drift
 * breaks loudly. The GitHub Action (Phase 3) will consume this contract.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '../dist/index.js');
const FIXTURES = join(import.meta.dirname, '../../../fixtures');

function runJson(args: string[]): { output: Record<string, unknown>; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf-8', timeout: 10000 });
    return { output: JSON.parse(stdout), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    try {
      return { output: JSON.parse(e.stdout ?? '{}'), exitCode: e.status ?? 1 };
    } catch {
      return { output: {}, exitCode: e.status ?? 2 };
    }
  }
}

function writeJws(jws: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'aa-contract-'));
  const p = join(dir, 'r.jws');
  writeFileSync(p, jws);
  return p;
}

function fixtureJws(): { jws: string; publicKey: string } {
  const raw = execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' });
  return JSON.parse(raw);
}

describe('JSON output contract (frozen from v0.1)', () => {
  describe('inspect --json on valid receipt', () => {
    it('has required top-level fields', () => {
      const fixture = fixtureJws();
      const jwsPath = writeJws(fixture.jws);
      const { output, exitCode } = runJson(['inspect', jwsPath, '--json']);

      expect(exitCode).toBe(0);
      expect(output).toHaveProperty('ok', true);
      expect(output).toHaveProperty('artifact_kind', 'receipt-jws');
      expect(output).toHaveProperty('verified', false);
      expect(output).toHaveProperty('header');
      expect(output).toHaveProperty('claims_summary');
      expect(output).toHaveProperty('full_claims');
      expect(output).toHaveProperty('timeline');
      expect(output).toHaveProperty('extensions');
      expect(output).toHaveProperty('unknown_fields');
    });

    it('claims_summary has required fields', () => {
      const fixture = fixtureJws();
      const jwsPath = writeJws(fixture.jws);
      const { output } = runJson(['inspect', jwsPath, '--json']);

      const cs = output.claims_summary as Record<string, unknown>;
      expect(cs).toHaveProperty('iss');
      expect(cs).toHaveProperty('kind');
      expect(cs).toHaveProperty('type');
      expect(cs).toHaveProperty('jti');
      expect(cs).toHaveProperty('wire_version');
      expect(typeof cs.iss).toBe('string');
      expect(typeof cs.kind).toBe('string');
      expect(typeof cs.wire_version).toBe('string');
    });

    it('timeline entries have required shape', () => {
      const fixture = fixtureJws();
      const jwsPath = writeJws(fixture.jws);
      const { output } = runJson(['inspect', jwsPath, '--json']);

      const timeline = output.timeline as Array<Record<string, unknown>>;
      expect(timeline.length).toBeGreaterThan(0);
      for (const event of timeline) {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('label');
        expect(event).toHaveProperty('source');
        expect(typeof event.timestamp).toBe('string');
        expect(typeof event.label).toBe('string');
      }
    });
  });

  describe('inspect --json on valid bundle', () => {
    it('has required top-level fields', () => {
      const { output, exitCode } = runJson(['inspect', join(FIXTURES, 'valid_minimal.zip'), '--json']);

      expect(exitCode).toBe(0);
      expect(output).toHaveProperty('ok', true);
      expect(output).toHaveProperty('artifact_kind', 'bundle-zip');
      expect(output).toHaveProperty('verified', false);
      expect(output).toHaveProperty('bundle_summary');
      expect(output).toHaveProperty('timeline');
    });

    it('bundle_summary has required fields', () => {
      const { output } = runJson(['inspect', join(FIXTURES, 'valid_minimal.zip'), '--json']);

      const bs = output.bundle_summary as Record<string, unknown>;
      expect(bs).toHaveProperty('bundle_id');
      expect(bs).toHaveProperty('kind');
      expect(bs).toHaveProperty('total_receipts');
      expect(bs).toHaveProperty('keys_included');
      expect(typeof bs.bundle_id).toBe('string');
      expect(typeof bs.total_receipts).toBe('number');
    });
  });

  describe('verify --json on valid receipt', () => {
    it('has required top-level fields', () => {
      const fixture = fixtureJws();
      const jwsPath = writeJws(fixture.jws);
      const dir = mkdtempSync(join(tmpdir(), 'aa-contract-'));
      const keyPath = join(dir, 'key.txt');
      writeFileSync(keyPath, fixture.publicKey);

      const { output, exitCode } = runJson(['verify', jwsPath, '--key', keyPath, '--json']);

      expect(exitCode).toBe(0);
      expect(output).toHaveProperty('ok', true);
      expect(output).toHaveProperty('artifact_kind', 'receipt-jws');
      expect(output).toHaveProperty('status', 'valid');
      expect(output).toHaveProperty('checks');
      expect(output).toHaveProperty('claims_summary');
      expect(output).toHaveProperty('warnings');
      expect(output).toHaveProperty('errors');
      expect(output).toHaveProperty('timeline');
    });

    it('checks array has required shape', () => {
      const fixture = fixtureJws();
      const jwsPath = writeJws(fixture.jws);
      const dir = mkdtempSync(join(tmpdir(), 'aa-contract-'));
      const keyPath = join(dir, 'key.txt');
      writeFileSync(keyPath, fixture.publicKey);

      const { output } = runJson(['verify', jwsPath, '--key', keyPath, '--json']);

      const checks = output.checks as Array<Record<string, unknown>>;
      expect(checks.length).toBeGreaterThan(0);
      for (const check of checks) {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('passed');
        expect(typeof check.name).toBe('string');
        expect(typeof check.passed).toBe('boolean');
      }
    });
  });

  describe('verify --json on invalid receipt', () => {
    it('returns ok:false with error details', () => {
      const fixture = fixtureJws();
      const jwsPath = writeJws(fixture.jws);
      const dir = mkdtempSync(join(tmpdir(), 'aa-contract-'));
      const keyPath = join(dir, 'key.txt');
      writeFileSync(keyPath, 'gaZ_TriTufIrs8OBGQBy3jMBV-rOZvNF3eXZBV-ZJKk');

      const { output, exitCode } = runJson(['verify', jwsPath, '--key', keyPath, '--json']);

      expect(exitCode).toBe(1);
      expect(output).toHaveProperty('ok', false);
      expect(output).toHaveProperty('status', 'invalid');
      expect(output).toHaveProperty('errors');
      const errors = output.errors as Array<Record<string, unknown>>;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty('code');
      expect(errors[0]).toHaveProperty('message');
    });
  });

  describe('verify --json on bundle', () => {
    it('has required bundle verify fields', () => {
      const { output } = runJson(['verify', join(FIXTURES, 'valid_minimal.zip'), '--json']);

      expect(output).toHaveProperty('ok');
      expect(output).toHaveProperty('artifact_kind', 'bundle-zip');
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('bundle_summary');
      expect(output).toHaveProperty('receipts');
      expect(output).toHaveProperty('warnings');
      expect(output).toHaveProperty('errors');

      const bs = output.bundle_summary as Record<string, unknown>;
      expect(bs).toHaveProperty('bundle_id');
      expect(bs).toHaveProperty('total_receipts');
      expect(bs).toHaveProperty('valid_receipts');
      expect(bs).toHaveProperty('invalid_receipts');

      const receipts = output.receipts as Array<Record<string, unknown>>;
      expect(receipts.length).toBeGreaterThan(0);
      for (const r of receipts) {
        expect(r).toHaveProperty('receipt_id');
        expect(r).toHaveProperty('status');
      }
    });
  });
});
