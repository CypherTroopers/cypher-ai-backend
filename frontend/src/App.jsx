import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8787';
const DEFAULT_AI_RPC_URL = 'http://167.86.76.166:8000';
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

function utf8ToHex(value) {
  const bytes = new TextEncoder().encode(value);
  return '0x' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
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

function JsonBlock({ value }) {
  if (!value) return null;
  return <pre className="answer compact">{JSON.stringify(value, null, 2)}</pre>;
}

function TopNav({ currentPage }) {
  return (
    <nav className="top-nav">
      <a className={currentPage === 'chat' ? 'active' : ''} href="/">
        User Chat
      </a>
      <a className={currentPage === 'register' ? 'active' : ''} href="/miner/register">
        Register AI Miner
      </a>
    </nav>
  );
}

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const currentPage = currentPath === '/miner/register' ? 'register' : 'chat';

  const envBackendUrl = import.meta.env.VITE_CYPHER_AI_BACKEND_URL || DEFAULT_BACKEND_URL;
  const [backendUrl, setBackendUrl] = useState(envBackendUrl);
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [eligibleNodes, setEligibleNodes] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [registration, setRegistration] = useState({
    minerAddress: '',
    rpcUrl: DEFAULT_AI_RPC_URL,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    note: 'ai-miner',
  });
  const [walletAddress, setWalletAddress] = useState('');
  const [statusCheck, setStatusCheck] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [signature, setSignature] = useState('');
  const [registrationResult, setRegistrationResult] = useState(null);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationLoading, setRegistrationLoading] = useState(false);

  const baseUrl = useMemo(() => normalizeBaseUrl(backendUrl), [backendUrl]);

  function updateRegistration(field, value) {
    setRegistration((current) => ({ ...current, [field]: value }));
  }

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
      setError('Chat API returned an error: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      throw new Error('No browser wallet found. Install MetaMask or another EIP-1193 wallet.');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const account = accounts?.[0];
    if (!account) throw new Error('No wallet account selected');

    setWalletAddress(account);
    if (!registration.minerAddress) updateRegistration('minerAddress', account);
    return account;
  }

  async function checkAiNodeStatus(event) {
    event.preventDefault();
    setRegistrationLoading(true);
    setRegistrationError('');
    setStatusCheck(null);

    try {
      const result = await requestJson(baseUrl, '/api/v1/nodes/check-status', {
        method: 'POST',
        body: JSON.stringify({
          rpcUrl: registration.rpcUrl.trim(),
          ollamaUrl: registration.ollamaUrl.trim(),
        }),
      });
      setStatusCheck(result);
    } catch (err) {
      setRegistrationError('AI status check failed: ' + (err.message || String(err)));
    } finally {
      setRegistrationLoading(false);
    }
  }

  async function createRegistrationChallenge(event) {
    event.preventDefault();
    setRegistrationLoading(true);
    setRegistrationError('');
    setChallenge(null);
    setSignature('');
    setRegistrationResult(null);

    try {
      const minerAddress = registration.minerAddress.trim();
      if (!minerAddress) throw new Error('minerAddress is required');

      const result = await requestJson(baseUrl, '/api/v1/challenge', {
        method: 'POST',
        body: JSON.stringify({ minerAddress }),
      });
      setChallenge(result.challenge);
    } catch (err) {
      setRegistrationError('Challenge creation failed: ' + (err.message || String(err)));
    } finally {
      setRegistrationLoading(false);
    }
  }

  async function signRegistrationChallenge(event) {
    event.preventDefault();
    setRegistrationLoading(true);
    setRegistrationError('');
    setSignature('');

    try {
      if (!challenge?.message) throw new Error('Create a challenge first');

      const account = walletAddress || await connectWallet();
      const minerAddress = registration.minerAddress.trim();
      if (normalizeAddress(account) !== normalizeAddress(minerAddress)) {
        throw new Error('Connected wallet does not match minerAddress');
      }

      const signed = await window.ethereum.request({
        method: 'personal_sign',
        params: [utf8ToHex(challenge.message), account],
      });
      setSignature(signed);
    } catch (err) {
      setRegistrationError('Wallet signature failed: ' + (err.message || String(err)));
    } finally {
      setRegistrationLoading(false);
    }
  }

  async function registerAiMiner(event) {
    event.preventDefault();
    setRegistrationLoading(true);
    setRegistrationError('');
    setRegistrationResult(null);

    try {
      if (!signature) throw new Error('Sign the latest challenge before registering');

      const result = await requestJson(baseUrl, '/api/v1/nodes/register', {
        method: 'POST',
        body: JSON.stringify({
          minerAddress: registration.minerAddress.trim(),
          rpcUrl: registration.rpcUrl.trim(),
          ollamaUrl: registration.ollamaUrl.trim(),
          signature,
          note: registration.note.trim(),
        }),
      });

      setRegistrationResult(result);
      setChallenge(null);
      setSignature('');
      await refresh();
    } catch (err) {
      setRegistrationError('Registration failed: ' + (err.message || String(err)));
    } finally {
      setRegistrationLoading(false);
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
          <h1>{currentPage === 'register' ? 'Register AI Miner' : 'Ask CypherAI'}</h1>
          <p className="subtext">
            {currentPage === 'register'
              ? 'This page is only for AI miner operators. Registration uses wallet signing and never asks for private keys.'
              : 'User chat page. Prompts are sent only to the official backend, not directly to node RPC endpoints.'}
          </p>
          <TopNav currentPage={currentPage} />
        </div>
        <div className="status-card">
          <StatusBadge ok={Boolean(status?.ok)} label={status?.ok ? 'Backend online' : 'Backend offline'} />
          <p>{status?.service || 'Waiting for backend health check'}</p>
        </div>
      </section>

      <section className="panel compact-panel">
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

      {currentPage === 'chat' ? (
        <>
          <section className="grid">
            <div className="panel">
              <h2>AI network status</h2>
              <dl>
                <dt>Required model</dt>
                <dd>{config?.requiredModel || 'Unknown'}</dd>
                <dt>Eligible AI nodes</dt>
                <dd>{eligibleNodes.length}</dd>
              </dl>
            </div>

            <div className="panel">
              <h2>User page</h2>
              <p className="muted">
                This page is for normal users asking questions. AI miner registration is handled on a separate operator page.
              </p>
              <a className="text-link" href="/miner/register">Open AI miner registration</a>
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
        </>
      ) : (
        <>
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
              <h2>Registered eligible AI nodes</h2>
              <p className="big-number">{eligibleNodes.length}</p>
              <p className="muted">Only nodes passing --ai.miner, eth_aiStatus, model, and preflight checks appear here.</p>
            </div>
          </section>

          <section className="panel registration-panel">
            <div className="section-heading">
              <div>
                <h2>AI Miner Registration</h2>
                <p className="muted">
                  Use this page only if you operate an AI miner node. The wallet address must match the miner reward address.
                </p>
              </div>
              <StatusBadge ok={Boolean(walletAddress)} label={walletAddress ? 'Wallet connected' : 'Wallet not connected'} />
            </div>

            <form className="registration-form">
              <div className="form-grid">
                <label>
                  Miner reward address
                  <input
                    value={registration.minerAddress}
                    onChange={(event) => updateRegistration('minerAddress', event.target.value)}
                    placeholder="0x..."
                  />
                </label>
                <label>
                  AI node RPC URL
                  <input
                    value={registration.rpcUrl}
                    onChange={(event) => updateRegistration('rpcUrl', event.target.value)}
                    placeholder={DEFAULT_AI_RPC_URL}
                  />
                </label>
                <label>
                  Ollama URL as seen by official backend
                  <input
                    value={registration.ollamaUrl}
                    onChange={(event) => updateRegistration('ollamaUrl', event.target.value)}
                    placeholder={DEFAULT_OLLAMA_URL}
                  />
                </label>
                <label>
                  Note
                  <input
                    value={registration.note}
                    onChange={(event) => updateRegistration('note', event.target.value)}
                    placeholder="ai-miner-1"
                  />
                </label>
              </div>

              <div className="button-row">
                <button type="button" onClick={async () => {
                  setRegistrationError('');
                  try {
                    await connectWallet();
                  } catch (err) {
                    setRegistrationError(err.message || String(err));
                  }
                }}>
                  Connect Wallet
                </button>
                <button type="button" disabled={registrationLoading} onClick={checkAiNodeStatus}>
                  Check AI Status
                </button>
                <button type="button" disabled={registrationLoading} onClick={createRegistrationChallenge}>
                  Create Challenge
                </button>
                <button type="button" disabled={registrationLoading || !challenge} onClick={signRegistrationChallenge}>
                  Sign Challenge
                </button>
                <button type="button" disabled={registrationLoading || !signature} onClick={registerAiMiner}>
                  Register AI Miner
                </button>
              </div>
            </form>

            {walletAddress && <p className="muted">Connected wallet: {walletAddress}</p>}
            {registrationError && <p className="error">{registrationError}</p>}
            {statusCheck && (
              <div className="result-block">
                <StatusBadge ok={statusCheck.ok} label={statusCheck.ok ? 'AI status accepted' : 'AI status rejected'} />
                <JsonBlock value={statusCheck} />
              </div>
            )}
            {challenge && (
              <div className="result-block">
                <h3>Challenge ready</h3>
                <p className="muted">Sign this challenge with the miner wallet. The challenge expires soon and is consumed after registration.</p>
                <pre className="answer compact">{challenge.message}</pre>
              </div>
            )}
            {signature && (
              <div className="result-block">
                <StatusBadge ok label="Challenge signed" />
                <pre className="answer compact">{signature}</pre>
              </div>
            )}
            {registrationResult && (
              <div className="result-block">
                <StatusBadge ok label="AI miner registered" />
                <JsonBlock value={registrationResult} />
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Eligible AI node list</h2>
            {eligibleNodes.length === 0 ? (
              <p className="muted">No eligible AI nodes registered yet.</p>
            ) : (
              <div className="node-list">
                {eligibleNodes.map((node) => (
                  <article className="node" key={node.id || node.minerAddress}>
                    <strong>{node.minerAddress}</strong>
                    <span>{node.rpcUrl}</span>
                    <span>{node.ollamaUrl}</span>
                    <StatusBadge ok={node.eligible} label={node.eligible ? 'eligible' : 'not eligible'} />
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
