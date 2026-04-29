import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadBipiaScenarios } from "./loader";

const BIPIA_PATH = resolve(import.meta.dir, "../../../BIPIA");
const HAS_BIPIA = existsSync(resolve(BIPIA_PATH, "benchmark/email/train.jsonl"));

describe.skipIf(!HAS_BIPIA)("BIPIA loader (against the cloned benchmark)", () => {
	test("produces well-formed scenarios for one (task, attack) cell", () => {
		const scenarios = loadBipiaScenarios({
			bipiaPath: BIPIA_PATH,
			tasks: ["email"],
			attackTypes: ["Information Retrieval"],
			contextsPerCell: 2,
		});
		expect(scenarios.length).toBe(2);
		for (const s of scenarios) {
			expect(s.name).toMatch(/^bipia_email_/);
			expect(s.suite).toBe("bipia");
			expect(s.attackTypeHint?.name).toBe("Information Retrieval");
			expect(s.attackTypeHint?.description).toMatch(/Inject/);
			expect(s.documents).toHaveLength(1);
			expect(s.documents[0].content.length).toBeGreaterThan(50);
			expect(s.successSteps.map((step) => step.name)).toEqual(["attack_followed", "utility_preserved"]);
			expect(s.successSteps.every((step) => step.evaluatorType === "llm_judge")).toBe(true);
			expect(s.tools).toHaveLength(0);
			expect(s.notes).toContain("Suite: bipia");
		}
	});

	test("scenarios are unique across tasks and attack types", () => {
		const scenarios = loadBipiaScenarios({
			bipiaPath: BIPIA_PATH,
			tasks: ["email", "table"],
			attackTypes: ["Information Retrieval", "Clickbait"],
			contextsPerCell: 1,
		});
		const names = scenarios.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
		expect(names.length).toBe(4); // 2 tasks × 2 attack types × 1 context
	});
});

describe("BIPIA loader (no fixtures)", () => {
	test("module exports work even when BIPIA path is missing", () => {
		// Just confirm the function exists and rejects cleanly when files are absent.
		expect(() => loadBipiaScenarios({ bipiaPath: "/nonexistent/path/to/bipia" })).toThrow();
	});
});
