import { thesisDb } from "./db";
import { BIPIA_TEXT_TASKS, type BipiaTextTask, loadBipiaDumpedScenarios, loadBipiaScenarios } from "./bipia";

// CLI: bun run server/seed-bipia-scenarios.ts [--tasks email,qa,...] [--types "Information Retrieval,..."]
//      [--variant 0] [--per-cell 1] [--bipia-path ../BIPIA] [--split train|test]
// Defaults to a small subsample so the first seeding finishes fast: all 4 text tasks × 5
// attack types × 1 context row = 20 BIPIA scenarios. Re-run with wider flags for fuller coverage.

function parseArgs(argv: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith("--")) {
			const key = arg.slice(2);
			const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
			out[key] = value;
		}
	}
	return out;
}

const args = parseArgs(process.argv.slice(2));
const tasks = (args.tasks ? args.tasks.split(",") : BIPIA_TEXT_TASKS) as readonly BipiaTextTask[];
const attackTypes = args.types
	? args.types.split(",").map((s) => s.trim())
	: ["Information Retrieval", "Instruction", "Persuasion", "Clickbait", "Language Translation"];
const variantIndex = args.variant ? Number(args.variant) : 0;
const contextsPerCell = args["per-cell"] ? Number(args["per-cell"]) : 1;
const bipiaPath = args["bipia-path"] ?? process.env.BIPIA_PATH;
const split = args.split === "test" ? "test" : "train";

const useDumped = args.dumped === "true" || args["only-dumped"] === "true";
const includeDumped = useDumped || args["include-dumped"] === "true";
const limitPerFile = args["dumped-limit"] ? Number(args["dumped-limit"]) : undefined;
const dumpFiles = args["dump-files"] ? args["dump-files"].split(",").map((s) => s.trim()) : undefined;

const baseScenarios = args["only-dumped"] === "true"
	? []
	: loadBipiaScenarios({
			bipiaPath,
			tasks,
			attackTypes,
			variantIndex,
			contextsPerCell,
			split,
		});

const dumpedScenarios = includeDumped || useDumped
	? loadBipiaDumpedScenarios({ bipiaPath, limitPerFile, files: dumpFiles })
	: [];

const scenarios = [...baseScenarios, ...dumpedScenarios];
console.log(
	`Loaded ${baseScenarios.length} curated + ${dumpedScenarios.length} dumped BIPIA scenarios.`,
);

const existingByName = new Map(thesisDb.listScenarios().map((scenario) => [scenario.name, scenario]));
let created = 0;
let upgraded = 0;
for (const scenario of scenarios) {
	const existing = existingByName.get(scenario.name);
	if (!existing) {
		thesisDb.createScenario(scenario);
		created += 1;
	} else {
		thesisDb.updateScenario(existing.id, scenario);
		upgraded += 1;
	}
}

const totalBipia = thesisDb.listScenarios({ suite: "bipia" }).length;
const totalAll = thesisDb.listScenarios().length;
thesisDb.close();
console.log(
	`BIPIA seed complete. Created ${created}, upgraded ${upgraded}. BIPIA scenarios in DB: ${totalBipia}; total scenarios: ${totalAll}.`,
);
