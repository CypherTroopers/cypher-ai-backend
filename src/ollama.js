import { REQUIRED_AI_MODEL } from './constants.js';

const DEFAULT_CHAT_TIMEOUT_MS = 120000;

function trimSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

export function defaultOllamaUrlFromRpcUrl(rpcUrl) {
  const url = new URL(rpcUrl);
  return url.protocol + '//' + url.hostname + ':11434';
}

export function normalizeOllamaUrl(value, rpcUrl) {
  const raw = value ? value : defaultOllamaUrlFromRpcUrl(rpcUrl);
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('ollamaUrl must be http or https');
  }
  return trimSlash(url.toString());
}

export async function generateWithOllama(ollamaUrl, prompt, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_CHAT_TIMEOUT_MS);

  try {
    const response = await fetch(trimSlash(ollamaUrl) + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model || REQUIRED_AI_MODEL,
        prompt,
        stream: false,
      }),
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_err) {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || response.statusText || 'ollama request failed');
    }

    const answer = data?.response || data?.message?.content || '';
    if (!answer) throw new Error('ollama returned an empty response');

    return { answer, raw: data };
  } finally {
    clearTimeout(timeout);
  }
}
