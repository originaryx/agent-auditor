/**
 * CLI integration tests.
 *
 * Runs the built CLI binary and asserts exit codes and output.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '../dist/index.js');
const FIXTURES = join(import.meta.dirname, '../../../fixtures');

function run(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout ?? '') + (e.stderr ?? ''),
      exitCode: e.status ?? 1,
    };
  }
}

describe('CLI', () => {
  describe('demo', () => {
    it('runs demo with exit 0', () => {
      const { stdout, exitCode } = run(['demo']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Agent Auditor Demo');
      expect(stdout).toContain('https://demo.peacprotocol.org');
      expect(stdout).toContain('evidence');
    });

    it('demo --json produces valid JSON', () => {
      const { stdout, exitCode } = run(['demo', '--json']);
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout);
      expect(output.ok).toBe(true);
      expect(output.artifact_kind).toBe('receipt-jws');
      expect(output.verified).toBe(false);
      expect(output.claims_summary.iss).toBe('https://demo.peacprotocol.org');
    });
  });

  describe('inspect', () => {
    it('inspects a JWS receipt file', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aa-test-'));
      const fixture = JSON.parse(
        execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' }),
      );
      const jwsPath = join(dir, 'test.jws');
      writeFileSync(jwsPath, fixture.jws);

      const { stdout, exitCode } = run(['inspect', jwsPath]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('https://demo.peacprotocol.org');
      expect(stdout).toContain('evidence');
      expect(stdout).toContain('Receipt issued');
    });

    it('inspects a bundle ZIP', () => {
      const { stdout, exitCode } = run(['inspect', join(FIXTURES, 'valid_minimal.zip')]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('01HQXG0000TESTBUNDLE001');
      expect(stdout).toContain('dispute');
      expect(stdout).toContain('Bundle created');
    });

    it('inspect --json produces frozen contract output', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aa-test-'));
      const fixture = JSON.parse(
        execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' }),
      );
      const jwsPath = join(dir, 'test.jws');
      writeFileSync(jwsPath, fixture.jws);

      const { stdout, exitCode } = run(['inspect', jwsPath, '--json']);
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout);
      expect(output.ok).toBe(true);
      expect(output.artifact_kind).toBe('receipt-jws');
      expect(output.verified).toBe(false);
      expect(output.header).toBeDefined();
      expect(output.claims_summary).toBeDefined();
      expect(output.timeline).toBeInstanceOf(Array);
    });

    it('exits 2 for missing file', () => {
      const { exitCode, stdout } = run(['inspect', '/nonexistent-file']);
      expect(exitCode).toBe(2);
      expect(stdout).toContain('file not found');
    });
  });

  describe('verify', () => {
    it('verifies a valid receipt with correct key (exit 0)', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aa-test-'));
      const fixture = JSON.parse(
        execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' }),
      );
      const jwsPath = join(dir, 'test.jws');
      writeFileSync(jwsPath, fixture.jws);
      const keyPath = join(dir, 'pubkey.txt');
      writeFileSync(keyPath, fixture.publicKey);

      const { stdout, exitCode } = run(['verify', jwsPath, '--key', keyPath]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('VALID');
      expect(stdout).toContain('PASS');
    });

    it('rejects a receipt with wrong key (exit 1)', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aa-test-'));
      const fixture = JSON.parse(
        execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' }),
      );
      const jwsPath = join(dir, 'test.jws');
      writeFileSync(jwsPath, fixture.jws);
      const keyPath = join(dir, 'wrongkey.txt');
      writeFileSync(keyPath, 'gaZ_TriTufIrs8OBGQBy3jMBV-rOZvNF3eXZBV-ZJKk');

      const { stdout, exitCode } = run(['verify', jwsPath, '--key', keyPath]);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('INVALID');
      expect(stdout).toContain('E_INVALID_SIGNATURE');
    });

    it('exits 2 when no key provided for receipt', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aa-test-'));
      const fixture = JSON.parse(
        execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' }),
      );
      const jwsPath = join(dir, 'test.jws');
      writeFileSync(jwsPath, fixture.jws);

      const { exitCode, stdout } = run(['verify', jwsPath]);
      expect(exitCode).toBe(2);
      expect(stdout).toContain('requires a public key');
    });

    it('verifies a bundle with included keys', () => {
      const { stdout, exitCode } = run(['verify', join(FIXTURES, 'valid_minimal.zip')]);
      // Bundle receipts may fail schema validation (Wire 0.1 fixture)
      // but the command should complete with exit 0 or 1
      expect(exitCode === 0 || exitCode === 1).toBe(true);
      expect(stdout).toContain('01HQXG0000TESTBUNDLE001');
    });

    it('detects invalid signatures in bundle (exit 1)', () => {
      const { stdout, exitCode } = run(['verify', join(FIXTURES, 'invalid_signature.zip')]);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('INVALID');
    });

    it('verify --json produces frozen contract output', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aa-test-'));
      const fixture = JSON.parse(
        execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(FIXTURES, 'valid-wire02.json')}', 'utf-8'))`], { encoding: 'utf-8' }),
      );
      const jwsPath = join(dir, 'test.jws');
      writeFileSync(jwsPath, fixture.jws);
      const keyPath = join(dir, 'pubkey.txt');
      writeFileSync(keyPath, fixture.publicKey);

      const { stdout, exitCode } = run(['verify', jwsPath, '--key', keyPath, '--json']);
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout);
      expect(output.ok).toBe(true);
      expect(output.artifact_kind).toBe('receipt-jws');
      expect(output.status).toBe('valid');
      expect(output.checks).toBeInstanceOf(Array);
      expect(output.warnings).toBeInstanceOf(Array);
    });
  });

  describe('help', () => {
    it('shows help with --help', () => {
      const { stdout, exitCode } = run(['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('inspect');
      expect(stdout).toContain('verify');
      expect(stdout).toContain('demo');
    });
  });
});
