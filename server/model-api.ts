import OpenAI from "openai";
import type { ModelConfig } from "../src/lib/thesis/schemas";

export function resolveApiKey(model: ModelConfig) {
	const apiKey = process.env[model.apiKeyEnvVar];
	if (apiKey) {
		return apiKey;
	}

	try {
		const url = new URL(model.baseUrl);
		if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") {
			return "ollama";
		}
	} catch {
		return "";
	}

	return "";
}

// OpenRouter recommends sending HTTP-Referer and X-Title for analytics + better rate-limit
// pools. Both default to development-friendly values; override via env in production.
function buildOpenRouterHeaders(): Record<string, string> {
	return {
		"HTTP-Referer": process.env.OPENROUTER_REFERER ?? "http://localhost:3333",
		"X-Title": process.env.OPENROUTER_APP_NAME ?? "Thesis Lab",
	};
}

// Construct an OpenAI client tuned for the given ModelConfig. Centralizes per-provider
// concerns (currently: OpenRouter analytics headers) so engine.ts and model-health.ts
// don't each have to reinvent the wiring.
export function createOpenAIClient(
	model: ModelConfig,
	options: { apiKey?: string; timeout?: number } = {},
): OpenAI {
	const apiKey = options.apiKey ?? resolveApiKey(model);
	const defaultHeaders = model.provider === "openrouter" ? buildOpenRouterHeaders() : undefined;
	return new OpenAI({
		apiKey,
		baseURL: model.baseUrl,
		...(defaultHeaders ? { defaultHeaders } : {}),
		...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
	});
}
