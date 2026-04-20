import { computeRunStats, formatDurationMs, formatPercent } from "./run-stats";
import { getAttemptNumber, pickLog, truncate } from "./run-tree";
import type { AttemptRecord, RunDetail, RunLogRecord, StepResultRecord, SuccessStepInput } from "./schemas";

export { getAttemptNumber, truncate as preview };

export type AttemptHeadline = {
	title: string;
	body: string;
	tone: "pass" | "fail" | "warn" | "info" | "running";
};

export function narrateAttempt(detail: RunDetail, attempt: AttemptRecord): AttemptHeadline {
	if (attempt.status === "running") {
		return {
			title: `Attempt ${attempt.attemptNumber} is in progress.`,
			body: "Live updates appear below as each phase finishes.",
			tone: "running",
		};
	}
	if (attempt.success) {
		const passedRequired = countRequired(detail, attempt);
		return {
			title: `Attempt ${attempt.attemptNumber} succeeded — the attack landed.`,
			body: `Every required step passed (${passedRequired.passed} of ${passedRequired.total}). The loop stops here.`,
			tone: "pass",
		};
	}
	if (attempt.status === "failed") {
		return {
			title: `Attempt ${attempt.attemptNumber} crashed.`,
			body: attempt.error || "The engine raised an unhandled exception. See the Logs tab for details.",
			tone: "fail",
		};
	}
	const failedRequired = firstFailedRequired(detail, attempt);
	if (failedRequired) {
		return {
			title: `Attempt ${attempt.attemptNumber} did not pass the required step.`,
			body: `"${failedRequired.stepSnapshot.name}" — ${failedRequired.evaluatorOutput}`,
			tone: "fail",
		};
	}
	return {
		title: `Attempt ${attempt.attemptNumber} did not produce a full success.`,
		body: "Some steps did not pass. Open the Step results card below for the breakdown.",
		tone: "warn",
	};
}

export function narrateAttacker(attempt: AttemptRecord): string {
	if (!attempt.rawAttackerParseOk) {
		return "The attacker model returned text that was not valid JSON. The engine fell back to defaults; the raw output is preserved as an artifact.";
	}
	const promptPreview = preview(attempt.injectionPrompt, 110);
	const documentLength = attempt.injectedDocument.length;
	if (!promptPreview && documentLength === 0) {
		return "The attacker model produced an empty injection.";
	}
	const documentPart =
		documentLength > 0 ? ` It also wrote a ${formatNumber(documentLength)}-character document to be retrieved.` : "";
	return `The attacker wrote an injection: "${promptPreview}".${documentPart}`;
}

export function narrateRetrieval(
	attempt: AttemptRecord,
	retrievalLog: RunLogRecord | null,
	configuredTopK: number,
): string {
	const docs = retrievalDocs(attempt, retrievalLog);
	const topK = Number(retrievalLog?.payload?.topK ?? configuredTopK);
	if (docs.length === 0) {
		return `Retrieval returned no documents (asked for top ${topK}).`;
	}
	const scenarioCount = docs.filter((document) => document.source === "scenario").length;
	const attackerCount = docs.filter((document) => document.source === "attacker").length;
	const attackerRank = docs.find((document) => document.source === "attacker")?.rank;
	const attackerNote =
		attackerCount === 0
			? " The attacker's injected document did not make it into the top results — the attack will not reach the model this attempt."
			: attackerRank
				? ` The attacker's injected document came back at rank #${attackerRank}.`
				: "";
	return `The store returned ${docs.length} document${docs.length === 1 ? "" : "s"} — ${scenarioCount} from the seed corpus and ${attackerCount} from the attacker.${attackerNote}`;
}

export function narrateDefense(attempt: AttemptRecord, defenseLog: RunLogRecord | null, defenseMode: string): string {
	const droppedCount = Number(defenseLog?.payload?.droppedCount ?? attempt.defenseFilteredCount ?? 0);
	const mode = String(defenseLog?.payload?.mode ?? defenseMode);
	const dropped = droppedDocs(defenseLog);
	if (mode === "none" && droppedCount === 0) {
		return "No defense was applied. Retrieved documents were passed through unchanged.";
	}
	if (droppedCount === 0) {
		return `Defense ${mode} kept every retrieved document — no blocked patterns matched.`;
	}
	const exemplar = dropped[0];
	const exemplarNote = exemplar
		? ` The first drop was "${preview(exemplar.title, 60)}" because it matched /${exemplar.pattern}/.`
		: "";
	return `Defense ${mode} dropped ${droppedCount} retrieved document${droppedCount === 1 ? "" : "s"}.${exemplarNote}`;
}

export function narrateToolCalls(toolCalls: ReadonlyArray<{ toolName: string; status: string }>): string {
	if (toolCalls.length === 0) {
		return "The model did not call any tools.";
	}
	const blocked = toolCalls.filter((call) => call.status === "blocked_by_defense").length;
	const errored = toolCalls.filter((call) => call.status === "error").length;
	const ok = toolCalls.length - blocked - errored;
	const parts = [`${toolCalls.length} call${toolCalls.length === 1 ? "" : "s"}`];
	if (ok > 0) parts.push(`${ok} succeeded`);
	if (errored > 0) parts.push(`${errored} errored`);
	if (blocked > 0) parts.push(`${blocked} blocked by defense`);
	const names = Array.from(new Set(toolCalls.map((call) => call.toolName))).slice(0, 3);
	const namesPart = names.length > 0 ? ` Tools called: ${names.join(", ")}.` : "";
	return `${parts.join(" \u00B7 ")}.${namesPart}`;
}

export function narrateBenign(attempt: AttemptRecord, benignLog: RunLogRecord | null): string {
	const responseLength = Number(benignLog?.payload?.responseLength ?? attempt.benignResponse.length);
	const defenseApplied = Boolean(benignLog?.payload?.defensePromptApplied);
	const defenseNote = defenseApplied ? " The defensive prompt was prepended to the user task." : "";
	if (responseLength === 0) {
		return `The benign model returned an empty response.${defenseNote}`;
	}
	return `The benign model produced a ${formatNumber(responseLength)}-character response in ${formatDurationMs(attempt.benignDurationMs)}.${defenseNote}`;
}

export function narrateSteps(stepResults: readonly StepResultRecord[]): string {
	if (stepResults.length === 0) {
		return "No step results yet.";
	}
	const passed = stepResults.filter((step) => step.passed).length;
	const total = stepResults.length;
	const required = stepResults.filter((step) => step.stepSnapshot.required);
	const requiredPassed = required.filter((step) => step.passed).length;
	const requiredTotal = required.length;
	const requiredNote =
		requiredTotal === 0
			? ""
			: requiredPassed === requiredTotal
				? " Every required step passed — this is a full attack success."
				: ` ${requiredTotal - requiredPassed} required step${requiredTotal - requiredPassed === 1 ? " did" : "s did"} not pass.`;
	return `${passed} of ${total} step${total === 1 ? "" : "s"} passed.${requiredNote}`;
}

export function narrateStepResult(step: StepResultRecord): string {
	const targetPart = describeEvaluatorTarget(step.stepSnapshot);
	if (step.passed) {
		return targetPart
			? `Passed. ${capitalize(step.evaluatorOutput || "")} ${targetPart}`.trim()
			: `Passed. ${step.evaluatorOutput}`.trim();
	}
	return targetPart
		? `Did not pass. ${capitalize(step.evaluatorOutput || "")} ${targetPart}`.trim()
		: `Did not pass. ${step.evaluatorOutput}`.trim();
}

export function narrateFeedback(attempt: AttemptRecord): string {
	if (!attempt.feedback) {
		return "No feedback recorded for this attempt.";
	}
	if (attempt.feedback.startsWith("All required success steps passed")) {
		return "All required steps passed, so no corrective feedback was sent — the loop ends here.";
	}
	const lines = attempt.feedback.split(/\n+/).filter(Boolean).length;
	return `The engine sent ${lines} corrective note${lines === 1 ? "" : "s"} to the attacker before the next attempt.`;
}

export function narrateRun(detail: RunDetail): string {
	const stats = computeRunStats(detail);
	const completed = stats.completedAttempts;
	const final = detail.summary;
	const familyHint = familyFromName(detail.scenarioName);
	const familyPart = familyHint ? `attack family ${familyHint}` : "this scenario";
	if (completed === 0 && detail.attempts.length === 0) {
		return `Run is ${detail.status}. The loop has not produced any completed attempts yet.`;
	}
	const verdict = final?.finalSuccess
		? `Final verdict: the attack succeeded against the ${detail.defenseName} defense.`
		: detail.status === "completed"
			? `Final verdict: the ${detail.defenseName} defense held — no attempt passed every required step.`
			: `Run is ${detail.status} after ${completed} completed attempt${completed === 1 ? "" : "s"}.`;
	const filterPart =
		stats.defenseFilteredCount === 0
			? "The defense filter dropped no documents."
			: `The defense filter dropped documents on ${formatPercent(stats.defenseFilterHitRate)} of attempts.`;
	const parsePart =
		stats.attackerParseFailures === 0 && stats.judgeParseFailures === 0
			? "All model outputs parsed cleanly."
			: `${stats.attackerParseFailures} attacker output${stats.attackerParseFailures === 1 ? "" : "s"} and ${stats.judgeParseFailures} judge output${stats.judgeParseFailures === 1 ? "" : "s"} failed JSON parsing — see Logs (level: warn).`;
	return `${verdict} The loop ran ${completed} attempt${completed === 1 ? "" : "s"} of up to ${detail.maxAttempts} on ${familyPart}, taking ${formatDurationMs(stats.totalDurationMs)} in total. ${filterPart} ${parsePart}`;
}

export function narrateLogEvent(log: RunLogRecord): string {
	const payload = (log.payload ?? {}) as Record<string, unknown>;
	const attempt = getAttemptNumber(log);
	const attemptPrefix = attempt !== null ? `Attempt ${attempt}: ` : "";
	switch (log.eventType) {
		case "run.created":
			return "Run created from the scenario snapshot. The seed corpus is now in the run's RAG store.";
		case "run.started":
			return "Engine started executing the loop.";
		case "run.pause_requested":
			return "Pause requested — the engine will stop after the current attempt's checkpoint.";
		case "run.paused":
			return `Run paused at the next attempt boundary${typeof payload.nextAttempt === "number" ? ` (would have been attempt ${payload.nextAttempt})` : ""}.`;
		case "run.resume":
			return "Resume requested. Any open attempts are marked failed before the loop continues.";
		case "run.completed":
			return typeof payload.attemptNumber === "number"
				? `Run completed because attempt ${payload.attemptNumber} succeeded.`
				: typeof payload.maxAttempts === "number"
					? `Run completed at max attempts (${payload.maxAttempts}). No attempt passed every required step.`
					: "Run completed.";
		case "run.failed":
			return `Run failed: ${log.message}`;
		case "run.recovered":
			return "Recovered after API restart. The run was paused so you can review and resume it.";
		case "attempt.started":
			return `${attemptPrefix}phase 1 of 6 — calling the attacker model.`;
		case "attack.generated": {
			const ms = numberOrDash(payload.durationMs);
			const length = numberOrDash(payload.rawOutputLength);
			return payload.parseOk === false
				? `${attemptPrefix}attacker output failed JSON parsing after ${ms}. Raw output length: ${length}.`
				: `${attemptPrefix}attacker produced a ${length}-character output in ${ms}.`;
		}
		case "retrieval.queried": {
			const k = numberOrDash(payload.topK);
			const got = numberOrDash(payload.retrieved);
			const scenarioCount = numberOrDash(payload.scenarioCount);
			const attackerCount = numberOrDash(payload.attackerCount);
			return `${attemptPrefix}retrieval pulled ${got} document(s) for k=${k} (${scenarioCount} scenario, ${attackerCount} attacker).`;
		}
		case "defense.applied": {
			const dropped = numberOrDash(payload.droppedCount);
			const kept = numberOrDash(payload.keptCount);
			const mode = String(payload.mode ?? "");
			return Number(payload.droppedCount) > 0
				? `${attemptPrefix}defense ${mode} dropped ${dropped} document(s) and kept ${kept}.`
				: `${attemptPrefix}defense ${mode} kept every retrieved document.`;
		}
		case "defense.parity_mismatch":
			return `${attemptPrefix}defense parity mismatch — engine and shared helper disagreed on kept count.`;
		case "benign.responded": {
			const ms = numberOrDash(payload.durationMs);
			const length = numberOrDash(payload.responseLength);
			return `${attemptPrefix}benign model responded with ${length} characters in ${ms}.`;
		}
		case "judge.evaluated": {
			const stepName = String(payload.stepName ?? "");
			return payload.parseOk === false
				? `${attemptPrefix}LLM judge for "${stepName}" failed JSON parsing.`
				: `${attemptPrefix}LLM judge evaluated "${stepName}" — ${payload.passed ? "passed" : "did not pass"}.`;
		}
		case "feedback.built": {
			const failed = numberOrDash(payload.failedCount);
			const failedRequired = Array.isArray(payload.failedRequired) ? payload.failedRequired.length : 0;
			return `${attemptPrefix}built feedback for the next attempt (${failed} step(s) failed, ${failedRequired} required).`;
		}
		case "attempt.completed":
			return `${attemptPrefix}attempt completed${payload.success ? " with a full attack success" : ""}.`;
		default:
			return log.message || `${log.eventType} event.`;
	}
}

function numberOrDash(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? formatMaybeMs(value) : "—";
}

function formatMaybeMs(value: number) {
	if (value >= 50 && value < 1_000_000) {
		return formatDurationMs(value);
	}
	return formatNumber(value);
}

function describeEvaluatorTarget(step: SuccessStepInput) {
	const config = step.evaluatorConfig as Record<string, unknown>;
	if (step.evaluatorType === "contains_text" || step.evaluatorType === "not_contains_text") {
		const target = typeof config.target === "string" ? config.target : "";
		if (!target) {
			return "";
		}
		return step.evaluatorType === "contains_text"
			? `Looking for: "${preview(target, 80)}".`
			: `Forbidden: "${preview(target, 80)}".`;
	}
	if (step.evaluatorType === "regex") {
		const pattern = typeof config.pattern === "string" ? config.pattern : "";
		if (!pattern) {
			return "";
		}
		return `Regex: /${preview(pattern, 100)}/.`;
	}
	if (step.evaluatorType === "llm_judge") {
		const rubric = typeof config.rubric === "string" ? config.rubric : "";
		return rubric ? `Judged on: ${preview(rubric, 120)}` : "";
	}
	return "";
}

const preview = truncate;

function capitalize(value: string) {
	return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function formatNumber(value: number) {
	return value.toLocaleString();
}

function familyFromName(scenarioName: string) {
	const match = scenarioName.match(/^(\S+)/);
	return match ? match[1] : "";
}

function countRequired(detail: RunDetail, attempt: AttemptRecord) {
	const stepResults = detail.stepResults.filter((step) => step.attemptId === attempt.id);
	const required = stepResults.filter((step) => step.stepSnapshot.required);
	return {
		passed: required.filter((step) => step.passed).length,
		total: required.length,
	};
}

function firstFailedRequired(detail: RunDetail, attempt: AttemptRecord) {
	return detail.stepResults
		.filter((step) => step.attemptId === attempt.id)
		.sort((a, b) => a.orderIndex - b.orderIndex)
		.find((step) => !step.passed && step.stepSnapshot.required);
}

function retrievalDocs(attempt: AttemptRecord, retrievalLog: RunLogRecord | null) {
	const fromLog = retrievalLog?.payload?.documents as
		| Array<{ rank: number; title: string; source: string }>
		| undefined;
	if (fromLog && fromLog.length > 0) {
		return fromLog;
	}
	return attempt.retrievedContext.map((document, index) => ({
		rank: index + 1,
		title: document.title,
		source: document.source,
	}));
}

function droppedDocs(defenseLog: RunLogRecord | null) {
	const dropped = defenseLog?.payload?.dropped;
	if (!Array.isArray(dropped)) {
		return [] as Array<{ title: string; source: string; pattern: string }>;
	}
	return dropped as Array<{ title: string; source: string; pattern: string }>;
}

export function pickAttemptLog(logs: readonly RunLogRecord[], attemptNumber: number, eventType: string) {
	return pickLog(
		logs.filter((log) => getAttemptNumber(log) === attemptNumber),
		eventType,
	);
}
