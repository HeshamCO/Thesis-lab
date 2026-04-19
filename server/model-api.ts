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
