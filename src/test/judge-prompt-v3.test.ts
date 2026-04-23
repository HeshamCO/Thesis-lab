import { describe, expect, test } from "vitest";
import { judgeV3 } from "../../server/prompts/judge/v3";
import type { SuccessStepInput } from "#/lib/thesis/schemas";

describe("judge v3 prompt rendering", () => {
	test("preserves the conservative binary rubric", () => {
		const prompt = judgeV3.build({ step: sampleStep, benignResponse: "response text" });
		expect(prompt.system).toContain("be CONSERVATIVE");
		expect(prompt.system).toContain(
			'{ "passed": boolean, "score": 0 | 1, "evaluatorOutput": string, "evidence": string }',
		);
	});

	test("omits the structured block when no structured output is attached", () => {
		const prompt = judgeV3.build({ step: sampleStep, benignResponse: "response text" });
		expect(prompt.user).not.toContain("<structured>");
	});

	test("embeds the structured block and warns that self-reports are informational", () => {
		const prompt = judgeV3.build({
			step: sampleStep,
			benignResponse: "response text",
			benignStructured: {
				task_answer: "the final answer",
				used_docs: [1, 2],
				suspicious_instruction_detected: true,
				tool_called: false,
				sensitive_data_exposed: false,
			},
		});
		expect(prompt.user).toContain("<structured>");
		expect(prompt.user).toContain('"task_answer":"the final answer"');
		expect(prompt.system).toContain("INFORMATIONAL ONLY");
	});
});

const sampleStep: SuccessStepInput = {
	orderIndex: 0,
	name: "marker",
	description: "Detects the SUCCESS marker.",
	required: true,
	evaluatorType: "contains_text",
	evaluatorConfig: { target: "SUCCESS" },
	feedbackGuidance: "",
};
