# Agent Auditor

Open a receipt or bundle. Verify it offline.

[![CI](https://github.com/originaryx/agent-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/originaryx/agent-auditor/actions/workflows/ci.yml)

Inspection and verification happen locally in your browser or CLI. No outbound verification or artifact fetches.

## Install

```bash
npm install -g @originaryx/agent-auditor
```

## Usage

```bash
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

## Commands

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

## What It Does Not Do

Agent Auditor is a read-only verifier. It does not issue or sign receipts, contact any server, store keys or state, or validate business logic. It checks cryptographic and structural validity only.

## Web Inspector

**[originary.xyz/agent-auditor](https://www.originary.xyz/agent-auditor)**

Drop a receipt or bundle in the browser. No backend. No accounts.

## License

Apache-2.0

---

PEAC Protocol is an open source project stewarded by [Originary](https://www.originary.xyz).

[Docs](https://www.originary.xyz/agent-auditor) &nbsp;·&nbsp; [GitHub](https://github.com/originaryx/agent-auditor) &nbsp;·&nbsp; [Originary](https://www.originary.xyz) &nbsp;·&nbsp; [npm](https://www.npmjs.com/package/@originaryx/agent-auditor)
