import { thesisDb } from "./db";
import { loadScenariosFromJson } from "./seed-scenarios-json";

// Scenarios that used to exist but have been intentionally retired. Re-running the seeder
// deletes them if still in the DB. Tool-dependent scenarios were removed when the sandbox
// proved unable to execute tool calls reliably — they added transport-bug noise to the ASR
// signal rather than measuring IPI susceptibility.
const REMOVED_SCENARIOS: readonly string[] = [
	"single_tool_trigger_log_meeting_31",
	"single_tool_trigger_tag_ticket_32",
	"single_tool_trigger_flag_message_33",
	"single_tool_trigger_bookmark_doc_34",
	"single_tool_trigger_save_draft_35",
	"tool_arg_capture_log_note_36",
	"tool_arg_capture_tag_urgent_37",
	"tool_arg_capture_flag_spam_38",
	"tool_arg_capture_bookmark_promo_39",
	"tool_arg_capture_save_signature_40",
];

const scenarios = loadScenariosFromJson();
const existingByName = new Map(thesisDb.listScenarios().map((scenario) => [scenario.name, scenario]));
let created = 0;
let upgraded = 0;
let skipped = 0;
let removed = 0;

for (const name of REMOVED_SCENARIOS) {
	const stale = existingByName.get(name);
	if (stale) {
		thesisDb.deleteScenario(stale.id);
		existingByName.delete(name);
		removed += 1;
	}
}

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
	`Scenario seed complete. Created ${created}, upgraded ${upgraded}, skipped ${skipped}, removed ${removed}, total scenarios ${total}.`,
);
