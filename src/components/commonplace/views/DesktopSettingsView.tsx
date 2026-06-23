'use client';

/**
 * DesktopSettingsView (SPEC-9 D4/D6): native desktop controls. Reads local
 * engine status (substrate node + commonplace-api), stores provider keys in the
 * OS keychain, and pulls hosted memory docs into the local CommonPlace store.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  commonplaceStatus,
  harnessBearerClear,
  harnessBearerSet,
  harnessSettingsGet,
  harnessSettingsSet,
  hostedConnectionStatus,
  isTauri,
  keychainDelete,
  keychainHas,
  keychainSet,
  localNodeStatus,
  modelStatus,
  syncRun,
  type CommonplaceStatusInfo,
  type HarnessSettings,
  type HostedConnectionStatus,
  type LocalNodeStatus,
  type ModelStatus,
  type SyncReceipt,
} from '@/lib/desktop';
import {
  readLocalAgentSettings,
  writeLocalAgentSettings,
  type LocalAgentSettings,
} from '@/lib/local-agent';
import { DesktopOnly, panel } from './desktopPanel';

const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'gemini', 'ollama'];

const DEFAULT_SETTINGS: HarnessSettings = {
  endpoint: 'https://rustyredcore-theorem-production.up.railway.app/mcp',
  localEndpoint: 'http://127.0.0.1:17888/mcp',
  activeTarget: 'local',
  tenant: 'Travis-Gilbert',
  bearerPresent: false,
};

export default function DesktopSettingsView() {
  const [node, setNode] = useState<LocalNodeStatus | null>(null);
  const [cp, setCp] = useState<CommonplaceStatusInfo | null>(null);
  const [settings, setSettings] = useState<HarnessSettings>(DEFAULT_SETTINGS);
  const [hosted, setHosted] = useState<HostedConnectionStatus | null>(null);
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [localAgent, setLocalAgent] = useState<LocalAgentSettings>(() =>
    readLocalAgentSettings(),
  );
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [key, setKey] = useState('');
  const [bearer, setBearer] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [sync, setSync] = useState<SyncReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const [nextNode, nextCp, nextSettings, nextHosted, nextModel] =
        await Promise.all([
          localNodeStatus(),
          commonplaceStatus(),
          harnessSettingsGet(),
          hostedConnectionStatus(),
          modelStatus(),
        ]);
      setNode(nextNode);
      setCp(nextCp);
      if (nextSettings) setSettings(nextSettings);
      setHosted(nextHosted);
      setModel(nextModel);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshStatus]);

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

  const saveConnection = useCallback(async () => {
    try {
      setBusy(true);
      await harnessSettingsSet(settings);
      await refreshStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [settings, refreshStatus]);

  const saveBearer = useCallback(async () => {
    if (!bearer.trim()) return;
    try {
      setBusy(true);
      await harnessBearerSet(bearer.trim());
      setBearer('');
      await refreshStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [bearer, refreshStatus]);

  const clearBearer = useCallback(async () => {
    try {
      setBusy(true);
      await harnessBearerClear();
      await refreshStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const runHostedImport = useCallback(async () => {
    try {
      setBusy(true);
      setSync(await syncRun());
      await refreshStatus();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const saveLocalAgent = useCallback(() => {
    writeLocalAgentSettings(localAgent);
    setError(null);
  }, [localAgent]);

  return (
    <DesktopOnly>
      <div style={panel.wrap}>
        <div style={panel.title}>Desktop</div>
        <div style={panel.sub}>
          Local engine, hosted tenant, model endpoint, provider keys, and sync.
        </div>
        {error && (
          <div style={{ ...panel.card, color: 'crimson' }}>{error}</div>
        )}

        <div style={panel.card}>
          <SectionTitle title="Connection" />
          <StatusLine
            label="Local RustyRed"
            ok={node?.nodeUp ?? false}
            text={node ? `${node.endpoint} · ${node.storePath}` : 'loading...'}
          />
          <StatusLine
            label="CommonPlace API"
            ok={cp?.nodeUp ?? false}
            text={cp ? `${cp.endpoint} · ${cp.storePath}` : 'loading...'}
          />
          <StatusLine
            label="Hosted tenant"
            ok={hosted?.reachable ?? false}
            text={hosted?.message ?? 'loading...'}
          />
          <StatusLine
            label="Local agent"
            ok={model?.reachable ?? false}
            text={
              model
                ? `${model.model} · ${model.endpoint} · ${model.message}`
                : 'loading...'
            }
          />
        </div>

        <div style={panel.card}>
          <SectionTitle title="Local Agent" />
          <div style={panel.row}>
            <label style={{ ...panel.dim, display: 'flex', gap: 6 }}>
              <input
                type="checkbox"
                checked={localAgent.enabled}
                onChange={(event) =>
                  setLocalAgent((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              Use in desktop ask
            </label>
            <select
              style={{ ...panel.input, flex: '0 0 130px' }}
              value={localAgent.protocol}
              onChange={(event) =>
                setLocalAgent((current) => ({
                  ...current,
                  protocol: event.target.value as LocalAgentSettings['protocol'],
                  endpoint:
                    event.target.value === 'ollama'
                      ? 'http://127.0.0.1:11434'
                      : 'http://127.0.0.1:8080/v1/chat/completions',
                }))
              }
            >
              <option value="openai">OpenAI API</option>
              <option value="ollama">Ollama</option>
            </select>
            <input
              style={panel.input}
              value={localAgent.model}
              onChange={(event) =>
                setLocalAgent((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              placeholder="Model"
            />
          </div>
          <div style={panel.row}>
            <input
              style={panel.input}
              value={localAgent.endpoint}
              onChange={(event) =>
                setLocalAgent((current) => ({
                  ...current,
                  endpoint: event.target.value,
                }))
              }
              placeholder="Endpoint"
            />
            <button
              style={panel.button}
              disabled={busy}
              onClick={saveLocalAgent}
            >
              Save
            </button>
          </div>
        </div>

        <div style={panel.card}>
          <SectionTitle title="Tenant" />
          <div style={panel.row}>
            <input
              style={panel.input}
              value={settings.tenant}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  tenant: event.target.value,
                }))
              }
              placeholder="Tenant"
            />
            <select
              style={{ ...panel.input, flex: '0 0 130px' }}
              value={settings.activeTarget}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  activeTarget: event.target
                    .value as HarnessSettings['activeTarget'],
                }))
              }
            >
              <option value="local">local</option>
              <option value="hosted">hosted</option>
            </select>
            <button
              style={panel.button}
              disabled={busy}
              onClick={() => void saveConnection()}
            >
              Save
            </button>
          </div>
          <div style={panel.row}>
            <input
              style={panel.input}
              value={settings.endpoint}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  endpoint: event.target.value,
                }))
              }
              placeholder="Hosted MCP endpoint"
            />
          </div>
          <div style={panel.row}>
            <input
              style={panel.input}
              value={settings.localEndpoint}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  localEndpoint: event.target.value,
                }))
              }
              placeholder="Local MCP endpoint"
            />
          </div>
        </div>

        <div style={panel.card}>
          <SectionTitle title="Sign In" />
          <div style={panel.row}>
            <input
              style={panel.input}
              type="password"
              value={bearer}
              onChange={(event) => setBearer(event.target.value)}
              placeholder="Hosted bearer token"
            />
            <button
              style={panel.button}
              disabled={busy || !bearer.trim()}
              onClick={() => void saveBearer()}
            >
              Save token
            </button>
            <button
              style={panel.button}
              disabled={busy}
              onClick={() => void clearBearer()}
            >
              Clear
            </button>
          </div>
          <div style={panel.dim}>
            {settings.bearerPresent
              ? 'Bearer token stored in Keychain.'
              : 'No hosted token stored.'}
          </div>
        </div>

        <div style={panel.card}>
          <SectionTitle title="Sync" />
          <div style={panel.row}>
            <span style={panel.dim}>
              Pull hosted memory documents into the local CommonPlace store.
            </span>
            <span style={{ flex: 1 }} />
            <button
              style={panel.button}
              disabled={busy}
              onClick={() => void runHostedImport()}
            >
              Sync now
            </button>
          </div>
          {sync && (
            <div style={panel.dim}>
              {sync.status}: {sync.message}
              {typeof sync.mergedNodes === 'number'
                ? ` (${sync.mergedNodes} imported)`
                : ''}
            </div>
          )}
        </div>

        <div style={panel.card}>
          <SectionTitle title="Provider Key" />
          <div style={panel.row}>
            <select
              style={{ ...panel.input, flex: '0 0 140px' }}
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value);
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
              onChange={(event) => setKey(event.target.value)}
              placeholder={`${provider} API key`}
            />
            <button style={panel.button} onClick={() => void saveKey()}>
              Save
            </button>
          </div>
          <div style={panel.row}>
            <button
              style={panel.button}
              onClick={() => void checkKey(provider)}
            >
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
      </div>
    </DesktopOnly>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>;
}

function StatusLine({
  label,
  ok,
  text,
}: {
  label: string;
  ok: boolean;
  text: string;
}) {
  return (
    <div style={{ ...panel.row, marginBottom: 6 }}>
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          background: ok
            ? 'var(--cp-green, #4b8b6b)'
            : 'var(--cp-red, #b96a5b)',
          flex: '0 0 auto',
        }}
      />
      <span style={{ minWidth: 118, fontWeight: 600 }}>{label}</span>
      <span style={panel.dim}>{text}</span>
    </div>
  );
}
