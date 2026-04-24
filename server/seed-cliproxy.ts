import { thesisDb } from "./db";
import type { ModelConfig, ModelConfigInput } from "../src/lib/thesis/schemas";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3334";
const CLIPROXY_BASE_URL = process.env.CLIPROXY_BASE_URL ?? "http://localhost:8317/v1";
const CLIPROXY_ENV_VAR = "CLIPROXY_API_KEY";

// Mirrors cliproxyapi's /v1/models response (id, owner, created) as of April 2026.
// Each entry becomes one ModelConfig row pointing at the local cliproxy instance.
const CLIPROXY_MODELS: Array<{ id: string; owner: string; humanName?: string }> = [
	// Anthropic
	{ id: "claude-opus-4-7", owner: "anthropic", humanName: "Claude Opus 4.7" },
	{ id: "claude-sonnet-4-6", owner: "anthropic", humanName: "Claude Sonnet 4.6" },
	{ id: "claude-haiku-4-5-20251001", owner: "anthropic", humanName: "Claude Haiku 4.5" },
	// OpenAI
	{ id: "gpt-5.4", owner: "openai", humanName: "GPT-5.4" },
	{ id: "gpt-5.4-mini", owner: "openai", humanName: "GPT-5.4 mini" },
	{ id: "gpt-5.3-codex", owner: "openai", humanName: "GPT-5.3 Codex" },
	// Google
	{ id: "gemini-3-pro-preview", owner: "google", humanName: "Gemini 3 Pro" },
	{ id: "gemini-3-flash-preview", owner: "google", humanName: "Gemini 3 Flash" },
	{ id: "gemini-2.5-flash", owner: "google", humanName: "Gemini 2.5 Flash" },
];

function toModelConfigInput(entry: (typeof CLIPROXY_MODELS)[number]): ModelConfigInput {
	const displayName = entry.humanName ?? entry.id;
	// Bigger output budget for flagship frontier models, smaller for flash/mini.
	const isFlash = /flash|haiku|mini|lite|image/i.test(entry.id);
	return {
		name: `${displayName}`,
		baseUrl: CLIPROXY_BASE_URL,
		modelName: entry.id,
		apiKeyEnvVar: CLIPROXY_ENV_VAR,
		temperature: 0.2,
		maxTokens: isFlash ? 2000 : 4000,
		roleTags: ["attacker", "benign", "judge", "cliproxy", entry.owner],
	};
}

const MODELS = CLIPROXY_MODELS.map(toModelConfigInput);

await seedCliProxyModels();

async function seedCliProxyModels() {
	if (await seedThroughApi()) {
		thesisDb.close();
		return;
	}

	for (const model of MODELS) {
		const existing = findExisting(thesisDb.listModels(), model);
		if (existing) {
			thesisDb.updateModel(existing.id, model);
			console.log(`Updated model config directly in SQLite: ${model.name}`);
		} else {
			thesisDb.createModel(model);
			console.log(`Created model config directly in SQLite: ${model.name}`);
		}
	}

	thesisDb.close();
}

async function seedThroughApi() {
	try {
		const modelsResponse = await fetch(`${API_BASE_URL}/api/models`);
		if (!modelsResponse.ok) return false;
		const existingModels = (await modelsResponse.json()) as ModelConfig[];

		for (const model of MODELS) {
			const existing = findExisting(existingModels, model);
			const response = await fetch(
				existing ? `${API_BASE_URL}/api/models/${existing.id}` : `${API_BASE_URL}/api/models`,
				{
					method: existing ? "PUT" : "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(model),
				},
			);
			if (!response.ok) {
				throw new Error(`${model.name}: ${await response.text()}`);
			}
			console.log(`${existing ? "Updated" : "Created"} ${model.name}`);
		}
		return true;
	} catch (error) {
		console.warn("API seeding failed, falling back to direct DB writes:", error);
		return false;
	}
}

function findExisting(models: ModelConfig[], candidate: ModelConfigInput) {
	return models.find(
		(model) =>
			model.name === candidate.name ||
			(model.baseUrl === candidate.baseUrl && model.modelName === candidate.modelName),
	);
}
