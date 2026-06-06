# CypherAI Frontend

User-facing CypherAI frontend.

The frontend talks only to the official backend. It does not send prompts directly to AI node RPC endpoints.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment

```text
VITE_CYPHER_AI_BACKEND_URL=http://127.0.0.1:8787
```

## Features

- backend health check
- official required model display
- minimum RAM / VRAM requirement display
- eligible AI node count
- eligible AI node list
- chat form prepared for `POST /api/v1/chat`

## Note

The backend chat route is not implemented yet. The UI is already prepared for it and will work once the backend provides `POST /api/v1/chat`.
