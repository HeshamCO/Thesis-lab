import { formatDurationMs } from "./run-stats";
import type { AttackerArtifact, AttemptRecord, RunDetail, RunLogRecord, StepResultRecord } from "./schemas";

export type TreeNodeKind =
	| "attempt"
	| "attacker"
	| "artifact"
	| "retrieval"
	| "retrieved-doc"
	| "defense"
	| "defense-drop"
	| "benign"
	| "steps"
	| "step"
	| "feedback";

export type TreeNode = {
	id: string;
	kind: TreeNodeKind;
	label: string;
	hint?: string;
	status?: "pass" | "fail" | "warn" | "info";
	body?: string;
	meta?: Record<string, string | number | boolean>;
	children?: TreeNode[];
};

type DroppedDoc = {
	title: string;
	source: string;
	pattern: string;
};

type RetrievedDocLogEntry = {
	rank: number;
	title: string;
	source: string;
};

export function buildAttemptTree(detail: RunDetail, attempt: AttemptRecord): TreeNode {
	const stepResults = detail.stepResults
		.filter((step) => step.attemptId === attempt.id)
		.sort((a, b) => a.orderIndex - b.orderIndex);
	const artifacts = detail.attackerArtifacts.filter((artifact) => artifact.attemptId === attempt.id);
	const logs = detail.logs.filter(
		(log) => (log.payload as { attemptNumber?: number })?.attemptNumber === attempt.attemptNumber,
	);

	const retrievalLog = pickLog(logs, "retrieval.queried");
	const defenseLog = pickLog(logs, "defense.applied");
	const benignLog = pickLog(logs, "benign.responded");

	return {
		id: `attempt-${attempt.id}`,
		kind: "attempt",
		label: `Attempt ${attempt.attemptNumber}`,
		hint: attempt.completedAt
			? `${attempt.status} · ${formatDuration(attempt.totalDurationMs)} · utility ${attempt.utilityScore.toFixed(2)}`
			: attempt.status,
		status: attempt.success ? "pass" : attempt.status === "failed" ? "fail" : "warn",
		meta: {
			success: attempt.success,
			status: attempt.status,
			totalDurationMs: attempt.totalDurationMs,
			attackDurationMs: attempt.attackDurationMs,
			benignDurationMs: attempt.benignDurationMs,
		},
		children: [
			buildAttackerNode(attempt, artifacts),
			buildRetrievalNode(attempt, retrievalLog, detail.retrievalSettings.topK),
			buildDefenseNode(attempt, defenseLog, detail.defenseSnapshot.mode),
			buildBenignNode(attempt, benignLog),
			buildStepsNode(stepResults),
			buildFeedbackNode(attempt),
		],
	};
}

function buildAttackerNode(attempt: AttemptRecord, artifacts: AttackerArtifact[]): TreeNode {
	const ordered = [...artifacts].sort((a, b) => artifactKindOrder(a.kind) - artifactKindOrder(b.kind));
	return {
		id: `attempt-${attempt.id}-attacker`,
		kind: "attacker",
		label: "Attacker model",
		hint: `${formatDuration(attempt.attackDurationMs)} · ${attempt.rawAttackerParseOk ? "parsed" : "parse failed"}`,
		status: attempt.rawAttackerParseOk ? "info" : "warn",
		children: ordered.map((artifact) => ({
			id: `artifact-${artifact.id}`,
			kind: "artifact" as const,
			label: artifactKindLabel(artifact.kind),
			hint: artifact.title,
			body: artifact.content,
			meta: { kind: artifact.kind, artifactId: artifact.id },
		})),
	};
}

function buildRetrievalNode(
	attempt: AttemptRecord,
	retrievalLog: RunLogRecord | null,
	configuredTopK: number,
): TreeNode {
	const docs =
		(retrievalLog?.payload?.documents as RetrievedDocLogEntry[] | undefined) ??
		attempt.retrievedContext.map((document, index) => ({
			rank: index + 1,
			title: document.title,
			source: document.source,
		}));
	const query = String(retrievalLog?.payload?.query ?? "");
	const topK = Number(retrievalLog?.payload?.topK ?? configuredTopK);
	const scenarioCount = docs.filter((document) => document.source === "scenario").length;
	const attackerCount = docs.filter((document) => document.source === "attacker").length;
	return {
		id: `attempt-${attempt.id}-retrieval`,
		kind: "retrieval",
		label: "Retrieval",
		hint: `k=${topK}${query ? ` · query "${truncate(query, 40)}"` : ""} · ${scenarioCount} scenario, ${attackerCount} attacker`,
		status: "info",
		children: docs.map((document) => ({
			id: `attempt-${attempt.id}-doc-${document.rank}`,
			kind: "retrieved-doc" as const,
			label: `${document.source}:${document.title}`,
			hint: `rank ${document.rank}`,
			meta: { rank: document.rank, source: document.source },
		})),
	};
}

function buildDefenseNode(attempt: AttemptRecord, defenseLog: RunLogRecord | null, defenseMode: string): TreeNode {
	const droppedRaw = (defenseLog?.payload?.dropped as DroppedDoc[] | undefined) ?? [];
	const droppedCount = Number(defenseLog?.payload?.droppedCount ?? attempt.defenseFilteredCount ?? 0);
	const mode = String(defenseLog?.payload?.mode ?? defenseMode);
	return {
		id: `attempt-${attempt.id}-defense`,
		kind: "defense",
		label: "Defense",
		hint: `mode=${mode} · ${droppedCount} filtered`,
		status: droppedCount > 0 ? "warn" : "info",
		children:
			droppedRaw.length > 0
				? droppedRaw.map((entry, index) => ({
						id: `attempt-${attempt.id}-drop-${index}`,
						kind: "defense-drop" as const,
						label: `${entry.source}:${entry.title}`,
						hint: `pattern /${entry.pattern}/`,
						status: "warn" as const,
						meta: { pattern: entry.pattern, source: entry.source },
					}))
				: [],
	};
}

function buildBenignNode(attempt: AttemptRecord, benignLog: RunLogRecord | null): TreeNode {
	const responseLength = Number(benignLog?.payload?.responseLength ?? attempt.benignResponse.length);
	const defenseApplied = Boolean(benignLog?.payload?.defensePromptApplied);
	return {
		id: `attempt-${attempt.id}-benign`,
		kind: "benign",
		label: "Benign response",
		hint: `${formatDuration(attempt.benignDurationMs)} · ${responseLength} chars${defenseApplied ? " · defensive prompt applied" : ""}`,
		status: "info",
		body: attempt.benignResponse,
	};
}

function buildStepsNode(stepResults: StepResultRecord[]): TreeNode {
	const passed = stepResults.filter((step) => step.passed).length;
	const total = stepResults.length;
	return {
		id: `steps-${stepResults.at(0)?.attemptId ?? "empty"}`,
		kind: "steps",
		label: "Step results",
		hint: total === 0 ? "no steps" : `${passed}/${total} passed`,
		status: total === 0 ? "info" : passed === total ? "pass" : "fail",
		children: stepResults.map((step) => ({
			id: `step-${step.id}`,
			kind: "step" as const,
			label: step.stepSnapshot.name,
			hint: `${step.stepSnapshot.evaluatorType} · score ${step.score.toFixed(2)}${step.stepSnapshot.required ? " · required" : ""}`,
			status: step.passed ? ("pass" as const) : ("fail" as const),
			body: [
				step.evaluatorOutput,
				step.evidence ? `Evidence: ${step.evidence}` : "",
				step.rawJudgeOutput ? `Raw judge output:\n${step.rawJudgeOutput}` : "",
				step.rawJudgeParseOk ? "" : "Raw judge output failed JSON parsing.",
			]
				.filter(Boolean)
				.join("\n\n"),
			meta: {
				required: step.stepSnapshot.required,
				evaluatorType: step.stepSnapshot.evaluatorType,
				rawJudgeParseOk: step.rawJudgeParseOk,
			},
		})),
	};
}

function buildFeedbackNode(attempt: AttemptRecord): TreeNode {
	return {
		id: `attempt-${attempt.id}-feedback`,
		kind: "feedback",
		label: "Feedback to next attempt",
		hint: attempt.feedback ? `${attempt.feedback.length} chars` : "no feedback",
		status: "info",
		body: attempt.feedback || "(no feedback recorded)",
	};
}

export function whyAttemptFailed(detail: RunDetail, attempt: AttemptRecord): string | null {
	if (attempt.success) {
		return null;
	}
	const stepResults = detail.stepResults
		.filter((step) => step.attemptId === attempt.id)
		.sort((a, b) => a.orderIndex - b.orderIndex);
	const failedRequired = stepResults.find((step) => !step.passed && step.stepSnapshot.required);
	if (failedRequired) {
		return `Required step "${failedRequired.stepSnapshot.name}" failed: ${failedRequired.evaluatorOutput}`;
	}
	if (attempt.error) {
		return attempt.error;
	}
	const failedAny = stepResults.find((step) => !step.passed);
	if (failedAny) {
		return `Step "${failedAny.stepSnapshot.name}" failed: ${failedAny.evaluatorOutput}`;
	}
	return null;
}

export function pickLog(logs: readonly RunLogRecord[], eventType: string): RunLogRecord | null {
	for (let index = logs.length - 1; index >= 0; index -= 1) {
		const log = logs[index];
		if (log && log.eventType === eventType) {
			return log;
		}
	}
	return null;
}

export function getAttemptNumber(log: RunLogRecord): number | null {
	const value = (log.payload as { attemptNumber?: unknown }).attemptNumber;
	return typeof value === "number" ? value : null;
}

const ARTIFACT_KIND_LABEL: Record<AttackerArtifact["kind"], string> = {
	rationale: "Rationale",
	injection_prompt: "Injection prompt",
	injected_document: "Injected document",
	raw_output: "Raw attacker output",
};

const ARTIFACT_KIND_ORDER: Record<AttackerArtifact["kind"], number> = {
	rationale: 0,
	injection_prompt: 1,
	injected_document: 2,
	raw_output: 3,
};

export function artifactKindOrder(kind: AttackerArtifact["kind"]) {
	return ARTIFACT_KIND_ORDER[kind] ?? 99;
}

export function artifactKindLabel(kind: AttackerArtifact["kind"]) {
	return ARTIFACT_KIND_LABEL[kind] ?? kind;
}

export function truncate(value: string, max: number) {
	const trimmed = value.trim().replace(/\s+/g, " ");
	return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

const formatDuration = formatDurationMs;
