import { describe, expect, test } from "bun:test";
import { MODEL_CATALOG } from "./catalog";
import { resolveCallParams } from "./resolver";

describe("resolveCallParams — GPT-5 family", () => {
	test("attacker gets low effort + medium verbosity, no temperature, max_completion_tokens", () => {
		const { body } = resolveCallParams("gpt-5.5", "attacker", {});
		expect(body.reasoning_effort).toBe("low");
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
	test("attacker: reasoning_effort=low, no temperature (only benign role carries it), max_tokens honored", () => {
		const { body } = resolveCallParams("claude-opus-4-7", "attacker", {});
		expect(body.reasoning_effort).toBe("low");
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
	test("Gemini 3 Pro attacker: temperature=0.8 (exploration) + low effort + max_tokens", () => {
		const { body } = resolveCallParams("gemini-3-pro-preview", "attacker", {});
		expect(body.temperature).toBe(0.8);
		expect(body.reasoning_effort).toBe("low");
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
	test("falls back to DB row's temperature + maxTokens, no family extras", () => {
		const { body } = resolveCallParams("llama-unknown-test", "attacker", {
			temperature: 0.7,
			maxTokens: 1234,
		});
		expect(body.temperature).toBe(0.7);
		expect(body.max_tokens).toBe(1234);
		expect(body.reasoning_effort).toBeUndefined();
		expect(body.verbosity).toBeUndefined();
	});
});

describe("resolveCallParams — frequency_penalty (attacker-only diversification)", () => {
	test("attacker carries frequency_penalty across all three families", () => {
		for (const modelId of ["claude-opus-4-7", "gpt-5.5", "gemini-3-pro-preview"]) {
			const { body } = resolveCallParams(modelId, "attacker", {});
			expect(body.frequency_penalty).toBe(0.4);
		}
	});

	test("benign and judge never carry frequency_penalty (consistency over diversity)", () => {
		for (const modelId of ["claude-sonnet-4-6", "gpt-5.4", "gemini-3-flash-preview"]) {
			for (const role of ["benign", "judge"] as const) {
				const { body } = resolveCallParams(modelId, role, {});
				expect(body.frequency_penalty).toBeUndefined();
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

	test("GPT-5 entries never carry temperature in any role", () => {
		for (const entry of MODEL_CATALOG.filter((e) => e.family === "openai")) {
			for (const role of ["attacker", "benign", "judge"] as const) {
				const { body } = resolveCallParams(entry.modelId, role, {});
				expect(body.temperature).toBeUndefined();
			}
		}
	});
});
