import { thesisDb } from "./db";
import { MODEL_CATALOG, type CatalogEntry, type ModelRole } from "./models/catalog";
import type { ModelConfig, ModelConfigInput } from "../src/lib/thesis/schemas";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3334";

function catalogEntryToInput(entry: CatalogEntry): ModelConfigInput {
	// Mirror cliproxy seeding: catalog is the source of truth for per-role params.
	// The DB row's temperature/maxTokens are fallbacks for non-catalog code paths.
	const benign = entry.perRole.benign;
	const roleTags: ModelRole[] = [...entry.allowedRoles];
	return {
		name: entry.displayName,
		baseUrl: entry.baseUrl,
		modelName: entry.modelId,
		apiKeyEnvVar: entry.apiKeyEnvVar,
		temperature: benign.temperature ?? 0.2,
		maxTokens: benign.maxTokens,
		roleTags: [...roleTags, entry.provider, entry.family],
		provider: entry.provider,
	};
}

const OPENROUTER_MODELS = MODEL_CATALOG.filter((entry) => entry.provider === "openrouter").map(
	catalogEntryToInput,
);

await seedOpenRouterModels();

async function seedOpenRouterModels() {
	if (await seedThroughApi()) {
		thesisDb.close();
		return;
	}

	for (const model of OPENROUTER_MODELS) {
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
		if (!modelsResponse.ok) {
			return false;
		}

		const models = (await modelsResponse.json()) as ModelConfig[];

		for (const model of OPENROUTER_MODELS) {
			const existing = findExisting(models, model);
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
