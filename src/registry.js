import { getAddress } from 'ethers';
import { REQUIRED_AI_MODEL, MIN_AI_MEMORY_GB, NODE_STALE_AFTER_MS, MAX_HEALTH_FAILURES } from './constants.js';
import { consumeChallenge } from './challenge.js';
import { getAiStatus } from './rpc.js';
import { validateAiStatus } from './validator.js';
import { normalizeOllamaUrl } from './ollama.js';

const nodes = new Map();

export async function registerNode(input) {
  const rpcUrl = input.rpcUrl;
  const minerAddress = input.minerAddress;
  const signature = input.signature;
  if (!rpcUrl) throw new Error('rpcUrl is required');
  if (!minerAddress) throw new Error('minerAddress is required');
  if (!signature) throw new Error('signature is required');

  const url = new URL(rpcUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('rpcUrl must be http or https');

  const address = getAddress(minerAddress);
  consumeChallenge(address, signature);

  const status = await getAiStatus(rpcUrl);
  const validation = validateAiStatus(status);
  if (!validation.ok) throw new Error('AI node rejected: ' + validation.errors.join(', '));

  const now = Date.now();
  const id = address.toLowerCase();
  const ollamaUrl = normalizeOllamaUrl(input.ollamaUrl, rpcUrl);
  const node = {
    id,
    minerAddress: address,
    rpcUrl,
    ollamaUrl,
    note: input.note || '',
    model: REQUIRED_AI_MODEL,
    memoryGB: Number(status.memoryGB || status.requiredMemoryGB || status.minMemoryGB || MIN_AI_MEMORY_GB),
    registeredAt: nodes.get(id)?.registeredAt || now,
    updatedAt: now,
    lastSeenAt: now,
    active: true,
    healthFailures: 0,
    status,
    lastError: '',
  };

  nodes.set(id, node);
  return node;
}

export function listNodes(activeOnly = false) {
  const now = Date.now();
  return Array.from(nodes.values())
    .filter((node) => !activeOnly || (node.active && now - node.lastSeenAt <= NODE_STALE_AFTER_MS))
    .sort((a, b) => a.registeredAt - b.registeredAt);
}

export function getNode(id) {
  return nodes.get(String(id).toLowerCase()) || null;
}

export async function checkNodeHealth(node) {
  try {
    const status = await getAiStatus(node.rpcUrl);
    const validation = validateAiStatus(status);
    const now = Date.now();
    node.updatedAt = now;
    node.status = status;

    if (!validation.ok) {
      node.healthFailures += 1;
      node.active = false;
      node.lastError = validation.errors.join(', ');
      return node;
    }

    node.active = true;
    node.healthFailures = 0;
    node.lastSeenAt = now;
    node.lastError = '';
    return node;
  } catch (err) {
    node.healthFailures += 1;
    node.updatedAt = Date.now();
    node.lastError = err.message || String(err);
    if (node.healthFailures >= MAX_HEALTH_FAILURES) node.active = false;
    return node;
  }
}

export async function checkAllNodes() {
  const result = [];
  for (const node of nodes.values()) result.push(await checkNodeHealth(node));
  return result;
}
