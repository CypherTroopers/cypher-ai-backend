import express from 'express';
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  HEALTH_CHECK_INTERVAL_MS,
  REQUIRED_AI_MODEL,
  MIN_AI_MEMORY_GB,
} from './constants.js';
import { createChallenge } from './challenge.js';
import {
  registerNode,
  listNodes,
  getNode,
  checkNodeHealth,
  checkAllNodes,
} from './registry.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cypher-ai-official-backend',
  });
});

app.get('/api/v1/config', (_req, res) => {
  res.json({
    requiredModel: REQUIRED_AI_MODEL,
    minMemoryGB: MIN_AI_MEMORY_GB,
  });
});

app.post('/api/v1/challenge', (req, res) => {
  try {
    const challenge = createChallenge(req.body.minerAddress);
    res.json({ ok: true, challenge });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || String(err),
    });
  }
});

app.post('/api/v1/nodes/register', async (req, res) => {
  try {
    const node = await registerNode(req.body);
    res.json({ ok: true, node });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || String(err),
    });
  }
});

app.get('/api/v1/nodes', (_req, res) => {
  res.json({
    ok: true,
    nodes: listNodes(false),
  });
});

app.get('/api/v1/nodes/eligible', (_req, res) => {
  res.json({
    ok: true,
    nodes: listNodes(true),
  });
});

app.get('/api/v1/nodes/:id', (req, res) => {
  const node = getNode(req.params.id);
  if (!node) {
    return res.status(404).json({
      ok: false,
      error: 'node not found',
    });
  }

  return res.json({ ok: true, node });
});

app.post('/api/v1/nodes/:id/check', async (req, res) => {
  const node = getNode(req.params.id);
  if (!node) {
    return res.status(404).json({
      ok: false,
      error: 'node not found',
    });
  }

  const checked = await checkNodeHealth(node);
  return res.json({ ok: true, node: checked });
});

setInterval(() => {
  checkAllNodes().catch((err) => {
    console.error('AI registry health check failed:', err.message || err);
  });
}, HEALTH_CHECK_INTERVAL_MS).unref();

app.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
  console.log(
    'CypherAI official backend listening on http://' +
      DEFAULT_HOST +
      ':' +
      DEFAULT_PORT,
  );
});
