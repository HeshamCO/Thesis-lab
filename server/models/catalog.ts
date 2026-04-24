// Typed catalog of every model this research harness knows how to drive.
// Single source of truth: per-role defaults live here, not scattered across the engine.
// All entries route through the local cliproxy instance (OpenAI Chat Completions surface).
// Guidance derived from ai-sdk.dev/cookbook/guides for each family.

export type ModelRole = "attacker" | "benign" | "judge";
export type ModelFamily = "anthropic" | "openai" | "google";

export type RoleParams = {
	temperature?: number; // omit for GPT-5 reasoning models (rejected)
	maxTokens: number;
	reasoningEffort?: "minimal" | "low" | "medium" | "high";
	verbosity?: "low" | "medium" | "high"; // GPT-5 only
};

export type CatalogEntry = {
	key: string; // stable catalog key, also the wire modelId (they match 1:1 today)
	displayName: string;
	modelId: string;
	family: ModelFamily;
	baseUrl: string;
	apiKeyEnvVar: "CLIPROXY_API_KEY";
	allowedRoles: readonly ModelRole[];
	perRole: Record<ModelRole, RoleParams>;
	capabilities: {
		acceptsTemperature: boolean;
		acceptsMaxTokens: boolean; // false → API expects max_completion_tokens
		toolCalls: boolean;
	};
};

const CLIPROXY_BASE_URL = "http://localhost:8317/v1";

// ── Claude 4.x ────────────────────────────────────────────────────────────
// Reasoning models: extended thinking activated via reasoning_effort=high.
// Temperature still honored on Claude 4.x (not GPT-5 style); keep a low default for benign.
function claudePerRole(attackerMax: number, benignMax: number, judgeMax: number): Record<ModelRole, RoleParams> {
	return {
		attacker: { maxTokens: attackerMax, reasoningEffort: "low" },
		benign: { temperature: 0.2, maxTokens: benignMax },
		judge: { maxTokens: judgeMax, reasoningEffort: "low" },
	};
}

// ── GPT-5.x ───────────────────────────────────────────────────────────────
// Reasoning models: reject temperature. Use reasoning_effort + verbosity instead.
function gpt5PerRole(attackerMax: number, benignMax: number, judgeMax: number): Record<ModelRole, RoleParams> {
	return {
		attacker: { maxTokens: attackerMax, reasoningEffort: "low", verbosity: "medium" },
		benign: { maxTokens: benignMax, verbosity: "low" },
		judge: { maxTokens: judgeMax, reasoningEffort: "low", verbosity: "low" },
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
		attacker: { temperature: 0.8, maxTokens: attackerMax, reasoningEffort: "low" },
		benign: { temperature: 0.2, maxTokens: benignMax, ...(benignEffort ? { reasoningEffort: benignEffort } : {}) },
		judge: { temperature: 0.2, maxTokens: judgeMax, reasoningEffort: "low" },
	};
}

export const MODEL_CATALOG: readonly CatalogEntry[] = [
	// Anthropic
	{
		key: "claude-opus-4-7",
		displayName: "Claude Opus 4.7",
		modelId: "claude-opus-4-7",
		family: "anthropic",
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
		baseUrl: CLIPROXY_BASE_URL,
		apiKeyEnvVar: "CLIPROXY_API_KEY",
		allowedRoles: ["attacker", "benign", "judge"],
		perRole: geminiPerRole(2500, 2000, 1500),
		capabilities: { acceptsTemperature: true, acceptsMaxTokens: true, toolCalls: true },
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
