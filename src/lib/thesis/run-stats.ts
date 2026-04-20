import type { RunDetail } from "./schemas";

export type RunStats = {
	totalDurationMs: number;
	avgAttemptDurationMs: number;
	avgAttackDurationMs: number;
	avgBenignDurationMs: number;
	completedAttempts: number;
	failedAttempts: number;
	defenseFilteredCount: number;
	defenseFilterHitRate: number;
	attackerParseFailures: number;
	judgeParseFailures: number;
	requiredStepPassRate: number;
};

export function computeRunStats(detail: RunDetail): RunStats {
	const attempts = detail.attempts;
	const completed = attempts.filter((attempt) => attempt.status === "completed");
	const failed = attempts.filter((attempt) => attempt.status === "failed");
	const totalDurationMs = completed.reduce((total, attempt) => total + attempt.totalDurationMs, 0);
	const avg = (selector: (attempt: (typeof completed)[number]) => number) =>
		completed.length === 0 ? 0 : completed.reduce((total, attempt) => total + selector(attempt), 0) / completed.length;
	const defenseFilteredCount = completed.reduce((total, attempt) => total + attempt.defenseFilteredCount, 0);
	const defenseFilterAttempts = completed.filter((attempt) => attempt.defenseFilteredCount > 0).length;
	const attackerParseFailures = attempts.filter((attempt) => !attempt.rawAttackerParseOk).length;
	const judgeParseFailures = detail.stepResults.filter(
		(step) => step.stepSnapshot.evaluatorType === "llm_judge" && !step.rawJudgeParseOk,
	).length;
	const requiredSteps = detail.stepResults.filter((step) => step.stepSnapshot.required);
	const requiredStepPassRate =
		requiredSteps.length === 0 ? 0 : requiredSteps.filter((step) => step.passed).length / requiredSteps.length;

	return {
		totalDurationMs,
		avgAttemptDurationMs: avg((attempt) => attempt.totalDurationMs),
		avgAttackDurationMs: avg((attempt) => attempt.attackDurationMs),
		avgBenignDurationMs: avg((attempt) => attempt.benignDurationMs),
		completedAttempts: completed.length,
		failedAttempts: failed.length,
		defenseFilteredCount,
		defenseFilterHitRate: completed.length === 0 ? 0 : defenseFilterAttempts / completed.length,
		attackerParseFailures,
		judgeParseFailures,
		requiredStepPassRate,
	};
}

export function formatDurationMs(ms: number) {
	if (!Number.isFinite(ms) || ms <= 0) {
		return "—";
	}
	if (ms < 1000) {
		return `${Math.round(ms)} ms`;
	}
	if (ms < 60000) {
		return `${(ms / 1000).toFixed(1)} s`;
	}
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.round((ms % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

export function formatPercent(ratio: number) {
	if (!Number.isFinite(ratio) || ratio <= 0) {
		return "0%";
	}
	return `${Math.round(ratio * 100)}%`;
}
