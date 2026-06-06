import { REQUIRED_AI_MODEL, MIN_AI_MEMORY_GB } from './constants.js';

export function validateAiStatus(status) {
  const errors = [];
  if (!status || typeof status !== 'object') return { ok: false, errors: ['missing status'] };
  if (status.enabled !== true) errors.push('not enabled');
  if (status.aiMiner !== true) errors.push('not ai miner');
  if (status.model !== REQUIRED_AI_MODEL) errors.push('bad model');
  if (status.preflightPassed !== true) errors.push('preflight failed');
  if (status.ollamaModelInstalled !== true) errors.push('model missing');
  const memoryGB = Number(status.memoryGB || status.requiredMemoryGB || status.minMemoryGB || 0);
  if (!Number.isFinite(memoryGB) || memoryGB < MIN_AI_MEMORY_GB) errors.push('memory too small');
  return { ok: errors.length === 0, errors };
}
