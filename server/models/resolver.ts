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
		// hand-rolled OpenAI-compatible entries that haven't been promoted to MODEL_CATALOG).
		// HOWEVER: a silent temp=0.2 for the attacker role causes mode-collapse on adaptive
		// runs (see run_e12abffb). Hard-floor attacker diversity here so unknown models don't
		// silently fail open. Catalog entries override this; this is just the safety net.
		const body: Record<string, unknown> = {};
		if (role === "attacker") {
			const t = Math.max(fallback.temperature ?? 0.2, 0.8);
			body.temperature = t;
			body.frequency_penalty = 0.8;
		} else if (fallback.temperature !== undefined) {
			body.temperature = fallback.temperature;
		}
		if (fallback.maxTokens !== undefined) body.max_tokens = fallback.maxTokens;
		return { body };
	}

	const params = entry.perRole[role];
	const body: Record<string, unknown> = {};

	// Token limit: known-key differs per family (GPT-5 rejects max_tokens) — but on
	// OpenRouter even GPT-5 accepts max_tokens because OR translates it upstream.
	if (entry.capabilities.acceptsMaxTokens) {
		body.max_tokens = params.maxTokens;
	} else {
		body.max_completion_tokens = params.maxTokens;
	}

	if (entry.capabilities.acceptsTemperature && params.temperature !== undefined) {
		body.temperature = params.temperature;
	}

	// Reasoning param shape differs by provider. OpenRouter exposes a unified
	// `reasoning: { effort }` object that it translates per upstream provider.
	// 'minimal' is OpenAI-only — for OpenRouter we omit the field entirely (OR's
	// effort enum is low|medium|high).
	if (entry.provider === "openrouter") {
		if (params.reasoningEffort && params.reasoningEffort !== "minimal") {
			body.reasoning = { effort: params.reasoningEffort };
		}
		// `verbosity` is OpenAI-Chat-Completions-only; OR doesn't forward it. Skip.
	} else {
		if (params.reasoningEffort) body.reasoning_effort = params.reasoningEffort;
		if (params.verbosity) body.verbosity = params.verbosity;
	}

	if (typeof params.frequencyPenalty === "number") body.frequency_penalty = params.frequencyPenalty;

	return { body };
}
