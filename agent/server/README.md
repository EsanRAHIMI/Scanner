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

## Embedding the widget

Each app loads `<Script src="{NEXT_PUBLIC_AGENT_URL}/static/widget.js" />`. The
widget renders in a Shadow DOM (`position: fixed`) so it never affects host
styles or layout. Set `NEXT_PUBLIC_AGENT_URL` per app (e.g.
`https://agent.{domain}`); defaults to `http://localhost:8040` in dev.

## Safety

- **No data-changing action is executed without explicit confirmation** — write
  tools are gated and never auto-runnable from model output.
- CORS allow-list of app origins; `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are
  server-side only and never reach the browser.
- Additive: existing services are untouched except one `<Script>` line per app.
