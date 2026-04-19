import OpenAI from "openai";
import type { ModelConfig } from "../src/lib/thesis/schemas";

export type ModelConnectionResult = {
	ok: boolean;
	status: "connected" | "failed";
	message: string;
	latencyMs: number;
	checkedAt: string;
	sample?: string;
};

export async function testModelConnection(
	model: ModelConfig,
): Promise<ModelConnectionResult> {
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
					content:
						"Connection test. Reply with the exact word READY and no extra text.",
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

function resolveApiKey(model: ModelConfig) {
	const apiKey = process.env[model.apiKeyEnvVar];
	if (apiKey) {
		return apiKey;
	}

	try {
		const url = new URL(model.baseUrl);
		if (
			url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname === "::1"
		) {
			return "ollama";
		}
	} catch {
		return "";
	}

	return "";
}
