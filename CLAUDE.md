# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use `bun --bun run`:

```bash
bun --bun run dev          # Start both web (3333) and API (3334)
bun --bun run dev:web      # Vite dev server only
bun --bun run dev:api      # Express API only
bun --bun run typecheck    # tsc --noEmit
bun --bun run lint         # biome check
bun --bun run check        # biome check --write (auto-fix)
bun --bun run test         # vitest (run all tests)
bun --bun run build        # production build

# DB
bun --bun run db:generate  # Drizzle codegen from schema changes
bun --bun run db:migrate   # Apply pending migrations
bun --bun run db:studio    # Drizzle web UI
bun --bun run db:reset     # Wipe and reinitialize SQLite

# Seeds (idempotent)
bun --bun run seed:scenarios
bun --bun run seed:cliproxy     # 11 cliproxy-routed Claude/GPT-5/Gemini entries
bun --bun run seed:openrouter   # 4 OpenRouter entries (gpt-5.4-mini, kimi-k2.6, deepseek-v4-flash, gemma-4-26b)
bun --bun run seed:ollama
```

Run a single test file: `bun --bun run test server/models/resolver.test.ts`

## Architecture

**Thesis Lab** is a research tool for indirect prompt-injection feedback-loop experiments. The attack-defense loop is:

```
Attacker model → RAG retrieval → Defense filtering → Benign model → Evaluators → Feedback → (repeat)
```

### Two-process split

- **Web** (`src/`) — TanStack Start + React 19 + TanStack Router (file-based routes in `src/routes/`). Runs on port 3333. Proxies `/api` and `/socket.io` to port 3334.
- **API** (`server/`) — Express 5 + Socket.IO on port 3334. Bun runtime. Owns experiment execution, SQLite persistence, and real-time updates.

### Key backend files

| File | Role |
|------|------|
| `server/index.ts` | Express routes + Socket.IO handlers |
| `server/engine.ts` | `ExperimentEngine` — orchestrates the feedback loop |
| `server/db.ts` | `ThesisDb` — all SQLite CRUD via Drizzle ORM |
| `server/schema.ts` | Drizzle table definitions |
| `server/prompts/index.ts` | Versioned prompt factories; defaults: `attacker@v6`, `benign@v4`, `judge@v5` |
| `server/models/resolver.ts` | OpenAI-compatible API call builder |

### Key frontend files

| File | Role |
|------|------|
| `src/lib/thesis/schemas.ts` | Zod types for all domain entities (source of truth shared with API) |
| `src/lib/thesis/api.ts` | Fetch-based API client (all calls to `/api/...`) |
| `src/lib/thesis/evaluation.ts` | Client-side rule evaluators (text/regex); LLM judge is server-only |
| `src/lib/thesis/query.ts` | React Query hook factories |
| `src/hooks/use-run-socket.ts` | Socket.IO subscription hook for live run updates |

### Prompt versioning

Prompt modules live in `server/prompts/{attacker,benign,judge}/v*.ts`. To add a new version: create `v{N}.ts`, export from `server/prompts/index.ts`, update the default in the catalog.

### Database

SQLite at `data/thesis-lab.sqlite`. Schema created on API startup (not solely via migrations). When changing the schema: edit `server/schema.ts` → `db:generate` → implement migration → `db:migrate`.

### Model configs

API keys are never stored in SQLite. `ModelConfig.apiKeyEnvVar` is an env var name (e.g. `OPENROUTER_API_KEY`). Keys are read from `.env.local` at runtime. Missing key → deterministic mock responses.

Each `ModelConfig` carries an explicit `provider`: `'cliproxy' | 'openrouter' | 'ollama' | 'openai-compat'`. The provider drives two things:

1. **Reasoning param shape.** `server/models/resolver.ts` branches on provider. `cliproxy` (and `openai-compat`) emit the bare `reasoning_effort` field. `openrouter` emits OpenRouter's unified `reasoning: { effort: 'low' | 'medium' | 'high' }` object — OpenRouter normalizes that to whatever the upstream provider expects (Anthropic thinking, OpenAI reasoning_effort, Gemini thinkingConfig, etc.). The `'minimal'` effort level is OpenAI-only and is omitted entirely for OpenRouter requests.
2. **Request headers.** `openrouter` requests include `HTTP-Referer` and `X-Title` (configurable via `OPENROUTER_REFERER` and `OPENROUTER_APP_NAME` env vars; defaults work locally). The OpenAI client is built via `createOpenAIClient` in `server/model-api.ts` so this stays centralized.

The provider column was added in migration `0001_add_model_provider.sql` and is also auto-added at startup by `addColumnIfMissing` for already-running installs. Existing rows are backfilled from `baseUrl` heuristics.

Catalog (`server/models/catalog.ts`) is the source of truth for per-role tuning. cliproxy entries cover Claude 4.x / GPT-5.x / Gemini 3.x. OpenRouter entries cover `openai/gpt-5.4-mini`, `moonshotai/kimi-k2.6`, `deepseek/deepseek-v4-flash`, and `google/gemma-4-26b-a4b-it` (benign-only — non-reasoning).

### Bulk runs and sweeps

- **Bulk run**: a named group of individual runs, each with the same or varied config.
- **Sweep**: a parameter sweep that creates a bulk run by varying one or more config dimensions (model, defense, etc.).
- Bulk and sweep state lives alongside regular runs in SQLite; `src/routes/bulk-runs/` and `src/routes/sweeps/` handle the UI.
