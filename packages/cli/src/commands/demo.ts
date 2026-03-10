/**
 * demo command: run inspect on an embedded sample receipt.
 *
 * Instant first-use: no configuration, no arguments, no files needed.
 * Terminal output is designed for screenshots and onboarding.
 */

import { parseReceipt, buildInspectReceiptOutput } from '@originaryx/agent-auditor-core';
import { formatReceiptSummary, formatTimeline } from '../format.js';

// Embedded sample JWS: Wire 0.2 evidence receipt (same fixture as valid-wire02.json)
const SAMPLE_JWS = 'eyJ0eXAiOiJpbnRlcmFjdGlvbi1yZWNvcmQrand0IiwiYWxnIjoiRWREU0EiLCJraWQiOiJzcGlrZS1rZXktMDAxIn0.eyJwZWFjX3ZlcnNpb24iOiIwLjIiLCJraW5kIjoiZXZpZGVuY2UiLCJ0eXBlIjoib3JnLnBlYWNwcm90b2NvbC9jb21tZXJjZSIsImlzcyI6Imh0dHBzOi8vZGVtby5wZWFjcHJvdG9jb2wub3JnIiwiaWF0IjoxNzczMTAyMzM1LCJqdGkiOiIwMTljZDUyMi04NGNlLTdhMzctOGNjOC01NDAyODcxYTZkNWQiLCJzdWIiOiJodHRwczovL2FwcC5leGFtcGxlLmNvbS91c2VyLzQyIiwicGlsbGFycyI6WyJjb21tZXJjZSJdLCJvY2N1cnJlZF9hdCI6IjIwMjYtMDMtMTBUMDA6MjU6MzUuMTgxWiIsImV4dGVuc2lvbnMiOnsib3JnLnBlYWNwcm90b2NvbC9jb21tZXJjZSI6eyJwYXltZW50X3JhaWwiOiJzdHJpcGUiLCJhbW91bnRfbWlub3IiOiIxNTAwIiwiY3VycmVuY3kiOiJVU0QifX19.CMJeGuqGSbvwpc6lv4fvDAxxqDMeQYgzF6DQWDrZYhgTLvWHPgqNmxidZ6Iz6trnMe5oOgptrNnLOtgauzkbAw';

export async function demo(json: boolean): Promise<void> {
  const receipt = parseReceipt(SAMPLE_JWS);
  const output = buildInspectReceiptOutput(receipt);

  if (json) {
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  console.log('');
  console.log('\x1b[1mAgent Auditor Demo\x1b[0m');
  console.log('\x1b[2mShowing a sample Wire 0.2 evidence receipt\x1b[0m');
  console.log('');
  console.log(formatReceiptSummary(receipt));
  console.log('');
  console.log(formatTimeline(receipt.timeline));
  console.log('');
  console.log('\x1b[2mTo inspect your own receipts:\x1b[0m');
  console.log('  agent-auditor inspect ./receipt.jws');
  console.log('  agent-auditor verify ./receipt.jws --key ./public-key.bin');
  console.log('  agent-auditor verify ./bundle.zip');
  console.log('');

  process.exit(0);
}
