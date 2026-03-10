/**
 * Artifact type detection.
 *
 * Detects whether input is a receipt (JWS compact), receipt (JSON),
 * bundle (ZIP), or capture spool (JSONL) from raw bytes or string.
 */

import type { ArtifactKind } from './types.js';

/** ZIP magic bytes: PK\x03\x04 */
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/**
 * JWS compact format: three base64url segments separated by dots.
 * Strict: no whitespace, only [A-Za-z0-9_-] and dots.
 */
const JWS_COMPACT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Detect artifact kind from input.
 *
 * @param input - Raw bytes (Uint8Array/ArrayBuffer) or string
 * @returns Detected artifact kind
 */
export function detectArtifactKind(input: Uint8Array | ArrayBuffer | string): ArtifactKind {
  // Binary input: check for ZIP magic
  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    if (bytes.length >= 4 && startsWithZipMagic(bytes)) {
      return 'bundle-zip';
    }
    // Try decoding as UTF-8 text
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return detectFromText(text);
    } catch {
      return 'unknown';
    }
  }

  // String input
  return detectFromText(input);
}

function detectFromText(text: string): ArtifactKind {
  const trimmed = text.trim();

  // JWS compact: exactly three dot-separated base64url segments
  if (JWS_COMPACT_PATTERN.test(trimmed)) {
    return 'receipt-jws';
  }

  // JSONL: multiple lines each starting with '{' (check before single JSON)
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('{'))) {
      // Verify at least the first line is valid JSON
      try {
        JSON.parse(lines[0]);
        return 'spool-jsonl';
      } catch {
        // Fall through to other checks
      }
    }
  }

  // JSON: try parsing single object
  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return 'receipt-json';
    } catch {
      return 'unknown';
    }
  }

  return 'unknown';
}

function startsWithZipMagic(bytes: Uint8Array): boolean {
  return (
    bytes[0] === ZIP_MAGIC[0] &&
    bytes[1] === ZIP_MAGIC[1] &&
    bytes[2] === ZIP_MAGIC[2] &&
    bytes[3] === ZIP_MAGIC[3]
  );
}
