import { thesisDb } from "./db";
import type { ModelConfig, ModelConfigInput } from "../src/lib/thesis/schemas";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3334";

const OLLAMA_MODELS: ModelConfigInput[] = [
	{
		name: "Llama 3.2",
		baseUrl: "https://model.ssa.sa/v1",
		modelName: "llama3.2:latest",
		apiKeyEnvVar: "OLLAMA_API_KEY",
		temperature: 0.2,
		maxTokens: 2000,
		roleTags: ["attacker", "benign", "judge", "ssa", "ollama"],
	},
	{
		name: "Qwen3 Coder 30B",
		baseUrl: "https://model.ssa.sa/v1",
		modelName: "qwen3-coder:30b",
		apiKeyEnvVar: "OLLAMA_API_KEY",
		temperature: 0.2,
		maxTokens: 2000,
		roleTags: ["attacker", "benign", "judge", "ssa", "ollama"],
	},
];

await seedOllamaModel();

async function seedOllamaModel() {
	if (await seedThroughApi()) {
		thesisDb.close();
		return;
	}

	for (const ollamaModel of OLLAMA_MODELS) {
		const existing = findExisting(thesisDb.listModels(), ollamaModel);

		if (existing) {
			thesisDb.updateModel(existing.id, ollamaModel);
			console.log(`Updated model config directly in SQLite: ${ollamaModel.name}`);
		} else {
			thesisDb.createModel(ollamaModel);
			console.log(`Created model config directly in SQLite: ${ollamaModel.name}`);
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
			OLLAMA_MODELS.map(async (ollamaModel) => {
				const existing = findExisting(models, ollamaModel);
				const response = await fetch(
					existing ? `${API_BASE_URL}/api/models/${existing.id}` : `${API_BASE_URL}/api/models`,
					{
						method: existing ? "PUT" : "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(ollamaModel),
					},
				);

				if (!response.ok) {
					throw new Error(await response.text());
				}

				console.log(`${existing ? "Updated" : "Created"} model config through API: ${ollamaModel.name}`);
			}),
		);
		return true;
	} catch {
		return false;
	}
}

function findExisting(models: ModelConfig[], ollamaModel: ModelConfigInput) {
	return models.find(
		(model) =>
			model.name === ollamaModel.name || model.modelName === ollamaModel.modelName,
	);
}
