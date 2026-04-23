import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scenarioInputSchema, type ScenarioInput } from "../src/lib/thesis/schemas";

export function loadScenariosFromJson(): ScenarioInput[] {
	const filePath = resolve(process.cwd(), "thesis_scenarios_by_category.json");
	const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { scenarios?: unknown[] };
	const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];

	return scenarios.map((scenario, index) => {
		const candidate = {
			documents: [],
			tools: [],
			notes: "",
			...((scenario ?? {}) as Record<string, unknown>),
		};
		const result = scenarioInputSchema.safeParse(candidate);
		if (!result.success) {
			throw new Error(
				`Invalid scenario at thesis_scenarios_by_category.json scenarios[${index}]: ${result.error.message}`,
			);
		}
		return result.data;
	});
}
