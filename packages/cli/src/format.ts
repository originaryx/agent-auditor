/**
 * Designed terminal output formatting for Agent Auditor CLI.
 *
 * Terminal output is designed, not dumped: clean layout, visual hierarchy.
 */

import type {
  NormalizedReceipt,
  NormalizedBundle,
  TimelineEvent,
  ClaimsSummary,
} from '@originaryx/agent-auditor-core';
import type { ReceiptVerifyResult } from '@originaryx/agent-auditor-core';
import { EXTENSION_DISPLAY_NAMES } from '@originaryx/agent-auditor-core';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';

function field(label: string, value: string | undefined, mono = false): string {
  if (value === undefined) return '';
  const formatted = mono ? `${DIM}${value}${RESET}` : value;
  return `  ${DIM}${label.padEnd(16)}${RESET}${formatted}`;
}

export function formatReceiptSummary(receipt: NormalizedReceipt): string {
  const s = receipt.claimsSummary;
  const lines: string[] = [];

  lines.push(`${BOLD}Receipt Summary${RESET}`);
  lines.push('');
  lines.push(field('Issuer', s.iss));
  lines.push(field('Kind', s.kind));
  lines.push(field('Type', s.type));
  lines.push(field('Receipt ID', s.jti, true));
  if (s.sub) lines.push(field('Subject', s.sub));
  lines.push(field('Wire Version', s.wire_version));
  if (s.issued_at) lines.push(field('Issued At', s.issued_at));
  if (s.occurred_at) lines.push(field('Occurred At', s.occurred_at));
  if (s.pillars && s.pillars.length > 0) {
    lines.push(field('Pillars', s.pillars.join(', ')));
  }

  // Extensions
  const extKeys = Object.keys(receipt.extensions);
  if (extKeys.length > 0) {
    lines.push('');
    lines.push(`${BOLD}Extensions${RESET}`);
    for (const key of extKeys) {
      const displayName = EXTENSION_DISPLAY_NAMES[key] ?? `Custom: ${key}`;
      lines.push(`  ${CYAN}${displayName}${RESET}`);
      const val = receipt.extensions[key];
      const jsonStr = JSON.stringify(val, null, 2);
      for (const line of jsonStr.split('\n')) {
        lines.push(`    ${DIM}${line}${RESET}`);
      }
    }
  }

  // Unknown fields
  if (receipt.unknownFields.length > 0) {
    lines.push('');
    lines.push(`${YELLOW}Unknown fields: ${receipt.unknownFields.join(', ')}${RESET}`);
  }

  return lines.filter(Boolean).join('\n');
}

export function formatBundleSummary(bundle: NormalizedBundle): string {
  const s = bundle.bundleSummary;
  const lines: string[] = [];

  lines.push(`${BOLD}Bundle Summary${RESET}`);
  lines.push('');
  lines.push(field('Bundle ID', s.bundle_id, true));
  lines.push(field('Kind', s.kind));
  lines.push(field('Created By', s.created_by));
  lines.push(field('Created At', s.created_at));
  lines.push(field('Total Receipts', String(s.total_receipts)));
  lines.push(field('Keys Included', String(s.keys_included)));
  lines.push(field('Policy Included', s.policy_included ? 'Yes' : 'No'));

  return lines.filter(Boolean).join('\n');
}

export function formatTimeline(events: TimelineEvent[]): string {
  if (events.length === 0) return `  ${DIM}No timeline events.${RESET}`;

  const lines: string[] = [];
  lines.push(`${BOLD}Timeline${RESET}`);
  lines.push('');

  for (const e of events) {
    const ts = `${DIM}${e.timestamp}${RESET}`;
    lines.push(`  ${ts}  ${e.label}`);
    if (e.detail) lines.push(`  ${''.padEnd(24)}${DIM}${e.detail}${RESET}`);
  }

  return lines.join('\n');
}

export function formatVerifyResult(result: ReceiptVerifyResult): string {
  const lines: string[] = [];

  const statusIcon = result.ok ? `${GREEN}VALID${RESET}` : `${RED}INVALID${RESET}`;
  lines.push(`${BOLD}Verification: ${statusIcon}`);
  lines.push('');

  // Checks
  for (const check of result.checks) {
    const icon = check.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const msg = check.message ? ` ${DIM}(${check.message})${RESET}` : '';
    lines.push(`  ${icon}  ${check.name}${msg}`);
  }

  // Policy binding
  if (result.policyBinding) {
    const pbColor = result.policyBinding === 'verified' ? GREEN
      : result.policyBinding === 'failed' ? RED : YELLOW;
    lines.push('');
    lines.push(`  ${DIM}Policy binding:${RESET} ${pbColor}${result.policyBinding}${RESET}`);
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('');
    for (const e of result.errors) {
      lines.push(`  ${RED}${e.code}: ${e.message}${RESET}`);
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('');
    for (const w of result.warnings) {
      const pointer = w.pointer ? ` at ${w.pointer}` : '';
      lines.push(`  ${YELLOW}${w.code}: ${w.message}${pointer}${RESET}`);
    }
  }

  return lines.join('\n');
}

export function formatBundleVerifyResults(
  results: Array<{ receiptId: string; result: ReceiptVerifyResult }>,
): string {
  const lines: string[] = [];
  const validCount = results.filter((r) => r.result.ok).length;
  const invalidCount = results.filter((r) => !r.result.ok).length;

  lines.push(`${BOLD}Receipt Signature Verification${RESET}`);
  lines.push(`${DIM}  Ed25519 signatures verified against included keys${RESET}`);
  lines.push('');
  lines.push(`  ${GREEN}${validCount} signature${validCount !== 1 ? 's' : ''} valid${RESET}${invalidCount > 0 ? `  ${RED}${invalidCount} invalid${RESET}` : ''}`);
  lines.push('');

  for (const r of results) {
    const icon = r.result.ok ? `${GREEN}VALID${RESET}` : `${RED}INVALID${RESET}`;
    lines.push(`  ${icon}  ${DIM}${r.receiptId}${RESET}`);
    if (!r.result.ok && r.result.errors.length > 0) {
      lines.push(`         ${RED}${r.result.errors[0].code}: ${r.result.errors[0].message}${RESET}`);
    }
  }

  return lines.join('\n');
}
