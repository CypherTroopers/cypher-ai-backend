import fs from 'node:fs';
import path from 'node:path';
import { getAddress } from 'ethers';
import {
  REQUIRED_AI_MODEL,
  MIN_AI_MEMORY_GB,
  NODE_STALE_AFTER_MS,
  MAX_HEALTH_FAILURES,
  DEFAULT_REGISTRY_PATH,
} from './constants.js';
import { consumeChallenge } from './challenge.js';
import { getAiStatus } from './rpc.js';
import { validateAiStatus } from './validator.js';
import { normalizeOllamaUrl } from './ollama.js';

const nodes = new Map();

function registryPath() {
  return path.resolve(process.cwd(), DEFAULT_REGISTRY_PATH);
}

function ensureRegistryDir() {
  fs.mkdirSync(path.dirname(registryPath()), { recursive: true });
}

function loadRegistry() {
  try {
    const file = registryPath();
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = Array.isArray(data.nodes) ? data.nodes : [];
    for (const node of list) {
      if (!node || !node.id || !node.minerAddress || !node.rpcUrl) continue;
      nodes.set(String(node.id).toLowerCase(), node);
    }
  } catch (err) {
    console.error('Failed to load AI registry:', err.message || err);
  }
}

function saveRegistry() {
  ensureRegistryDir();
  const file = registryPath();
  const tmp = file + '.tmp';
  const data = {
    version: 1,
    updatedAt: Date.now(),
    nodes: Array.from(nodes.values()).sort((a, b) => a.registeredAt - b.registeredAt),
  };
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function isEligibleNode(node, now = Date.now()) {
  return Boolean(node?.active && now - node.lastSeenAt <= NODE_STALE_AFTER_MS);
}

function publicNode(node, now = Date.now()) {
  return {
    ...node,
    eligible: isEligibleNode(node, now),
  };
}

loadRegistry();

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
  const previous = nodes.get(id);
  const node = {
    id,
    minerAddress: address,
    rpcUrl,
    ollamaUrl,
    note: input.note || '',
    model: REQUIRED_AI_MODEL,
    memoryGB: Number(status.memoryGB || status.requiredMemoryGB || status.minMemoryGB || MIN_AI_MEMORY_GB),
    registeredAt: previous?.registeredAt || now,
    updatedAt: now,
    lastSeenAt: now,
    active: true,
    healthFailures: 0,
    status,
    lastError: '',
  };

  nodes.set(id, node);
  saveRegistry();
  return publicNode(node, now);
}

export function listNodes(activeOnly = false) {
  const now = Date.now();
  return Array.from(nodes.values())
    .filter((node) => !activeOnly || isEligibleNode(node, now))
    .sort((a, b) => a.registeredAt - b.registeredAt)
    .map((node) => publicNode(node, now));
}

export function getNode(id) {
  const node = nodes.get(String(id).toLowerCase()) || null;
  return node ? publicNode(node) : null;
}

export async function checkNodeHealth(node) {
  const id = node.id || String(node.minerAddress || '').toLowerCase();
  const stored = nodes.get(id) || node;

  try {
    const status = await getAiStatus(stored.rpcUrl);
    const validation = validateAiStatus(status);
    const now = Date.now();
    stored.updatedAt = now;
    stored.status = status;

    if (!validation.ok) {
      stored.healthFailures += 1;
      stored.active = false;
      stored.lastError = validation.errors.join(', ');
      saveRegistry();
      return publicNode(stored, now);
    }

    stored.active = true;
    stored.healthFailures = 0;
    stored.lastSeenAt = now;
    stored.lastError = '';
    saveRegistry();
    return publicNode(stored, now);
  } catch (err) {
    stored.healthFailures += 1;
    stored.updatedAt = Date.now();
    stored.lastError = err.message || String(err);
    if (stored.healthFailures >= MAX_HEALTH_FAILURES) stored.active = false;
    saveRegistry();
    return publicNode(stored);
  }
}

export async function checkAllNodes() {
  const result = [];
  for (const node of nodes.values()) result.push(await checkNodeHealth(node));
  return result;
}
