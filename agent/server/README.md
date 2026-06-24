# Lorenzo Agent Service (`agent/server`)

Independent FastAPI service that powers the platform-wide AI assistant and the
global floating navigation/AI bar embedded across all Lorenzo apps.

**v1 scope:** authenticated streaming chat, per-user conversation history +
curated long-term memory, a tool registry with a permission/confirmation gate
(read-only/mock tools only — no write actions executed yet), structured logs,
health/bootstrap endpoints, and the embeddable widget. Independently deployable.

## Run locally

```bash
cd agent/server
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set MONGODB_URI, TRAINER_JWT_SECRET, and an LLM key (optional)
uvicorn app:app --host 127.0.0.1 --port 8040 --reload
```

Without an LLM key the chat still works using a safe "echo" placeholder provider,
so the widget can be tested end-to-end.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/agent/health` | none | status + provider + tools |
| GET | `/api/agent/bootstrap` | optional | nav URLs + signed-in state (widget uses this) |
| POST | `/api/agent/chat` | required | SSE streaming chat |
| GET | `/api/agent/conversations` | required | list user conversations |
| GET | `/api/agent/conversations/{id}/messages` | required | conversation history |
| GET | `/api/agent/memory` | required | curated per-user memory |
| GET | `/static/widget.js` | none | the embeddable widget bundle |

## Auth

Validates the **shared `trainer_auth` JWT** (HS256, `TRAINER_JWT_SECRET`) — same
token as trainer/proposals. Identity comes from the signed token (`sub`,
`is_admin`, `permissions`); no cross-DB user lookup. For the widget to send the
cookie cross-subdomain, the auth cookie domain must be the parent domain
(`.{APP_BASE_DOMAIN}`).

## Data (dedicated DB `lorenzo_agent`)

`agent_conversations`, `agent_messages`, `agent_memory` — isolated from the
shared `lorenzodb`. Only curated memory is stored (not blanket logging).

## Embedding the widget (fully env-driven)

Each app injects `<Script src="${NEXT_PUBLIC_AGENT_URL}/widget.js" />`. There is
**no hardcoded domain, no `/server`, and no localhost fallback** in code — if
`NEXT_PUBLIC_AGENT_URL` is unset, the widget is simply not injected.

The widget derives its API base from **its own script URL**, preserving any base
path. If it loads from `https://agent.example.com/server/widget.js`, its API base
is `https://agent.example.com/server` and calls go to
`https://agent.example.com/server/api/agent/...`.

**Set `NEXT_PUBLIC_AGENT_URL` per app:**

```bash
# Local
NEXT_PUBLIC_AGENT_URL=http://localhost:8040
# Production (agent mounted under /server by the reverse proxy)
NEXT_PUBLIC_AGENT_URL=https://agent.lorenzohome.ae/server
# Future client domain (any host + any base path)
NEXT_PUBLIC_AGENT_URL=https://agent.client-domain.com/server
```

After changing a `NEXT_PUBLIC_*` value, **redeploy** that app (Next inlines it at
build time).

### Base path / reverse proxy

The agent serves `/widget.js` and `/api/agent/*` at its **root**. Expose it under
a public base path by having the proxy route `${BASE_PATH}/*` to this service:
- If the proxy **strips** the prefix (e.g. Traefik StripPrefix) → leave
  `AGENT_ROOT_PATH` empty.
- If the proxy **keeps** the prefix → set `AGENT_ROOT_PATH=/server`.

Either way the widget calls the correct public URL because it reads its base from
its own script `src`.

### CORS (env-driven)

Set `AGENT_CORS_ORIGINS` to the exact app origins (see `.env.example` for local /
production / custom-domain examples). Future deployments only change env.

## Safety

- **No data-changing action is executed without explicit confirmation** — write
  tools are gated and never auto-runnable from model output.
- CORS allow-list of app origins; `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are
  server-side only and never reach the browser.
- Additive: existing services are untouched except one `<Script>` line per app.
