import 'dotenv/config';

function readNumber(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export const REQUIRED_AI_MODEL = process.env.REQUIRED_AI_MODEL || 'CypherTroopers/cypheriumai-light-v1-alpha';
export const MIN_AI_MEMORY_GB = readNumber('MIN_AI_MEMORY_GB', 32);
export const DEFAULT_PORT = readNumber('PORT', 8787);
export const DEFAULT_HOST = process.env.HOST || '0.0.0.0';
export const DEFAULT_REGISTRY_PATH = process.env.AI_REGISTRY_PATH || './data/ai-nodes.json';
export const DEFAULT_CHALLENGE_PATH = process.env.AI_CHALLENGE_PATH || './data/ai-challenges.json';
export const CHALLENGE_TTL_MS = readNumber('CHALLENGE_TTL_MS', 300000);
export const HEALTH_CHECK_INTERVAL_MS = readNumber('HEALTH_CHECK_INTERVAL_MS', 60000);
export const NODE_STALE_AFTER_MS = readNumber('NODE_STALE_AFTER_MS', 180000);
export const MAX_HEALTH_FAILURES = readNumber('MAX_HEALTH_FAILURES', 3);
export const RPC_TIMEOUT_MS = readNumber('RPC_TIMEOUT_MS', 8000);
