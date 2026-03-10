import { useState, useCallback, lazy, Suspense } from 'react';
import {
  detectArtifactKind,
  parseReceipt,
  normalizeBundle,
  verifyReceipt,
  verifyBundleReceipts,
  buildInspectReceiptOutput,
  buildInspectBundleOutput,
  EXTENSION_DISPLAY_NAMES,
  type ArtifactKind,
  type InspectOutput,
  type NormalizedReceipt,
  type NormalizedBundle,
  type ReceiptVerifyResult,
} from '@originaryx/agent-auditor-core';

// Sample fixtures (embedded as data)
import validFixture from '../../../fixtures/valid-wire02.json';
import invalidFixture from '../../../fixtures/invalid-sig.json';

type ViewTab = 'summary' | 'verify' | 'timeline' | 'raw';

interface AppState {
  loading: boolean;
  artifact: ArtifactKind | null;
  inspectOutput: InspectOutput | null;
  receipt: NormalizedReceipt | null;
  bundle: NormalizedBundle | null;
  verifyResult: ReceiptVerifyResult | null;
  bundleVerifyResults: Array<{ receiptId: string; result: ReceiptVerifyResult }> | null;
  error: string | null;
}

const initialState: AppState = {
  loading: false,
  artifact: null,
  inspectOutput: null,
  receipt: null,
  bundle: null,
  verifyResult: null,
  bundleVerifyResults: null,
  error: null,
};

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [activeTab, setActiveTab] = useState<ViewTab>('summary');

  const processInput = useCallback(async (input: string | ArrayBuffer, filename?: string) => {
    setState({ ...initialState, loading: true });
    setActiveTab('summary');

    try {
      const kind = detectArtifactKind(
        typeof input === 'string' ? input : new Uint8Array(input),
      );

      if (kind === 'receipt-jws' && typeof input === 'string') {
        const receipt = parseReceipt(input.trim());
        const inspectOutput = buildInspectReceiptOutput(receipt);
        setState({
          ...initialState,
          artifact: kind,
          receipt,
          inspectOutput,
        });
      } else if (kind === 'bundle-zip') {
        // Lazy-load ZIP parsing only when needed
        const [{ createWebBundleReader }, { default: JSZip }] = await Promise.all([
          import('@originaryx/agent-auditor-core/bundle/web'),
          import('jszip'),
        ]);

        const reader = createWebBundleReader(JSZip);
        const bytes = typeof input === 'string'
          ? new TextEncoder().encode(input)
          : new Uint8Array(input);
        const readResult = await reader.read(bytes);

        if (!readResult.ok) {
          setState({ ...initialState, error: `${readResult.code}: ${readResult.message}` });
          return;
        }

        const bundle = normalizeBundle(readResult);
        const inspectOutput = buildInspectBundleOutput(bundle);

        // Auto-verify bundle receipts with included keys
        const verifyResults = await verifyBundleReceipts(
          readResult.receipts,
          readResult.keys,
        );

        setState({
          ...initialState,
          artifact: kind,
          bundle,
          inspectOutput,
          bundleVerifyResults: verifyResults,
        });
      } else if (kind === 'unknown') {
        setState({ ...initialState, error: `Could not detect artifact type${filename ? ` for "${filename}"` : ''}. Supported: .jws, .json, .zip, .jsonl` });
      } else {
        setState({ ...initialState, error: `Artifact type "${kind}" display not yet implemented.` });
      }
    } catch (err: unknown) {
      setState({ ...initialState, error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.name.endsWith('.zip')) {
      reader.onload = () => processInput(reader.result as ArrayBuffer, file.name);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => processInput(reader.result as string, file.name);
      reader.readAsText(file);
    }
  }, [processInput]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.name.endsWith('.zip')) {
      reader.onload = () => processInput(reader.result as ArrayBuffer, file.name);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => processInput(reader.result as string, file.name);
      reader.readAsText(file);
    }
  }, [processInput]);

  const loadSampleValid = useCallback(() => {
    processInput(validFixture.jws, 'valid-wire02.jws');
  }, [processInput]);

  const loadSampleInvalid = useCallback(() => {
    processInput(invalidFixture.jws, 'invalid-sig.jws');
  }, [processInput]);

  const loadSampleBundle = useCallback(async () => {
    const response = await fetch('/fixtures/valid_minimal.zip');
    const buffer = await response.arrayBuffer();
    processInput(buffer, 'valid_minimal.zip');
  }, [processInput]);

  const handleVerifyWithKey = useCallback(async (publicKey: string) => {
    if (!state.receipt) return;
    try {
      const result = await verifyReceipt(state.receipt.jws, publicKey);
      setState((prev) => ({ ...prev, verifyResult: result }));
      setActiveTab('verify');
    } catch (err: unknown) {
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state.receipt]);

  // Determine which tabs to show
  const availableTabs: ViewTab[] = ['summary'];
  if (state.receipt) availableTabs.push('verify');
  availableTabs.push('timeline', 'raw');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-brand">
          <a href="https://www.originary.xyz" className="app-header-parent">
            <span>Originary</span>
            <span className="app-header-sep">/</span>
          </a>
          <span className="app-header-title">Agent Auditor</span>
        </div>
        <div className="app-header-actions">
          <span className="app-header-badge">Apache-2.0</span>
          <a
            href="https://github.com/originaryx/agent-auditor"
            target="_blank"
            rel="noopener noreferrer"
            className="app-header-gh"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            GitHub
          </a>
          <a href="https://www.originary.xyz/agent-auditor" className="app-header-site">
            originary.xyz/agent-auditor
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Landing: Drop Zone + Samples */}
        {!state.artifact && !state.error && !state.loading && (
          <div>
            <div
              className="border-2 border-dashed border-gray-700 rounded-lg p-10 text-center cursor-pointer hover:border-gray-500 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".jws,.json,.zip,.jsonl"
                onChange={handleFileSelect}
              />
              <p className="text-lg text-gray-400">Drop a receipt or bundle here</p>
              <p className="text-sm text-gray-600 mt-2">or click to browse (.jws, .json, .zip)</p>
              <p className="text-xs text-gray-600 mt-4">All processing happens locally. Nothing is uploaded.</p>
            </div>

            {/* Sample Buttons (primary, not secondary) */}
            <div className="mt-8">
              <p className="text-sm text-gray-500 mb-3 text-center">Or try a sample:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={loadSampleValid} className="p-4 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors text-left">
                  <span className="text-sm font-medium text-gray-200">Valid Receipt</span>
                  <span className="block text-xs text-gray-500 mt-1">Signed evidence receipt with commerce extension</span>
                </button>
                <button onClick={loadSampleInvalid} className="p-4 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors text-left">
                  <span className="text-sm font-medium text-gray-200">Invalid Receipt</span>
                  <span className="block text-xs text-gray-500 mt-1">Receipt with a wrong signature key</span>
                </button>
                <button onClick={loadSampleBundle} className="p-4 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors text-left">
                  <span className="text-sm font-medium text-gray-200">Bundle</span>
                  <span className="block text-xs text-gray-500 mt-1">Dispute bundle with receipts and included keys</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {state.loading && (
          <div className="text-center py-12 text-gray-500">Processing...</div>
        )}

        {/* Error */}
        {state.error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-4 mt-4">
            <p className="text-red-400 text-sm">{state.error}</p>
            <button
              onClick={() => setState(initialState)}
              className="mt-3 px-3 py-1 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700"
            >
              Try another file
            </button>
          </div>
        )}

        {/* Result Display */}
        {state.artifact && !state.loading && (
          <div>
            {/* Back button + artifact badge */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setState(initialState)}
                className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-sm hover:bg-gray-700"
              >
                Load another
              </button>
              <span className="px-2 py-1 bg-blue-900/50 text-blue-400 rounded text-xs font-mono">
                {state.artifact}
              </span>
              {state.receipt && (
                <span className="text-sm text-gray-500">
                  Wire {state.receipt.wireVersion ?? 'unknown'}
                </span>
              )}
            </div>

            {/* Tabs: summary > verify > timeline > raw */}
            <div className="flex gap-1 border-b border-gray-800 mb-4">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'summary' && state.receipt && (
              <SummaryView receipt={state.receipt} />
            )}
            {activeTab === 'summary' && state.bundle && (
              <BundleSummaryView bundle={state.bundle} verifyResults={state.bundleVerifyResults} />
            )}
            {activeTab === 'verify' && state.receipt && (
              <VerifyView
                receipt={state.receipt}
                result={state.verifyResult}
                onVerify={handleVerifyWithKey}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelineView events={state.receipt?.timeline ?? state.bundle?.timeline ?? []} />
            )}
            {activeTab === 'raw' && (
              <RawView data={state.inspectOutput} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span>Agent Auditor by <a href="https://www.originary.xyz" className="app-footer-link">Originary</a>.</span>
        <span className="app-footer-sep">·</span>
        <span>Inspection and verification happen locally. No outbound verification or artifact fetches.</span>
        <span className="app-footer-sep">·</span>
        <a href="https://github.com/originaryx/agent-auditor" target="_blank" rel="noopener noreferrer" className="app-footer-link">GitHub</a>
        <span className="app-footer-sep">·</span>
        <a href="https://www.originary.xyz/agent-auditor" className="app-footer-link">About</a>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function SummaryView({ receipt }: { receipt: NormalizedReceipt }) {
  const s = receipt.claimsSummary;
  return (
    <div className="space-y-3">
      <Field label="Issuer" value={s.iss} />
      <Field label="Kind" value={s.kind} />
      <Field label="Type" value={s.type} />
      <Field label="Receipt ID" value={s.jti} mono />
      {s.sub && <Field label="Subject" value={s.sub} />}
      <Field label="Wire Version" value={s.wire_version} />
      {s.issued_at && <Field label="Issued At" value={s.issued_at} />}
      {s.occurred_at && <Field label="Occurred At" value={s.occurred_at} />}
      {s.pillars && s.pillars.length > 0 && (
        <Field label="Pillars" value={s.pillars.join(', ')} />
      )}

      {/* Extensions */}
      {Object.keys(receipt.extensions).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Extensions</h3>
          {Object.entries(receipt.extensions).map(([key, value]) => (
            <div key={key} className="bg-gray-900 rounded p-3 mb-2 border border-gray-800">
              <p className="text-xs text-blue-400 font-mono mb-1">
                {EXTENSION_DISPLAY_NAMES[key] ?? `Custom: ${key}`}
              </p>
              <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BundleSummaryView({
  bundle,
  verifyResults,
}: {
  bundle: NormalizedBundle;
  verifyResults: Array<{ receiptId: string; result: ReceiptVerifyResult }> | null;
}) {
  const s = bundle.bundleSummary;
  const validCount = verifyResults?.filter((r) => r.result.ok).length ?? 0;
  const invalidCount = verifyResults?.filter((r) => !r.result.ok).length ?? 0;

  return (
    <div className="space-y-3">
      <Field label="Bundle ID" value={s.bundle_id} mono />
      <Field label="Kind" value={s.kind} />
      <Field label="Created By" value={s.created_by} />
      <Field label="Created At" value={s.created_at} />
      <Field label="Total Receipts" value={String(s.total_receipts)} />
      <Field label="Keys Included" value={String(s.keys_included)} />
      <Field label="Policy Included" value={s.policy_included ? 'Yes' : 'No'} />

      {verifyResults && (
        <div className="mt-4 p-3 rounded bg-gray-900 border border-gray-800">
          <p className="text-sm font-semibold text-gray-400 mb-1">Receipt Signature Verification</p>
          <p className="text-xs text-gray-600 mb-2">
            Ed25519 signatures verified against included keys. Bundle integrity (content hash, bundle signature) requires the CLI.
          </p>
          <p className="text-sm">
            <span className="text-green-400">{validCount} signature{validCount !== 1 ? 's' : ''} valid</span>
            {invalidCount > 0 && (
              <span className="text-red-400 ml-3">{invalidCount} invalid</span>
            )}
          </p>
        </div>
      )}

      {/* Per-receipt list */}
      {verifyResults && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Receipts</h3>
          {verifyResults.map((r, i) => (
            <div key={i} className="bg-gray-900 rounded p-3 mb-2 border border-gray-800">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${r.result.ok ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {r.result.ok ? 'sig valid' : 'sig invalid'}
                </span>
                <span className="text-xs text-gray-500 font-mono">{r.receiptId}</span>
              </div>
              {!r.result.ok && r.result.errors.length > 0 && (
                <p className="text-xs text-red-400 mt-1">{r.result.errors[0].code}: {r.result.errors[0].message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineView({ events }: { events: Array<{ timestamp: string; label: string; detail?: string; source: string; receipt_id?: string }> }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No timeline events.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex gap-4 items-start py-2 border-b border-gray-800/50">
          <span className="text-xs text-gray-600 font-mono whitespace-nowrap min-w-[180px]">
            {e.timestamp}
          </span>
          <div>
            <p className="text-sm text-gray-300">{e.label}</p>
            {e.detail && <p className="text-xs text-gray-500">{e.detail}</p>}
            {e.receipt_id && <p className="text-xs text-gray-600 font-mono">{e.receipt_id}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function RawView({ data }: { data: InspectOutput | null }) {
  if (!data) return <p className="text-sm text-gray-500">No data.</p>;
  return (
    <div className="relative">
      <button
        onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
        className="absolute top-2 right-2 px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700"
      >
        Copy
      </button>
      <pre className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-xs text-gray-400 overflow-auto max-h-[600px]">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function VerifyView({
  receipt,
  result,
  onVerify,
}: {
  receipt: NormalizedReceipt;
  result: ReceiptVerifyResult | null;
  onVerify: (key: string) => void;
}) {
  const [keyInput, setKeyInput] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Public key (base64url encoded Ed25519)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Paste the Ed25519 public key (the 'x' field from JWKS)..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => onVerify(keyInput)}
            disabled={!keyInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Verify
          </button>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-lg border ${result.ok ? 'bg-green-950/30 border-green-800/50' : 'bg-red-950/30 border-red-800/50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-lg font-semibold ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
              {result.ok ? 'Signature Valid' : 'Signature Invalid'}
            </span>
            {result.policyBinding && (
              <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                Policy: {result.policyBinding}
              </span>
            )}
          </div>

          {/* Checks */}
          <div className="space-y-1">
            {result.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={c.passed ? 'text-green-400' : 'text-red-400'}>
                  {c.passed ? 'PASS' : 'FAIL'}
                </span>
                <span className="text-gray-400">{c.name}</span>
                {c.message && <span className="text-gray-600 text-xs">({c.message})</span>}
              </div>
            ))}
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">{e.code}: {e.message}</p>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Warnings:</p>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-400">{w.code}: {w.message}{w.pointer ? ` at ${w.pointer}` : ''}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm text-gray-500 min-w-[120px]">{label}</span>
      <span className={`text-sm text-gray-300 ${mono ? 'font-mono' : ''} break-all`}>{value}</span>
    </div>
  );
}
