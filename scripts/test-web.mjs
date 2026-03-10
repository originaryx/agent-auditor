/**
 * Quick headless test: verify the web app loads and can process a sample.
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5200';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const failures = [];
  page.on('pageerror', (err) => errors.push(err.message));

  function check(label, value) {
    console.log(`${label}: ${value}`);
    if (!value) failures.push(label);
  }

  console.log('Loading web app...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Check title
  const title = await page.title();
  check('Title is Agent Auditor', title === 'Agent Auditor');

  // Check drop zone exists
  const dropZone = await page.$('text=Drop a receipt or bundle here');
  check('Drop zone visible', dropZone !== null);

  // Check trust text
  const trustText = await page.$('text=All processing happens locally');
  check('Trust text visible', trustText !== null);

  // Check sample buttons exist (text is inside span children)
  const validBtn = await page.$('button:has-text("Valid Receipt")');
  const invalidBtn = await page.$('button:has-text("Invalid Receipt")');
  const bundleBtn = await page.$('button:has-text("Bundle")');
  check('Valid button', validBtn !== null);
  check('Invalid button', invalidBtn !== null);
  check('Bundle button', bundleBtn !== null);

  // Click "Valid Receipt" sample
  console.log('\nLoading valid receipt sample...');
  await validBtn.click();
  await page.waitForSelector('text=receipt-jws', { timeout: 5000 });

  // Check summary tab content
  const issuer = await page.$('text=https://demo.peacprotocol.org');
  check('Issuer displayed', issuer !== null);

  const kind = await page.$('text=evidence');
  check('Kind displayed', kind !== null);

  const wireVersion = await page.$('text=Wire 0.2');
  check('Wire version displayed', wireVersion !== null);

  // Check verify tab is available for receipts
  const verifyTab = await page.$('button:has-text("verify")');
  check('Verify tab available for receipt', verifyTab !== null);

  // Click timeline tab
  console.log('\nChecking timeline tab...');
  await page.click('button:has-text("timeline")');
  const timelineEvent = await page.$('text=Receipt issued');
  check('Timeline event', timelineEvent !== null);

  // Click raw tab
  console.log('\nChecking raw tab...');
  await page.click('button:has-text("raw")');
  const rawJson = await page.$('pre');
  check('Raw JSON displayed', rawJson !== null);

  // Go back and try bundle
  console.log('\nLoading bundle...');
  await page.click('text=Load another');
  await page.click('button:has-text("Bundle")');
  await page.waitForSelector('text=bundle-zip', { timeout: 10000 });

  const bundleId = await page.$('text=01HQXG0000TESTBUNDLE001');
  check('Bundle ID displayed', bundleId !== null);

  // Wait for async bundle verification to complete
  await page.waitForSelector('text=Receipt Signature Verification', { timeout: 10000 });
  check('Bundle receipt signature verification', true);

  // Check verify tab is NOT shown for bundles
  const verifyTabBundle = await page.$('button:has-text("verify")');
  check('Verify tab hidden for bundle', verifyTabBundle === null);

  if (errors.length > 0) {
    console.log('\nPage errors:', errors);
  }
  if (failures.length > 0) {
    console.log('\nFailed checks:', failures);
  }

  const passed = errors.length === 0 && failures.length === 0;
  console.log(`\n${passed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  await browser.close();
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
