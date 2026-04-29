import type { ModelConfig, ModelConnectionResult } from "../src/lib/thesis/schemas";
import { createOpenAIClient, resolveApiKey } from "./model-api";

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
		const client = createOpenAIClient(model, { apiKey, timeout: 30_000 });
		const baseBody = {
			model: model.modelName,
			temperature: 0,
			max_tokens: 32,
			messages: [
				{
					role: "user" as const,
					content: "Connection test. Reply with the exact word READY and no extra text.",
				},
			],
		};
		let response;
		try {
			response = await client.chat.completions.create(baseBody);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			const retryBody: Record<string, unknown> = { ...baseBody };
			let changed = false;
			if (/temperature/i.test(message) && "temperature" in retryBody) {
				delete retryBody.temperature;
				changed = true;
			}
			if (/max[_ ]tokens/i.test(message) && "max_tokens" in retryBody) {
				retryBody.max_completion_tokens = retryBody.max_tokens;
				delete retryBody.max_tokens;
				changed = true;
			}
			if (!changed) throw error;
			response = await client.chat.completions.create(retryBody as never);
		}
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
