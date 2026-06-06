import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8787';

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(baseUrl + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_err) {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText;
    throw new Error(message || 'request failed');
  }

  return data;
}

function StatusBadge({ ok, label }) {
  return <span className={ok ? 'badge badge-ok' : 'badge badge-warn'}>{label}</span>;
}

export default function App() {
  const envBackendUrl = import.meta.env.VITE_CYPHER_AI_BACKEND_URL || DEFAULT_BACKEND_URL;
  const [backendUrl, setBackendUrl] = useState(envBackendUrl);
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [eligibleNodes, setEligibleNodes] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const baseUrl = useMemo(() => normalizeBaseUrl(backendUrl), [backendUrl]);

  async function refresh() {
    setError('');
    try {
      const [health, cfg, nodes] = await Promise.all([
        requestJson(baseUrl, '/health'),
        requestJson(baseUrl, '/api/v1/config'),
        requestJson(baseUrl, '/api/v1/nodes/eligible'),
      ]);

      setStatus(health);
      setConfig(cfg);
      setEligibleNodes(nodes.nodes || []);
    } catch (err) {
      setStatus(null);
      setConfig(null);
      setEligibleNodes([]);
      setError(err.message || String(err));
    }
  }

  async function sendPrompt(event) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const data = await requestJson(baseUrl, '/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: trimmed }),
      });

      setAnswer(data.answer || JSON.stringify(data, null, 2));
    } catch (err) {
      setError(
        'Chat API returned an error: ' +
          (err.message || String(err)),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">CypherAI</p>
          <h1>Official AI frontend</h1>
          <p className="subtext">
            This UI talks only to the official backend. It does not send user prompts directly to node RPC endpoints.
          </p>
        </div>
        <div className="status-card">
          <StatusBadge ok={Boolean(status?.ok)} label={status?.ok ? 'Backend online' : 'Backend offline'} />
          <p>{status?.service || 'Waiting for backend health check'}</p>
        </div>
      </section>

      <section className="panel">
        <label htmlFor="backendUrl">Backend URL</label>
        <div className="row">
          <input
            id="backendUrl"
            value={backendUrl}
            onChange={(event) => setBackendUrl(event.target.value)}
            placeholder={DEFAULT_BACKEND_URL}
          />
          <button type="button" onClick={refresh}>Refresh</button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Required AI miner spec</h2>
          <dl>
            <dt>Model</dt>
            <dd>{config?.requiredModel || 'Unknown'}</dd>
            <dt>Minimum RAM / VRAM</dt>
            <dd>{config?.minMemoryGB || 'Unknown'} GB</dd>
          </dl>
        </div>

        <div className="panel">
          <h2>Eligible AI nodes</h2>
          <p className="big-number">{eligibleNodes.length}</p>
          <p className="muted">Only nodes passing --ai.miner, eth_aiStatus, model, and preflight checks should appear here.</p>
        </div>
      </section>

      <section className="panel chat-panel">
        <h2>Ask CypherAI</h2>
        <form onSubmit={sendPrompt}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask a question..."
            rows={6}
          />
          <button type="submit" disabled={loading || !prompt.trim()}>
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
        {answer && <pre className="answer">{answer}</pre>}
      </section>

      <section className="panel">
        <h2>Eligible node list</h2>
        {eligibleNodes.length === 0 ? (
          <p className="muted">No eligible AI nodes registered yet.</p>
        ) : (
          <div className="node-list">
            {eligibleNodes.map((node) => (
              <article className="node" key={node.id || node.minerAddress}>
                <strong>{node.minerAddress}</strong>
                <span>{node.rpcUrl}</span>
                <StatusBadge ok={node.eligible} label={node.eligible ? 'eligible' : 'not eligible'} />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
