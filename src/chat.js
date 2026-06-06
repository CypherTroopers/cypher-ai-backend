import { createHash } from 'node:crypto';
import { listNodes, checkNodeHealth } from './registry.js';
import { REQUIRED_AI_MODEL, MAX_PROMPT_CHARS } from './constants.js';
import { generateWithOllama } from './ollama.js';

let nextNodeIndex = 0;

function sha256Hex(value) {
  return '0x' + createHash('sha256').update(String(value)).digest('hex');
}

function normalizePrompt(input) {
  const prompt = String(input?.prompt || '').trim();
  if (!prompt) throw new Error('prompt is required');
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error('prompt is too long; max ' + MAX_PROMPT_CHARS + ' characters');
  }
  return prompt;
}

function pickEligibleNodes() {
  const nodes = listNodes(true);
  if (nodes.length === 0) throw new Error('no eligible AI nodes registered');

  const ordered = [];
  for (let i = 0; i < nodes.length; i += 1) {
    ordered.push(nodes[(nextNodeIndex + i) % nodes.length]);
  }
  nextNodeIndex = (nextNodeIndex + 1) % nodes.length;
  return ordered;
}

export async function handleChat(input) {
  const prompt = normalizePrompt(input);
  const candidates = pickEligibleNodes();
  const errors = [];

  for (const node of candidates) {
    const checked = await checkNodeHealth(node);
    if (!checked.active) {
      errors.push(checked.minerAddress + ': ' + (checked.lastError || 'inactive'));
      continue;
    }

    try {
      const result = await generateWithOllama(checked.ollamaUrl, prompt, {
        model: REQUIRED_AI_MODEL,
      });

      return {
        answer: result.answer,
        minerAddress: checked.minerAddress,
        rpcUrl: checked.rpcUrl,
        ollamaUrl: checked.ollamaUrl,
        model: REQUIRED_AI_MODEL,
        promptHash: sha256Hex(prompt),
        answerHash: sha256Hex(result.answer),
        rawUsage: {
          totalDuration: result.raw?.total_duration || null,
          loadDuration: result.raw?.load_duration || null,
          promptEvalCount: result.raw?.prompt_eval_count || null,
          evalCount: result.raw?.eval_count || null,
          evalDuration: result.raw?.eval_duration || null,
        },
      };
    } catch (err) {
      checked.healthFailures += 1;
      checked.lastError = err.message || String(err);
      errors.push(checked.minerAddress + ': ' + checked.lastError);
    }
  }

  throw new Error('all eligible AI nodes failed: ' + errors.join('; '));
}
