# CypherAI Backend + Frontend

CypherTroopers official service repository.

This repository contains both:

- official backend for AI miner registration, verification, health checks, and chat routing
- user frontend for the CypherAI chat UI

## Directory layout

```text
.
├── src/          # Official AI backend
└── frontend/    # User frontend
```

## Required runtime

```text
Node.js >= 20
```

## Correct first setup order

Run these commands from the repository root.

```bash
git clone https://github.com/CypherTroopers/cypher-ai-backend.git
cd cypher-ai-backend
```

Install backend dependencies first:

```bash
npm install
```

Install frontend dependencies separately:

```bash
npm run frontend:install
```

Copy the frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

Default frontend backend URL:

```text
VITE_CYPHER_AI_BACKEND_URL=http://127.0.0.1:8787
```

## Run locally without PM2

Terminal 1, start the backend:

```bash
npm start
```

Default backend URL:

```text
http://127.0.0.1:8787
```

Terminal 2, start the frontend:

```bash
npm run frontend:dev
```

If you need to access the frontend from another machine or browser outside localhost, use:

```bash
npm run frontend:dev:host
```

## Run with PM2

Install dependencies before starting PM2. This order is important because Vite is installed under `frontend/node_modules`.

```bash
cd /root/cypher-ai-backend

git pull
npm install
npm run frontend:install
```

Start backend:

```bash
pm2 delete cypher-ai-backend || true
pm2 start npm --name cypher-ai-backend -- start
```

Start frontend for external access:

```bash
pm2 delete cypher-ai-frontend || true
pm2 start npm --name cypher-ai-frontend -- run frontend:dev:host
```

Save PM2 process list:

```bash
pm2 save
```

Check logs:

```bash
pm2 logs cypher-ai-backend --lines 50
pm2 logs cypher-ai-frontend --lines 50
```

## Backend responsibilities

The backend currently handles:

- creating AI miner registration challenges
- verifying AI miner wallet signatures
- calling each node's `eth_aiStatus`
- rejecting normal nodes and validators that are not AI miners
- rejecting nodes that did not pass AI preflight
- rejecting nodes without the required model or minimum memory proof
- listing eligible AI nodes
- routing frontend chat requests to eligible AI miner Ollama endpoints

## Important AI miner requirement

An AI miner node must be started from the Cypher node repo with the AI miner flag and must pass AI preflight first.

Example preflight on the AI node server:

```bash
./build/bin/cypher ai-preflight \
  --ai.model CypherTroopers/cypheriumai-light-v1-alpha \
  --ai.memorygb 32
```

Example AI node start:

```bash
./build/bin/cypher \
  --datadir ./chaindb0 \
  --ai.miner \
  --ai.model CypherTroopers/cypheriumai-light-v1-alpha \
  --ai.memorygb 32
```

The backend only treats a node as eligible when its `eth_aiStatus` confirms the required AI miner state.

## Register an AI miner

Create a registration challenge:

```bash
curl -s -X POST http://127.0.0.1:8787/api/v1/challenge \
  -H "Content-Type: application/json" \
  --data '{"minerAddress":"0xYOUR_AI_MINER_ADDRESS"}' | jq
```

Sign the returned `challenge.message` with the AI miner wallet, then register:

```bash
curl -s -X POST http://127.0.0.1:8787/api/v1/nodes/register \
  -H "Content-Type: application/json" \
  --data '{
    "minerAddress":"0xYOUR_AI_MINER_ADDRESS",
    "rpcUrl":"http://YOUR_AI_NODE_IP:8000",
    "ollamaUrl":"http://YOUR_AI_NODE_IP:11434",
    "signature":"0xSIGNATURE",
    "note":"ai-miner-1"
  }' | jq
```

List all registered nodes:

```bash
curl -s http://127.0.0.1:8787/api/v1/nodes | jq
```

List eligible AI nodes:

```bash
curl -s http://127.0.0.1:8787/api/v1/nodes/eligible | jq
```

## Chat API

The frontend sends user prompts to:

```text
POST /api/v1/chat
```

Manual test:

```bash
curl -s -X POST http://127.0.0.1:8787/api/v1/chat \
  -H "Content-Type: application/json" \
  --data '{"prompt":"Hello CypherAI"}' | jq
```

If no eligible AI miner is registered, the endpoint returns an error such as:

```text
no eligible AI nodes registered
```

## Common issue: vite not found

If PM2 logs show:

```text
sh: 1: vite: not found
```

Run frontend dependency installation before starting the frontend process:

```bash
cd /root/cypher-ai-backend
npm run frontend:install
pm2 restart cypher-ai-frontend
```
