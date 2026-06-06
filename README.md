# CypherAI Backend + Frontend

 CypherTroopers service repository.

This repository contains both:

-  backend for AI miner registration and verification
- user frontend for CypherAI chat UI

## Directory layout

```text
.
├── src/          # AI backend
└── frontend/    # User frontend
```

## Backend

Install and run backend:

```bash
npm install
npm start
```

Default backend URL:

```text
http://127.0.0.1:8787
```

Backend responsibilities:

- create registration challenge
- verify AI miner wallet signature
- call node `eth_aiStatus`
- reject normal nodes and validators that are not AI miners
- reject nodes that did not pass AI preflight
- list eligible AI nodes

## Frontend

Install and run frontend:

```bash
npm run frontend:install
npm run frontend:dev
```

Or directly:

```bash
cd frontend
npm install
npm run dev
```

Default frontend environment:

```bash
cp frontend/.env.example frontend/.env
```

```text
VITE_CYPHER_AI_BACKEND_URL=http://127.0.0.1:8787
```

## Current status

The frontend already checks:

- backend health
- required AI miner config
- eligible AI node list

The chat UI calls:

```text
POST /api/v1/chat
```

That backend route is the next implementation target. Until it is added, the UI will show a clear Chat API error when the user sends a prompt.
