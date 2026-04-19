import OpenAI from "openai";
import type { ModelConfig, ModelConnectionResult } from "../src/lib/thesis/schemas";
import { resolveApiKey } from "./model-api";

export async function testModelConnection(model: ModelConfig): Promise<ModelConnectionResult> {
	const startedAt = Date.now();
	const checkedAt = new Date().toISOString();
	const apiKey = resolveApiKey(model);

	if (!apiKey) {
		return {
			ok: false,
			status: "failed",
			message: `Missing API key environment variable: ${model.apiKeyEnvVar}`,
			latencyMs: Date.now() - startedAt,
			checkedAt,
		};
	}

	try {
		const client = new OpenAI({
			apiKey,
			baseURL: model.baseUrl,
			timeout: 30_000,
		});
		const response = await client.chat.completions.create({
			model: model.modelName,
			temperature: 0,
			max_tokens: 32,
			messages: [
				{
					role: "user",
					content: "Connection test. Reply with the exact word READY and no extra text.",
				},
			],
		});
		const sample = response.choices[0]?.message.content?.trim() ?? "";

		return {
			ok: true,
			status: "connected",
			message: sample ? "Model responded successfully." : "Model returned an empty response.",
			latencyMs: Date.now() - startedAt,
			checkedAt,
			sample,
		};
	} catch (error) {
		return {
			ok: false,
			status: "failed",
			message: error instanceof Error ? error.message : "Model connection failed.",
			latencyMs: Date.now() - startedAt,
			checkedAt,
		};
	}
}
