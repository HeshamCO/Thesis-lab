import { thesisDb } from "./db";
import { loadScenariosFromJson } from "./seed-scenarios-json";

const scenarios = loadScenariosFromJson();
const existingByName = new Map(thesisDb.listScenarios().map((scenario) => [scenario.name, scenario]));
let created = 0;
let upgraded = 0;
let skipped = 0;

for (const scenario of scenarios) {
	const existing = existingByName.get(scenario.name);
	if (!existing) {
		thesisDb.createScenario(scenario);
		created += 1;
		continue;
	}

	thesisDb.updateScenario(existing.id, scenario);
	upgraded += 1;
}

const total = thesisDb.listScenarios().length;
thesisDb.close();

console.log(
	`Scenario seed complete. Created ${created}, upgraded ${upgraded}, skipped ${skipped}, total scenarios ${total}.`,
);
