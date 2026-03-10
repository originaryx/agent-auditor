import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseReceipt, parseReceiptJson } from './parse.js';

const fixturesDir = join(import.meta.dirname, '../../..', 'fixtures');

describe('parseReceipt', () => {
  it('parses valid Wire 0.2 receipt', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = parseReceipt(fixture.jws);

    expect(result.wireVersion).toBe('0.2');
    expect(result.claimsSummary.iss).toBe('https://demo.peacprotocol.org');
    expect(result.claimsSummary.kind).toBe('evidence');
    expect(result.claimsSummary.type).toBe('org.peacprotocol/commerce');
    expect(result.claimsSummary.wire_version).toBe('0.2');
    expect(result.claimsSummary.jti).toBeTruthy();
    expect(result.claimsSummary.issued_at).toBeTruthy();
    expect(result.claimsSummary.pillars).toEqual(['commerce']);
  });

  it('extracts extensions', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = parseReceipt(fixture.jws);

    expect(result.extensions).toHaveProperty('org.peacprotocol/commerce');
    const commerce = result.extensions['org.peacprotocol/commerce'] as Record<string, unknown>;
    expect(commerce.payment_rail).toBe('stripe');
    expect(commerce.amount_minor).toBe('1500');
    expect(commerce.currency).toBe('USD');
  });

  it('builds timeline from claims', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = parseReceipt(fixture.jws);

    expect(result.timeline.length).toBeGreaterThanOrEqual(1);
    const issuedEvent = result.timeline.find((e) => e.label === 'Receipt issued');
    expect(issuedEvent).toBeTruthy();
    expect(issuedEvent!.source).toBe('claims.iat');
  });

  it('extracts header fields', () => {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, 'valid-wire02.json'), 'utf-8'));
    const result = parseReceipt(fixture.jws);

    expect(result.header.typ).toBe('interaction-record+jwt');
    expect(result.header.alg).toBe('EdDSA');
    expect(result.header.kid).toBe('spike-key-001');
  });

  it('throws on invalid JWS format', () => {
    expect(() => parseReceipt('not-a-jws')).toThrow();
  });
});

describe('parseReceiptJson', () => {
  it('parses Wire 0.2 JSON claims', () => {
    const claims = {
      peac_version: '0.2',
      kind: 'evidence',
      type: 'org.peacprotocol/access',
      iss: 'https://api.example.com',
      iat: 1700000000,
      jti: 'test-001',
      sub: 'https://resource.example.com',
    };

    const result = parseReceiptJson(claims);
    expect(result.wireVersion).toBe('0.2');
    expect(result.claimsSummary.iss).toBe('https://api.example.com');
    expect(result.claimsSummary.kind).toBe('evidence');
    expect(result.claimsSummary.type).toBe('org.peacprotocol/access');
    expect(result.jws).toBe('');
  });
});
