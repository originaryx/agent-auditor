/**
 * Agent Auditor CLI
 *
 * Inspect and verify signed agent receipts and evidence bundles.
 *
 * Commands:
 *   inspect <file>  Decode and display receipt or bundle details
 *   verify  <file>  Verify receipt with key, or bundle with included keys
 *   demo            Run inspect on an embedded sample receipt
 *
 * Exit codes:
 *   0 = success (valid in verify mode, decoded in inspect mode)
 *   1 = invalid (verification failed)
 *   2 = error (bad input, missing file, parse failure)
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from './commands/inspect.js';
import { verify } from './commands/verify.js';
import { demo } from './commands/demo.js';

const program = new Command();

program
  .name('agent-auditor')
  .description('Inspect and verify signed agent receipts and evidence bundles')
  .version('0.1.0');

program
  .command('inspect')
  .description('Decode and display receipt or bundle details')
  .argument('<file>', 'Receipt (.jws, .json) or bundle (.zip) file')
  .option('--json', 'Output as machine-readable JSON (frozen contract)')
  .action(async (file: string, opts: { json?: boolean }) => {
    try {
      const filePath = resolve(file);
      const data = readFileSync(filePath);
      await inspect(data, filePath, opts.json ?? false);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`Error: file not found: ${file}`);
        process.exit(2);
      }
      throw err;
    }
  });

program
  .command('verify')
  .description('Verify receipt with key, or bundle with included keys')
  .argument('<file>', 'Receipt (.jws, .json) or bundle (.zip) file')
  .option('--key <path>', 'Public key file (raw Ed25519, 32 bytes)')
  .option('--jwks <path>', 'JWKS file containing public keys')
  .option('--kid <kid>', 'Key ID to select from JWKS (used with --jwks)')
  .option('--json', 'Output as machine-readable JSON (frozen contract)')
  .action(async (file: string, opts: { key?: string; jwks?: string; kid?: string; json?: boolean }) => {
    try {
      const filePath = resolve(file);
      const data = readFileSync(filePath);
      await verify(data, filePath, opts);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`Error: file not found: ${file}`);
        process.exit(2);
      }
      throw err;
    }
  });

program
  .command('demo')
  .description('Run inspect on an embedded sample receipt (instant first-use)')
  .option('--json', 'Output as machine-readable JSON')
  .action(async (opts: { json?: boolean }) => {
    await demo(opts.json ?? false);
  });

program.parse();
