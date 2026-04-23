import type { AttemptRecord, BulkRunRecord, RunListItem } from "./schemas";

export type BulkRunDashboard = {
	totalRuns: number;
	completedRuns: number;
	runningRuns: number;
	queuedRuns: number;
	failedRuns: number;
	successfulRuns: number;
	overallSuccessRate: number;
	meanUtility: number;
	meanAttemptsPerRun: number;
	totalAttempts: number;
	attemptSuccessRate: number;
	totalDurationMs: number;
	perScenario: Array<{
		runId: string;
		scenarioName: string;
		status: string;
		attemptsUsed: number;
		finalSuccess: boolean | null;
		utilityScore: number | null;
		attackSuccessRate: number | null;
	}>;
	byStrategy: Array<{ strategy: string; count: number; successes: number; successRate: number }>;
	byIntendedEffect: Array<{
		intendedEffect: string;
		count: number;
		successes: number;
		successRate: number;
	}>;
};

export function computeBulkRunDashboard(
	_bulkRun: BulkRunRecord,
	runs: RunListItem[],
	attempts: AttemptRecord[],
): BulkRunDashboard {
	const totalRuns = runs.length;
	let completedRuns = 0;
	let runningRuns = 0;
	let queuedRuns = 0;
	let failedRuns = 0;
	let successfulRuns = 0;
	let utilitySum = 0;
	let utilityCount = 0;
	let attemptsSum = 0;

	for (const run of runs) {
		if (run.status === "completed") completedRuns += 1;
		else if (run.status === "running") runningRuns += 1;
		else if (run.status === "queued" || run.status === "pausing") queuedRuns += 1;
		else if (run.status === "failed") failedRuns += 1;

		if (run.summary) {
			if (run.summary.finalSuccess) successfulRuns += 1;
			utilitySum += run.summary.utilityScore;
			utilityCount += 1;
			attemptsSum += run.summary.attemptsUsed;
		}
	}

	const overallSuccessRate = completedRuns > 0 ? successfulRuns / completedRuns : 0;
	const meanUtility = utilityCount > 0 ? utilitySum / utilityCount : 0;
	const meanAttemptsPerRun = utilityCount > 0 ? attemptsSum / utilityCount : 0;

	const completedAttempts = attempts.filter((a) => a.status === "completed");
	const totalAttempts = completedAttempts.length;
	const attemptSuccesses = completedAttempts.filter((a) => a.success).length;
	const attemptSuccessRate = totalAttempts > 0 ? attemptSuccesses / totalAttempts : 0;
	const totalDurationMs = completedAttempts.reduce((sum, a) => sum + a.totalDurationMs, 0);

	const perScenario = runs.map((run) => ({
		runId: run.id,
		scenarioName: run.scenarioName,
		status: run.status,
		attemptsUsed: run.summary?.attemptsUsed ?? 0,
		finalSuccess: run.summary?.finalSuccess ?? null,
		utilityScore: run.summary?.utilityScore ?? null,
		attackSuccessRate: run.summary?.attackSuccessRate ?? null,
	}));

	const byStrategy = groupBy(completedAttempts, (a) => a.strategy || "(unspecified)");
	const byIntendedEffect = groupBy(completedAttempts, (a) => a.intendedEffect || "unspecified");

	return {
		totalRuns,
		completedRuns,
		runningRuns,
		queuedRuns,
		failedRuns,
		successfulRuns,
		overallSuccessRate,
		meanUtility,
		meanAttemptsPerRun,
		totalAttempts,
		attemptSuccessRate,
		totalDurationMs,
		perScenario,
		byStrategy: byStrategy.map((entry) => ({
			strategy: entry.key,
			count: entry.count,
			successes: entry.successes,
			successRate: entry.count > 0 ? entry.successes / entry.count : 0,
		})),
		byIntendedEffect: byIntendedEffect.map((entry) => ({
			intendedEffect: entry.key,
			count: entry.count,
			successes: entry.successes,
			successRate: entry.count > 0 ? entry.successes / entry.count : 0,
		})),
	};
}

function groupBy(attempts: AttemptRecord[], keyFn: (attempt: AttemptRecord) => string) {
	const map = new Map<string, { count: number; successes: number }>();
	for (const attempt of attempts) {
		const key = keyFn(attempt);
		const current = map.get(key) ?? { count: 0, successes: 0 };
		current.count += 1;
		if (attempt.success) current.successes += 1;
		map.set(key, current);
	}
	return Array.from(map.entries())
		.map(([key, value]) => ({ key, ...value }))
		.sort((a, b) => b.count - a.count);
}
