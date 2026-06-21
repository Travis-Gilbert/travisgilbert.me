'use client';

/**
 * DesktopSettingsView (SPEC-9 D4/D6): native desktop controls. Reads local
 * engine status (substrate node + commonplace-api), stores provider keys in the
 * OS keychain, and runs a sync to the hosted instance (honest receipt). All via
 * the shell's Tauri commands, so no CORS / network boundary.
 */

import { useCallback, useState } from 'react';
import { useApiData } from '@/lib/commonplace-api';
import {
  commonplaceStatus,
  keychainDelete,
  keychainHas,
  keychainSet,
  localNodeStatus,
  syncRun,
  type SyncReceipt,
} from '@/lib/desktop';
import { DesktopOnly, panel } from './desktopPanel';

const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'gemini', 'ollama'];

export default function DesktopSettingsView() {
  const { data: node } = useApiData(() => localNodeStatus(), []);
  const { data: cp } = useApiData(() => commonplaceStatus(), []);
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [sync, setSync] = useState<SyncReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkKey = useCallback(async (p: string) => {
    try {
      setHasKey(await keychainHas(p));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const saveKey = useCallback(async () => {
    if (!key.trim()) return;
    try {
      await keychainSet(provider, key.trim());
      setKey('');
      await checkKey(provider);
    } catch (err) {
      setError(String(err));
    }
  }, [provider, key, checkKey]);

  const removeKey = useCallback(async () => {
    try {
      await keychainDelete(provider);
      await checkKey(provider);
    } catch (err) {
      setError(String(err));
    }
  }, [provider, checkKey]);

  const runSync = useCallback(async () => {
    try {
      setSync(await syncRun());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  return (
    <DesktopOnly>
      <div style={panel.wrap}>
        <div style={panel.title}>Desktop</div>
        <div style={panel.sub}>
          Local engine status, provider keys (stored in the OS keychain), and sync to the hosted
          instance.
        </div>
        {error && <div style={{ ...panel.card, color: 'crimson' }}>{error}</div>}

        <div style={panel.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Local engine</div>
          <div style={panel.dim}>
            Substrate node: {node ? `${node.endpoint} (${node.nodeUp ? 'up' : 'down'})` : 'loading...'}
          </div>
          <div style={panel.dim}>
            CommonPlace API: {cp ? `${cp.endpoint} (${cp.nodeUp ? 'up' : 'down'})` : 'loading...'}
          </div>
          {node && (
            <div style={panel.dim}>
              Target: {node.activeTarget} · store: {node.storePath}
            </div>
          )}
        </div>

        <div style={panel.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Provider key</div>
          <div style={panel.row}>
            <select
              style={{ ...panel.input, flex: '0 0 140px' }}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setHasKey(null);
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              style={panel.input}
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={`${provider} API key`}
            />
            <button style={panel.button} onClick={() => void saveKey()}>
              Save
            </button>
          </div>
          <div style={panel.row}>
            <button style={panel.button} onClick={() => void checkKey(provider)}>
              Check
            </button>
            <button style={panel.button} onClick={() => void removeKey()}>
              Delete
            </button>
            {hasKey !== null && (
              <span style={panel.dim}>{hasKey ? 'key stored' : 'no key'}</span>
            )}
          </div>
        </div>

        <div style={panel.card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Sync</div>
          <div style={panel.row}>
            <span style={panel.dim}>Push the local workspace to the hosted instance.</span>
            <span style={{ flex: 1 }} />
            <button style={panel.button} onClick={() => void runSync()}>
              Sync now
            </button>
          </div>
          {sync && (
            <div style={panel.dim}>
              {sync.status}: {sync.message}
              {typeof sync.mergedNodes === 'number' ? ` (merged ${sync.mergedNodes} nodes)` : ''}
            </div>
          )}
        </div>
      </div>
    </DesktopOnly>
  );
}
