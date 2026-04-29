// Typed catalog of every model this research harness knows how to drive.
// Single source of truth: per-role defaults live here, not scattered across the engine.
// Routes through cliproxy (local) and OpenRouter (cloud) — both OpenAI Chat Completions surface.
// Guidance derived from ai-sdk.dev/cookbook/guides for each family.

export type ModelRole = "attacker" | "benign" | "judge";
export type ModelFamily = "anthropic" | "openai" | "google" | "moonshot" | "deepseek" | "open";
export type ModelProvider = "cliproxy" | "openrouter" | "ollama" | "openai-compat";

export type RoleParams = {
	temperature?: number; // omit for GPT-5 reasoning models (rejected)
	maxTokens: number;
	reasoningEffort?: "minimal" | "low" | "medium" | "high";
	verbosity?: "low" | "medium" | "high"; // GPT-5 only
	// Frequency penalty (-2.0..2.0) pushes the model away from repeating its own prior wording.
	// The attacker loop feeds prior injection documents back into the prompt; without a penalty,
	// attempts 2-N tend to rehash attempt 1's phrasing, which kills cross-attempt learning.
	// Set on attacker only — judge and benign want stable, reproducible outputs.
	frequencyPenalty?: number;
};

export type CatalogEntry = {
	key: string; // stable catalog key (cliproxy: matches modelId; openrouter: namespaced "openrouter/<slug>")
	displayName: string;
	modelId: string; // wire model id sent to the upstream API
	family: ModelFamily;
	provider: ModelProvider;
	baseUrl: string;
	apiKeyEnvVar: "CLIPROXY_API_KEY" | "OPENROUTER_API_KEY" | "OLLAMA_API_KEY" | "OPENAI_API_KEY";
	allowedRoles: readonly ModelRole[];
	perRole: Record<ModelRole, RoleParams>;
	capabilities: {
		acceptsTemperature: boolean;
		acceptsMaxTokens: boolean; // false → API expects max_completion_tokens
		toolCalls: boolean;
	};
};

const CLIPROXY_BASE_URL = "http://localhost:8317/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OLLAMA_SSA_BASE_URL = "https://model.ssa.sa/v1";

// ── Claude 4.x ────────────────────────────────────────────────────────────
// Reasoning models: extended thinking activated via reasoning_effort=high.
// Temperature still honored on Claude 4.x (not GPT-5 style); keep a low default for benign.
function claudePerRole(attackerMax: number, benignMax: number, judgeMax: number): Record<ModelRole, RoleParams> {
	return {
		attacker: { maxTokens: attackerMax, reasoningEffort: "medium", frequencyPenalty: 0.7 },
		benign: { temperature: 0.2, maxTokens: benignMax ,frequencyPenalty: 1},
		judge: { maxTokens: judgeMax, reasoningEffort: "low", frequencyPenalty: 1 },
	};
}

// ── GPT-5.x ───────────────────────────────────────────────────────────────
// Reasoning models: reject temperature. Use reasoning_effort + verbosity instead.
function gpt5PerRole(attackerMax: number, benignMax: number, judgeMax: number): Record<ModelRole, RoleParams> {
	return {
		attacker: { maxTokens: attackerMax, reasoningEffort: "medium", verbosity: "medium", frequencyPenalty: 0.7 },
		benign: { maxTokens: benignMax, verbosity: "low",frequencyPenalty: 1 },
		judge: { maxTokens: judgeMax, reasoningEffort: "low", verbosity: "low" ,frequencyPenalty: 1},
	};
}

// ── Gemini 3.x / 2.5.x ────────────────────────────────────────────────────
// Accepts temperature; reasoning_effort passed through by cliproxy.
function geminiPerRole(
	attackerMax: number,
	benignMax: number,
	judgeMax: number,
	benignEffort?: RoleParams["reasoningEffort"],
): Record<ModelRole, RoleParams> {
	return {
		attacker: { temperature: 0.8, maxTokens: attackerMax, reasoningEffort: "medium", frequencyPenalty: 0.7 },
		benign: { temperature: 0.2, frequencyPenalty: 1, maxTokens: benignMax, ...(benignEffort ? { reasoningEffort: benignEffort } : {}) },
		judge: { temperature: 0.2, maxTokens: judgeMax, reasoningEffort: "low", frequencyPenalty: 1 },
	};
}

// ── OpenRouter helpers ────────────────────────────────────────────────────
// OpenRouter exposes a unified `reasoning: { effort: 'low'|'medium'|'high' }` object that
// it normalizes per upstream provider (Anthropic thinking, OpenAI reasoning_effort, Gemini
// thinkingConfig, etc.). The resolver translates `reasoningEffort` → that shape for OR.
// 'minimal' is mapped to "omit" since OR's enum is low/medium/high.
// Verbosity is OpenAI-only and not exposed via OpenRouter — drop it for OR entries.

export const MODEL_CATALOG: readonly CatalogEntry[] = [
	// Anthropic
	{
		key: "claude-opus-4-7",
		displayName: "Claude Opus 4.7",
		modelId: "claude-opus-4-7",
		family: "anthropic",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		// Opus is the most expensive and a poor stand-in for a realistic end user — attacker/judge only.
		allowedRoles: ["attacker", "judge"],
		perRole: claudePerRole(6000, 4000, 2000),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},
	{
		key: "claude-sonnet-4-6",
		displayName: "Claude Sonnet 4.6",
		modelId: "claude-sonnet-4-6",
		family: "anthropic",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: claudePerRole(4000, 4000, 2000),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},
	{
		key: "claude-haiku-4-5-20251001",
		displayName: "Claude Haiku 4.5",
		modelId: "claude-haiku-4-5-20251001",
		family: "anthropic",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: claudePerRole(2500, 2000, 1500),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},

	// OpenAI GPT-5.x
	{
		key: "gpt-5.5",
		displayName: "GPT-5.5",
		modelId: "gpt-5.5",
		family: "openai",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker"], // flagship attacker only (matches manual config)
		perRole: gpt5PerRole(6000, 2000, 2000),
		capabilities: { acceptsTemperature: false, acceptsMaxTokens: false, toolCalls: true },
	},
	{
		key: "gpt-5.4",
		displayName: "GPT-5.4",
		modelId: "gpt-5.4",
		family: "openai",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: gpt5PerRole(4000, 2000, 1500),
		capabilities: { acceptsTemperature: false, acceptsMaxTokens: false, toolCalls: true },
	},
	{
		key: "gpt-5.4-mini",
		displayName: "GPT-5.4 mini",
		modelId: "gpt-5.4-mini",
		family: "openai",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: gpt5PerRole(2500, 2000, 1500),
		capabilities: { acceptsTemperature: false, acceptsMaxTokens: false, toolCalls: true },
	},
	{
		key: "gpt-5.3-codex",
		displayName: "GPT-5.3 Codex",
		modelId: "gpt-5.3-codex",
		family: "openai",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: gpt5PerRole(4000, 2000, 1500),
		capabilities: { acceptsTemperature: false, acceptsMaxTokens: false, toolCalls: true },
	},

	// Google Gemini
	{
		key: "gemini-3-pro-preview",
		displayName: "Gemini 3 Pro",
		modelId: "gemini-3-pro-preview",
		family: "google",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: geminiPerRole(4000, 2000, 1500),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},
	{
		key: "gemini-3-flash-preview",
		displayName: "Gemini 3 Flash",
		modelId: "gemini-3-flash-preview",
		family: "google",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		// Flash supports a "minimal" effort level — use it for benign to cut latency.
		perRole: geminiPerRole(2500, 2000, 1500, "minimal"),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},
	{
		key: "gemini-2.5-flash",
		displayName: "Gemini 2.5 Flash",
		modelId: "gemini-2.5-flash",
		family: "google",
		provider: "cliproxy",
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: geminiPerRole(2500, 2000, 1500),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},

	// ── OpenRouter ────────────────────────────────────────────────────────
	// GPT-5.4 mini via OpenRouter — same family rules as the cliproxy GPT-5 line:
	// reasoning model, rejects temperature, OR translates max_tokens upstream.
	{
		key: "openrouter/openai/gpt-5.4-mini",
		displayName: "GPT-5.4 mini (OpenRouter)",
		modelId: "openai/gpt-5.4-mini",
		family: "openai",
		provider: "openrouter",
		baseUrl: OPENROUTER_BASE_URL,
		apiKeyEnvVar: "OPENROUTER_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: {
			attacker: { maxTokens: 4000, reasoningEffort: "high", frequencyPenalty: 0.7 },
			benign: { maxTokens: 2000, frequencyPenalty: 1 },
			judge: { maxTokens: 1500, reasoningEffort: "medium", frequencyPenalty: 1 },
		},
		// OpenRouter accepts max_tokens for GPT-5 (it forwards as max_completion_tokens upstream).
		capabilities: { acceptsTemperature: false, acceptsMaxTokens: true, toolCalls: true },
	},
	// Kimi K2.6 (Moonshot) — long-context Chinese frontier model. Strong attacker / judge.
	{
		key: "openrouter/moonshotai/kimi-k2.6",
		displayName: "Kimi K2.6 (OpenRouter)",
		modelId: "moonshotai/kimi-k2.6",
		family: "moonshot",
		provider: "openrouter",
		baseUrl: OPENROUTER_BASE_URL,
		apiKeyEnvVar: "OPENROUTER_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: {
			attacker: { temperature: 0.8, maxTokens: 4000, reasoningEffort: "high", frequencyPenalty: 0.7 },
			benign: { temperature: 0.3, maxTokens: 2000, frequencyPenalty: 1 },
			judge: { temperature: 0.2, maxTokens: 1500, reasoningEffort: "medium", frequencyPenalty: 1 },
		},
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},
	// DeepSeek V4 Flash — fast/cheap reasoning model; low-effort defaults for benign/judge.
	{
		key: "openrouter/deepseek/deepseek-v4-flash",
		displayName: "DeepSeek V4 Flash (OpenRouter)",
		modelId: "deepseek/deepseek-v4-flash",
		family: "deepseek",
		provider: "openrouter",
		baseUrl: OPENROUTER_BASE_URL,
		apiKeyEnvVar: "OPENROUTER_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: {
			attacker: { temperature: 0.7, maxTokens: 3000, reasoningEffort: "medium", frequencyPenalty: 0.7 },
			benign: { temperature: 0.3, maxTokens: 2000, frequencyPenalty: 1 },
			judge: { temperature: 0.2, maxTokens: 1500, reasoningEffort: "low", frequencyPenalty: 1 },
		},
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
	},
	// Gemma 4 26B (a4b instruct) — open-weight, no extended reasoning. Benign role only.
	// reasoningEffort omitted entirely — OR will pass nothing for the reasoning field.
	{
		key: "openrouter/google/gemma-4-26b-a4b-it",
		displayName: "Gemma 4 26B (OpenRouter)",
		modelId: "google/gemma-4-26b-a4b-it",
		family: "google",
		provider: "openrouter",
		baseUrl: OPENROUTER_BASE_URL,
		apiKeyEnvVar: "OPENROUTER_API_KEY",
		// Non-reasoning: pin to benign so it isn't accidentally selected for attacker/judge.
		allowedRoles: ["benign"],
		perRole: {
			attacker: { temperature: 0.7, maxTokens: 3000, frequencyPenalty: 0.7 },
			benign: { temperature: 0.3, maxTokens: 2000, frequencyPenalty: 1 },
			judge: { temperature: 0.2, maxTokens: 1500, frequencyPenalty: 1 },
		},
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: false },
	},

	// ── Ollama (open-weight, hosted at SSA endpoint) ──────────────────────
	// These models mode-collapse on creative red-team tasks at low temperature. The catalog
	// pushes attacker temperature high (0.95) and stacks frequency_penalty (1.2) to force
	// surface diversity across attempts — observed regression in run_e12abffb (qwen3-coder
	// reproducing the same email template across 9 attempts at temp=0.2).
	{
		key: "ollama/qwen3-coder-30b",
		displayName: "Qwen3 Coder 30B",
		modelId: "qwen3-coder:30b",
		family: "open",
		provider: "ollama",
		baseUrl: OLLAMA_SSA_BASE_URL,
		apiKeyEnvVar: "OLLAMA_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: {
			// Attacker: aggressive diversification. Coder model anchors hard at low temp.
			attacker: { temperature: 0.95, maxTokens: 4000, frequencyPenalty: 1.2 },
			benign: { temperature: 0.2, maxTokens: 2000, frequencyPenalty: 1 },
			// Judge: deterministic, no penalties — we want stable verdicts.
			judge: { temperature: 0.0, maxTokens: 1500 },
		},
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: false },
	},
	{
		key: "ollama/llama-3.2",
		displayName: "Llama 3.2",
		modelId: "llama3.2:latest",
		family: "open",
		provider: "ollama",
		baseUrl: OLLAMA_SSA_BASE_URL,
		apiKeyEnvVar: "OLLAMA_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: {
			attacker: { temperature: 0.95, maxTokens: 4000, frequencyPenalty: 1.2 },
			benign: { temperature: 0.2, maxTokens: 2000, frequencyPenalty: 1 },
			judge: { temperature: 0.0, maxTokens: 1500 },
		},
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: false },
	},
] as const;

const CATALOG_BY_KEY = new Map(MODEL_CATALOG.map((entry) => [entry.key, entry]));
const CATALOG_BY_MODEL_ID = new Map(MODEL_CATALOG.map((entry) => [entry.modelId, entry]));

export function getCatalogEntry(key: string): CatalogEntry | undefined {
	return CATALOG_BY_KEY.get(key);
}

// Engine callsites only know the wire modelId (from the DB row). Give them a lookup too.
export function getCatalogEntryByModelId(modelId: string): CatalogEntry | undefined {
	return CATALOG_BY_MODEL_ID.get(modelId);
}
