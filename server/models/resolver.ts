import { getCatalogEntryByModelId, type ModelRole } from "./catalog";

// Body fragment spread into client.chat.completions.create(). The engine's 400-fallback
// wrapper stays as a safety net but should rarely fire now that we pre-filter per
// family capability flags.
export type ResolvedCallParams = {
	body: Record<string, unknown>;
};

// Resolve per-call body knobs for a given (modelId, role). Unknown model → fall back to the
// DB row's own temperature/maxTokens at the callsite (caller passes them as `fallback`).
export function resolveCallParams(
	modelId: string,
	role: ModelRole,
	fallback: { temperature?: number; maxTokens?: number },
): ResolvedCallParams {
	const entry = getCatalogEntryByModelId(modelId);

	if (!entry) {
		// Not in the curated catalog — honor whatever the DB row asked for (used by
		// legacy openrouter/ollama seeders). No family-specific extras.
		const body: Record<string, unknown> = {};
		if (fallback.temperature !== undefined) body.temperature = fallback.temperature;
		if (fallback.maxTokens !== undefined) body.max_tokens = fallback.maxTokens;
		return { body };
	}

	const params = entry.perRole[role];
	const body: Record<string, unknown> = {};

	// Token limit: known-key differs per family (GPT-5 rejects max_tokens).
	if (entry.capabilities.acceptsMaxTokens) {
		body.max_tokens = params.maxTokens;
	} else {
		body.max_completion_tokens = params.maxTokens;
	}

	if (entry.capabilities.acceptsTemperature && params.temperature !== undefined) {
		body.temperature = params.temperature;
	}

	if (params.reasoningEffort) body.reasoning_effort = params.reasoningEffort;
	if (params.verbosity) body.verbosity = params.verbosity;

	return { body };
}
