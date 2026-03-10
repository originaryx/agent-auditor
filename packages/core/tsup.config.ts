import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry (browser-safe: detect, parse, normalize, timeline, verify)
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    outExtension: ({ format }) => ({
      js: format === 'esm' ? '.mjs' : '.cjs',
    }),
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'esnext',
  },
  // Node-only bundle adapter
  {
    entry: { 'bundle/bundle.node': 'src/bundle/bundle.node.ts' },
    format: ['esm', 'cjs'],
    outExtension: ({ format }) => ({
      js: format === 'esm' ? '.mjs' : '.cjs',
    }),
    dts: true,
    sourcemap: true,
    target: 'node22',
    external: ['@peac/audit'],
  },
  // Browser-only bundle adapter
  {
    entry: { 'bundle/bundle.web': 'src/bundle/bundle.web.ts' },
    format: ['esm', 'cjs'],
    outExtension: ({ format }) => ({
      js: format === 'esm' ? '.mjs' : '.cjs',
    }),
    dts: true,
    sourcemap: true,
    target: 'esnext',
    external: ['jszip'],
  },
]);
