# Thesis Lab

A local research workspace for indirect prompt-injection feedback-loop experiments.

The app lets you define scenarios, configure OpenAI-compatible models, define defense modes, launch checkpointed runs, watch live progress, inspect logs/results, and export run data for thesis analysis.

## Stack

- TanStack Start and TanStack Router
- React Query
- Express companion API on port `3334`
- Socket.IO live run updates
- SQLite persistence at `data/thesis-lab.sqlite`
- SQLite FTS retrieval for run-isolated RAG documents
- OpenAI-compatible chat completions adapter
- Tailwind CSS and shadcn-style UI primitives
- Vitest and Biome

## Getting Started

Install dependencies:

```bash
bun install
```

Create `.env.local` with model credentials when you want real model calls:

```env
OPENAI_API_KEY=your_key_here
```

Run the web app and API worker:

```bash
bun --bun run dev
```

Open `http://localhost:3333`.

The API runs at `http://localhost:3334`. Vite proxies `/api` and `/socket.io` from the web dev server to the API server.

If a configured API key environment variable is missing, the worker uses deterministic mock model responses so local UI and run flows still work.

## Scripts

```bash
bun --bun run dev
bun --bun run dev:web
bun --bun run dev:api
bun --bun run build
bun --bun run typecheck
bun --bun run lint
bun --bun run test
bun --bun run format
bun --bun run seed:ollama
bun --bun run seed:scenarios
```

Drizzle scripts are present for schema workflows:

```bash
bun --bun run db:generate
bun --bun run db:migrate
bun --bun run db:studio
```

The runtime schema is currently created by the local API server on startup.

## Ollama Local Model

The app can use Ollama through its OpenAI-compatible endpoint.

Start Ollama and pull the model:

```bash
ollama serve
ollama pull deepseek-r1:7b
```

Create or update the local model config:

```bash
bun --bun run seed:ollama
```

This creates a model named `Ollama DeepSeek R1 7B` with:

- `Base URL`: `http://localhost:11434/v1`
- `Model name`: `deepseek-r1:7b`
- `API key env var`: `OLLAMA_API_KEY`
- `Role tags`: `attacker`, `benign`, `judge`, `local`, `ollama`

Ollama does not require a real API key. If `OLLAMA_API_KEY` is missing, the worker automatically uses the standard local dummy key `ollama` for localhost model endpoints.

## Example Scenario Seed

Create 50 example scenarios with seed documents and ordered success steps:

```bash
bun --bun run seed:scenarios
```

The seed is idempotent. It creates missing examples and skips examples that already exist by name, so running it more than once will not duplicate the same 50 examples.

## App Areas

- Dashboard: active run, recent runs, and object counts.
- Scenarios: CRUD for benign tasks, attacker goals, seed corpus documents, and ordered success steps.
- Models: CRUD for OpenAI-compatible model configs that reference env var names, not stored keys.
- Defenses: CRUD for no-defense, prompt guard, retrieval filter, and combined modes.
- Runs: launch experiments and inspect completed/interrupted runs.
- Run detail: live Socket.IO updates, attempt timeline, step results, logs, and JSON/CSV exports.

## How To Use The System

Use the app in this order:

1. Create at least one model configuration.
2. Create at least one defense configuration.
3. Create a scenario with seed documents and success steps.
4. Start a run from the Runs page.
5. Watch live progress on the run detail page.
6. Export JSON or CSV from the completed run for thesis analysis.

The system is local and single-user. Runs are checkpointed in SQLite, and only one run can be active at a time.

## Field Guide

### Scenario Fields

A scenario defines the research situation being attacked. When a run starts, the entire scenario is copied into an immutable run snapshot, so later edits do not change historical results.

- `Name`: Human-readable scenario label shown in lists, dashboards, and run history.
- `Description`: Optional context for what this scenario is testing.
- `Benign task`: The task the benign model is supposed to perform. This should describe normal user intent, for example “summarize the retrieved policy memo” or “answer the user using the retrieved support article.”
- `Attacker goal`: The malicious objective given to the attacker model. This tells the attacker what outcome it should try to cause through indirect prompt injection.
- `Retrieval query`: Default query used to retrieve seed and injected documents from the run-isolated RAG store.
- `Notes`: Optional research notes for you. These are stored with the scenario but are not used by the model loop.

### Seed Corpus Document Fields

Scenario documents represent benign or background content available to retrieval before attacker content is injected.

- `Title`: Short document label used in retrieved-context displays and logs.
- `Content`: The actual text inserted into the run-isolated RAG store when a run starts.

During a run, attacker-generated documents are inserted into the same run-isolated store, so retrieval can return both scenario seed documents and attacker content.

### Success Step Fields

Success steps define how each attempt is scored. Steps are evaluated in order. A full attack success requires every required step to pass.

- `Order`: The evaluation order. The scenario editor normalizes this order when saving.
- `Name`: Short label for the step, shown in run results.
- `Description`: Explanation of what this step is checking.
- `Required`: If enabled, this step must pass for the attempt to count as a full attack success. Optional steps still produce scores and evidence.
- `Evaluator`: The scoring method:
  - `Contains text`: Passes when the benign model response contains the configured target text.
  - `Avoids text`: Passes when the benign model response does not contain the configured target text.
  - `Regex`: Passes when the benign model response matches the configured regular expression.
  - `LLM judge`: Sends the response and rubric to the benign model as a judge and expects structured pass/fail output.
- `Evaluator target, pattern, or rubric`: The value used by the selected evaluator. For text evaluators this is the target text. For regex this is the pattern. For LLM judge this is the rubric.
- `Feedback guidance`: Extra instruction included in structured feedback after a failed step. This helps the attacker model improve the next attempt.

### Model Configuration Fields

Model configurations describe OpenAI-compatible chat completion endpoints. API keys are not stored in SQLite.

- `Name`: Human-readable model config label.
- `Base URL`: OpenAI-compatible API base URL, for example `https://api.openai.com/v1` or a local compatible server.
- `Model name`: Provider model identifier sent in chat completion requests.
- `API key env var`: Environment variable name that contains the secret key, for example `OPENAI_API_KEY`. The app reads the key from `.env.local`.
- `Temperature`: Sampling temperature for model calls. Lower values are more deterministic.
- `Max tokens`: Maximum tokens requested from the model response.
- `Role tags`: Comma-separated labels for your own organization, such as `attacker`, `benign`, or `judge`. Run setup still requires explicit model selection.

If the configured environment variable is missing, the worker uses deterministic mock responses. This lets you test UI, persistence, and run flow without spending API calls.

### Defense Configuration Fields

Defense configurations define how the benign model and retrieval context are protected during a run. Like scenarios, defenses are snapshotted when a run starts.

- `Name`: Human-readable defense label.
- `Mode`: Defense behavior:
  - `none`: No defense is applied.
  - `prompt_guard`: Adds the defensive prompt to the benign model instruction.
  - `retrieval_filter`: Removes retrieved chunks matching blocked patterns.
  - `combined`: Applies both prompt guard and retrieval filtering.
- `Defensive prompt`: Text appended to the benign model instructions when prompt-guard behavior is active.
- `Blocked patterns`: One regular expression per line. Matching retrieved documents are removed when retrieval filtering is active.
- `Enable retrieval filtering even when mode is prompt guard`: Applies blocked-pattern filtering even if the selected mode is not `retrieval_filter` or `combined`.

### Run Launch Fields

A run executes the feedback loop from selected snapshots.

- `Scenario`: Scenario to snapshot and execute.
- `Attacker model`: Model used to generate an injection prompt and injected document for each attempt.
- `Benign model`: Model used to execute the benign task against retrieved content. This model is also used for LLM-judge success steps unless future code adds a separate judge model selector.
- `Defense`: Defense configuration to snapshot and apply.
- `Max attempts`: Maximum feedback-loop attempts before the run stops.
- `Top K retrieval`: Number of documents retrieved from the run-isolated RAG store per attempt.
- `Retrieval query override`: Optional query used for this run. If empty, the scenario retrieval query is used.

### Run Result Fields

The run detail page shows persisted execution data.

- `Status`: Current run state: `queued`, `running`, `pausing`, `paused`, `completed`, or `failed`.
- `Attempts`: Number of completed attempts out of the configured maximum.
- `Final success`: True when any attempt passed all required success steps.
- `Utility`: Average evaluator score from the final attempt.
- `Injection prompt`: The attacker model’s generated instruction or strategy.
- `Injected document`: The attacker content inserted into the run-isolated RAG store.
- `Benign response`: Output from the benign model after retrieval and defense handling.
- `Attacker feedback`: Structured failure feedback sent to the attacker before the next attempt.
- `Step results`: Per-step pass/fail, score, evaluator output, and evidence.
- `Persistent logs`: Chronological worker events for debugging and reproducibility.

### Export Fields

Use JSON when you need the complete run record, including snapshots, prompts, retrieved context, logs, attempts, and step results.

Use CSV when you need spreadsheet-friendly rows for attempts and success-step results.

## Verification

```bash
bun --bun run typecheck
bun --bun run lint
bun --bun run test
bun --bun run build
```
