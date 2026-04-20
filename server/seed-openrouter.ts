import { thesisDb } from "./db";
import type { ModelConfig, ModelConfigInput } from "../src/lib/thesis/schemas";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3334";

const OPENROUTER_MODELS: ModelConfigInput[] = [
	{
		name: "GPT OSS 120B",
		baseUrl: "https://openrouter.ai/api/v1",
		modelName: "openai/gpt-oss-120b:free",
		apiKeyEnvVar: "OPENROUTER_API_KEY",
		temperature: 0.2,
		maxTokens: 2000,
		roleTags: ["attacker", "benign", "judge", "openrouter", "free"],
	},
];

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

		await Promise.all(
			OPENROUTER_MODELS.map(async (model) => {
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
					throw new Error(await response.text());
				}

				console.log(`${existing ? "Updated" : "Created"} model config through API: ${model.name}`);
			}),
		);
		return true;
	} catch {
		return false;
	}
}

function findExisting(models: ModelConfig[], candidate: ModelConfigInput) {
	return models.find((model) => model.name === candidate.name || model.modelName === candidate.modelName);
}
