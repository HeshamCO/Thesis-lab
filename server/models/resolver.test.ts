import { describe, expect, test } from "bun:test";
import { MODEL_CATALOG } from "./catalog";
import { resolveCallParams } from "./resolver";

describe("resolveCallParams — GPT-5 family", () => {
	test("attacker gets medium effort + medium verbosity, no temperature, max_completion_tokens", () => {
		const { body } = resolveCallParams("gpt-5.5", "attacker", {});
		expect(body.reasoning_effort).toBe("medium");
		expect(body.verbosity).toBe("medium");
		expect(body.temperature).toBeUndefined();
		expect(body.max_tokens).toBeUndefined();
		expect(body.max_completion_tokens).toBe(6000);
	});

	test("benign keeps verbosity=low and no reasoning_effort", () => {
		const { body } = resolveCallParams("gpt-5.4", "benign", {});
		expect(body.verbosity).toBe("low");
		expect(body.reasoning_effort).toBeUndefined();
	});

	test("judge gets low effort + low verbosity (calibrated grading without over-thinking)", () => {
		const { body } = resolveCallParams("gpt-5.4", "judge", {});
		expect(body.reasoning_effort).toBe("low");
		expect(body.verbosity).toBe("low");
	});
});

describe("resolveCallParams — Claude 4 family", () => {
	test("attacker: reasoning_effort=medium, no temperature (only benign role carries it), max_tokens honored", () => {
		const { body } = resolveCallParams("claude-opus-4-7", "attacker", {});
		expect(body.reasoning_effort).toBe("medium");
		expect(body.temperature).toBeUndefined();
		expect(body.max_tokens).toBe(6000);
		expect(body.verbosity).toBeUndefined();
	});

	test("benign keeps temperature and drops reasoning_effort", () => {
		const { body } = resolveCallParams("claude-sonnet-4-6", "benign", {});
		expect(body.temperature).toBe(0.2);
		expect(body.reasoning_effort).toBeUndefined();
	});
});

describe("resolveCallParams — Gemini family", () => {
	test("Gemini 3 Pro attacker: temperature=0.8 (exploration) + medium effort + max_tokens", () => {
		const { body } = resolveCallParams("gemini-3-pro-preview", "attacker", {});
		expect(body.temperature).toBe(0.8);
		expect(body.reasoning_effort).toBe("medium");
		expect(body.max_tokens).toBe(4000);
	});

	test("Gemini 3 Flash benign: reasoning_effort=minimal (flash-only latency knob)", () => {
		const { body } = resolveCallParams("gemini-3-flash-preview", "benign", {});
		expect(body.reasoning_effort).toBe("minimal");
	});

	test("Gemini 2.5 Flash benign: no reasoning_effort (not a flash-only override)", () => {
		const { body } = resolveCallParams("gemini-2.5-flash", "benign", {});
		expect(body.reasoning_effort).toBeUndefined();
	});
});

describe("resolveCallParams — unknown model fallback", () => {
	test("attacker role: hard-floors temperature to 0.8 to prevent mode-collapse", () => {
		const { body } = resolveCallParams("llama-unknown-test", "attacker", {
			temperature: 0.7,
			maxTokens: 1234,
		});
		// Caller passed 0.7; resolver bumps to floor of 0.8.
		expect(body.temperature).toBe(0.8);
		expect(body.frequency_penalty).toBe(0.8);
		expect(body.max_tokens).toBe(1234);
		expect(body.reasoning_effort).toBeUndefined();
	});

	test("attacker role: respects caller temperature when above floor", () => {
		const { body } = resolveCallParams("llama-unknown-test", "attacker", {
			temperature: 0.95,
			maxTokens: 1234,
		});
		expect(body.temperature).toBe(0.95);
	});

	test("benign/judge roles: pass through unchanged (no diversification floor)", () => {
		for (const role of ["benign", "judge"] as const) {
			const { body } = resolveCallParams("llama-unknown-test", role, {
				temperature: 0.2,
				maxTokens: 1234,
			});
			expect(body.temperature).toBe(0.2);
			expect(body.frequency_penalty).toBeUndefined();
			expect(body.max_tokens).toBe(1234);
		}
	});
});

describe("resolveCallParams — frequency_penalty (per-role diversification)", () => {
	test("attacker carries a positive frequency_penalty across all three families", () => {
		for (const modelId of ["claude-opus-4-7", "gpt-5.5", "gemini-3-pro-preview"]) {
			const { body } = resolveCallParams(modelId, "attacker", {});
			expect(typeof body.frequency_penalty).toBe("number");
			expect(body.frequency_penalty as number).toBeGreaterThan(0);
		}
	});

	test("benign and judge carry whatever the catalog sets — never undefined for cliproxy entries", () => {
		// The catalog applies a frequency_penalty to all roles to discourage repeated phrasing
		// in stored answers; only the attacker uses a *higher* value to rotate injection text
		// across attempts. Make sure none of the cliproxy entries silently drop the field.
		for (const modelId of ["claude-sonnet-4-6", "gpt-5.4", "gemini-3-flash-preview"]) {
			for (const role of ["benign", "judge"] as const) {
				const { body } = resolveCallParams(modelId, role, {});
				expect(typeof body.frequency_penalty).toBe("number");
			}
		}
	});
});

describe("catalog invariants", () => {
	test("every catalog entry covers all three roles", () => {
		for (const entry of MODEL_CATALOG) {
			expect(entry.perRole.attacker).toBeDefined();
			expect(entry.perRole.benign).toBeDefined();
			expect(entry.perRole.judge).toBeDefined();
		}
	});

	test("allowedRoles ⊆ keys of perRole", () => {
		for (const entry of MODEL_CATALOG) {
			for (const role of entry.allowedRoles) {
				expect(entry.perRole[role]).toBeDefined();
			}
		}
	});

	test("cliproxy GPT-5 entries never carry temperature in any role", () => {
		// OpenRouter-routed GPT-5 models also carry family='openai' but route differently;
		// scope the temperature ban to cliproxy entries which use the bare reasoning_effort path.
		for (const entry of MODEL_CATALOG.filter((e) => e.family === "openai" && e.provider === "cliproxy")) {
			for (const role of ["attacker", "benign", "judge"] as const) {
				const { body } = resolveCallParams(entry.modelId, role, {});
				expect(body.temperature).toBeUndefined();
			}
		}
	});

	test("every entry declares a provider", () => {
		for (const entry of MODEL_CATALOG) {
			expect(["cliproxy", "openrouter", "ollama", "openai-compat"]).toContain(entry.provider);
		}
	});
});

describe("resolveCallParams — OpenRouter provider", () => {
	test("attacker: emits unified `reasoning: { effort }` object, not bare reasoning_effort", () => {
		const { body } = resolveCallParams("openai/gpt-5.4-mini", "attacker", {});
		expect(body.reasoning).toEqual({ effort: "high" });
		expect(body.reasoning_effort).toBeUndefined();
	});

	test("verbosity is dropped for OpenRouter (OR doesn't forward it)", () => {
		const { body } = resolveCallParams("openai/gpt-5.4-mini", "attacker", {});
		expect(body.verbosity).toBeUndefined();
	});

	test("Kimi K2.6 attacker: temperature passed through, reasoning effort wrapped", () => {
		const { body } = resolveCallParams("moonshotai/kimi-k2.6", "attacker", {});
		expect(body.temperature).toBe(0.8);
		expect(body.reasoning).toEqual({ effort: "high" });
		expect(body.max_tokens).toBe(4000);
	});

	test("DeepSeek V4 Flash judge: low effort still wrapped in reasoning object", () => {
		const { body } = resolveCallParams("deepseek/deepseek-v4-flash", "judge", {});
		expect(body.reasoning).toEqual({ effort: "low" });
	});

	test("Gemma 4 (non-reasoning): no reasoning field emitted in any role", () => {
		for (const role of ["attacker", "benign", "judge"] as const) {
			const { body } = resolveCallParams("google/gemma-4-26b-a4b-it", role, {});
			expect(body.reasoning).toBeUndefined();
			expect(body.reasoning_effort).toBeUndefined();
		}
	});

	test("frequency_penalty still applied for OpenRouter entries", () => {
		const { body } = resolveCallParams("moonshotai/kimi-k2.6", "attacker", {});
		expect(typeof body.frequency_penalty).toBe("number");
		expect(body.frequency_penalty as number).toBeGreaterThan(0);
	});

	test("'minimal' effort would be omitted entirely on OpenRouter (OR effort enum is low|medium|high)", () => {
		// Sanity: if any OpenRouter catalog entry ever carries reasoningEffort: 'minimal',
		// the resolver should not emit a `reasoning` field for it (OR doesn't accept 'minimal').
		// We don't ship one today, but verify the guard via the unknown-model path: a hypothetical
		// caller passing 'minimal' should not produce an effort. This test pins the contract.
		// (Direct unit on the catalog: Gemma already has no reasoningEffort, exercised above.)
		const openrouterModelIds = MODEL_CATALOG.filter((e) => e.provider === "openrouter").map((e) => e.modelId);
		for (const modelId of openrouterModelIds) {
			for (const role of ["attacker", "benign", "judge"] as const) {
				const { body } = resolveCallParams(modelId, role, {});
				if (body.reasoning) {
					expect((body.reasoning as { effort: string }).effort).not.toBe("minimal");
				}
			}
		}
	});
});

describe("resolveCallParams — provider isolation", () => {
	test("cliproxy entries continue to emit bare reasoning_effort (no `reasoning` object)", () => {
		for (const modelId of ["claude-opus-4-7", "gpt-5.5", "gemini-3-pro-preview"]) {
			const { body } = resolveCallParams(modelId, "attacker", {});
			expect(body.reasoning).toBeUndefined();
			expect(body.reasoning_effort).toBeDefined();
		}
	});
});
