# Agent Auditor

Open a receipt or bundle. Verify it offline.

[![CI](https://github.com/originaryx/agent-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/originaryx/agent-auditor/actions/workflows/ci.yml)

Inspection and verification happen locally in your browser or CLI. No outbound verification or artifact fetches.

Agent Auditor is a lightweight inspector and verifier for signed agent receipts and evidence bundles. It decodes, displays, and cryptographically verifies receipts issued by AI agents, middleware, and automated systems.

```
$ agent-auditor demo

Agent Auditor Demo
Showing a sample Wire 0.2 evidence receipt

Receipt Summary
  Issuer          https://demo.peacprotocol.org
  Kind            evidence
  Type            org.peacprotocol/commerce
  Receipt ID      019cd522-84ce-7a37-8cc8-5402871a6d5d
  Subject         https://app.example.com/user/42
  Wire Version    0.2
  Issued At       2026-03-10T00:25:35.000Z
  Pillars         commerce
Extensions
  Commerce
    { "payment_rail": "stripe", "amount_minor": "1500", "currency": "USD" }

Timeline
  2026-03-10T00:25:35.000Z  Receipt issued
  2026-03-10T00:25:35.181Z  Interaction occurred
```

**[Try the web inspector](https://www.originary.xyz/agent-auditor)**

## Quick Start

### CLI

```bash
# Install
npm install -g @originaryx/agent-auditor

# See a sample receipt instantly
agent-auditor demo

# Inspect a receipt file
agent-auditor inspect ./receipt.jws

# Verify a receipt against a public key
agent-auditor verify ./receipt.jws --key ./public-key.bin

# Verify a dispute bundle (uses included keys)
agent-auditor verify ./bundle.zip

# Machine-readable JSON output
agent-auditor inspect ./receipt.jws --json
```

### Web Inspector

**Try it now:** [originary.xyz/agent-auditor](https://www.originary.xyz/agent-auditor)

Drop a receipt or bundle, or click a sample to see it instantly. No backend. No accounts. No data sent anywhere.

```bash
# Development
cd apps/web && pnpm dev

# Production build
pnpm build
```

Deploy to Vercel, Cloudflare Pages, or any static host. See `vercel.json` for a working config.

## What It Shows

**Receipts:** Issuer, kind, type, receipt ID, wire version, issued/occurred timestamps, pillar tags, typed extensions (Commerce, Access, Identity, Correlation, Challenge), unknown fields.

**Bundles:** Bundle ID, kind, creator, receipt count, key count, policy, per-receipt signature verification, aggregate summary.

**Verification:** Ed25519 signature check, schema validation, wire format, policy binding status, warnings with RFC 6901 pointers.

**Timeline:** Chronological event reconstruction from receipt claims and bundle metadata.

## What It Does Not Do

Agent Auditor is a read-only verifier. It does not:

- **Issue or sign receipts.** Use `@peac/protocol` to issue receipts.
- **Contact any server.** All inspection and verification happen locally. No outbound requests to fetch keys, resolve issuers, or upload artifacts.
- **Store keys or state.** No database, no config file, no session. Each run is stateless.
- **Verify bundle integrity in the browser.** The web inspector verifies receipt *signatures* (Ed25519) against included keys. Full bundle integrity verification (content hashes, file hashes, bundle signature, receipt ordering) requires the CLI, which uses `@peac/audit`.
- **Validate business logic.** It checks cryptographic and structural validity, not whether a receipt's claims make sense for your use case.

## CLI Commands

| Command | Description | Exit Code |
|---------|-------------|-----------|
| `agent-auditor inspect <file>` | Decode and display receipt or bundle | 0 = decoded, 2 = error |
| `agent-auditor verify <file>` | Verify with key or included keys | 0 = valid, 1 = invalid, 2 = error |
| `agent-auditor demo` | Show a sample receipt | 0 |

### Flags

| Flag | Used With | Description |
|------|-----------|-------------|
| `--json` | inspect, verify, demo | Machine-readable JSON (frozen contract) |
| `--key <path>` | verify | Ed25519 public key file (32-byte raw or base64url) |
| `--jwks <path>` | verify | JWKS file containing public keys |
| `--kid <id>` | verify | Select key by ID from JWKS |

## JSON Output Contract

The `--json` output is a stable contract from v0.1. Breaking changes require a major version bump.

```bash
# Inspect output: always { ok: true, verified: false, ... }
agent-auditor inspect ./receipt.jws --json

# Verify output: { ok: true/false, status: "valid"/"invalid"/"error", checks: [...] }
agent-auditor verify ./receipt.jws --key ./key.bin --json
```

See `packages/cli/src/contract.test.ts` for the frozen schema snapshot tests.

## Architecture

```
apps/web -----> packages/core  +--> @peac/crypto (npm)
                  |             +--> @peac/kernel (npm)
                  |             +--> @peac/protocol (npm, verify-local subpath)
packages/cli --> packages/core +--> @peac/schema (npm)
                  |
                  +-- bundle adapters (platform-isolated)
                      web:  jszip (browser, lazy-loaded)
                      node: @peac/audit (CLI, full bundle integrity)
```

Agent Auditor consumes PEAC Protocol packages from npm as published, unpatched dependencies.

## Security Model

- All inspection and verification happen locally. No outbound requests to fetch keys, resolve issuers, or upload artifacts.
- No private keys are stored or processed. Only public keys for signature verification.
- The web inspector runs entirely in-browser. No backend, no API calls.
- Bundle reading includes DoS hardening: file size limits, entry count limits, path traversal protection, per-entry decompressed size checks.
- The `--json` output never includes private key material.

## Development

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm test           # Run all tests (59 tests)
pnpm dev            # Dev server for web inspector
```

### E2E Test (Web)

```bash
# Start preview server first, then run smoke test
pnpm build
cd apps/web && pnpm exec vite preview --port 5200 &
pnpm test:e2e
```

## Supported Formats

- **Wire 0.2** (`interaction-record+jwt`): current stable PEAC receipt format, fully supported
- **Wire 0.1** (`peac-receipt/0.1`): frozen legacy format, decoded where cost is near-zero
- **Dispute bundles** (`.zip`): manifest, receipts, keys, optional policy

## License

Apache-2.0

Built by [Originary](https://originary.xyz) on the [PEAC Protocol](https://peacprotocol.org).
