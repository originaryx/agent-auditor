/**
 * inspect command: decode and display receipt or bundle details.
 *
 * Exit codes: 0 = decoded, 2 = error.
 */

import {
  detectArtifactKind,
  parseReceipt,
  normalizeBundle,
  buildInspectReceiptOutput,
  buildInspectBundleOutput,
} from '@originaryx/agent-auditor-core';
import { readBundle } from '../read-bundle.js';
import {
  formatReceiptSummary,
  formatBundleSummary,
  formatTimeline,
} from '../format.js';

export async function inspect(
  data: Buffer,
  filePath: string,
  json: boolean,
): Promise<void> {
  const kind = detectArtifactKind(new Uint8Array(data));

  if (kind === 'receipt-jws') {
    const jws = data.toString('utf-8').trim();
    const receipt = parseReceipt(jws);
    const output = buildInspectReceiptOutput(receipt);

    if (json) {
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
    }

    console.log(formatReceiptSummary(receipt));
    console.log('');
    console.log(formatTimeline(receipt.timeline));
    process.exit(0);
  }

  if (kind === 'bundle-zip') {
    const readResult = await readBundle(data);

    if (!readResult.ok) {
      console.error(`Error reading bundle: ${readResult.code}: ${readResult.message}`);
      process.exit(2);
    }

    const bundle = normalizeBundle(readResult);
    const output = buildInspectBundleOutput(bundle);

    if (json) {
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
    }

    console.log(formatBundleSummary(bundle));
    console.log('');
    console.log(formatTimeline(bundle.timeline));

    // Show per-receipt summaries
    if (bundle.receipts.length > 0) {
      console.log('');
      console.log('\x1b[1mReceipts\x1b[0m');
      for (const receipt of bundle.receipts) {
        const s = receipt.claimsSummary;
        console.log(`  \x1b[2m${s.jti}\x1b[0m  ${s.kind}/${s.type}  from ${s.iss}`);
      }
    }

    process.exit(0);
  }

  // Try as JSON receipt
  if (kind === 'receipt-json') {
    try {
      const parsed = JSON.parse(data.toString('utf-8'));
      const { parseReceiptJson } = await import('@originaryx/agent-auditor-core');
      const receipt = parseReceiptJson(parsed);
      const output = buildInspectReceiptOutput(receipt);

      if (json) {
        console.log(JSON.stringify(output, null, 2));
        process.exit(0);
      }

      console.log(formatReceiptSummary(receipt));
      console.log('');
      console.log(formatTimeline(receipt.timeline));
      process.exit(0);
    } catch {
      // Fall through to error
    }
  }

  console.error(`Error: could not detect artifact type for "${filePath}"`);
  console.error('Supported formats: .jws (compact JWS), .json (receipt claims), .zip (dispute bundle)');
  process.exit(2);
}
