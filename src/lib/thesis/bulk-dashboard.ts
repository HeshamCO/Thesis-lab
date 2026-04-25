import type { AttemptRecord, BulkRunRecord, RunListItem } from "./schemas";

export type CI = { low: number; high: number };

export type BulkRunDashboard = {
	totalRuns: number;
	completedRuns: number;
	runningRuns: number;
	queuedRuns: number;
	failedRuns: number;
	successfulRuns: number;
	overallSuccessRate: number;
	overallSuccessRateCi: CI;
	meanUtility: number;
	meanAttemptsPerRun: number;
	totalAttempts: number;
	attemptSuccessRate: number;
	attemptSuccessRateCi: CI;
	totalDurationMs: number;
	meanTokensAttacker: number;
	meanTokensBenign: number;
	perScenarioAggregate: Array<{
		scenarioName: string;
		replicas: number;
		successCount: number;
		totalCount: number;
		successRate: number;
		ci: CI;
	}>;
	survivalCurve: Array<{ attemptNumber: number; survivors: number; newSuccesses: number; hazardRate: number; survivalRate: number }>;
	byCategory: Array<{ category: string; count: number; successes: number; successRate: number; ci: CI }>;
	perScenario: Array<{
		runId: string;
		scenarioName: string;
		status: string;
		attemptsUsed: number;
		finalSuccess: boolean | null;
		utilityScore: number | null;
		attackSuccessRate: number | null;
		successAttempts: number;
		failAttempts: number;
		meanAttackDurationMs: number;
		meanBenignDurationMs: number;
	}>;
	byStrategy: Array<{ strategy: string; count: number; successes: number; successRate: number }>;
	byIntendedEffect: Array<{
		intendedEffect: string;
		count: number;
		successes: number;
		successRate: number;
	}>;
	byStealthLevel: Array<{ stealthLevel: string; count: number; successes: number; successRate: number }>;
	byExpectedTrigger: Array<{ expectedTrigger: string; count: number; successes: number; successRate: number }>;
	byWhyItFailed: Array<{ whyItFailed: string; count: number }>;
	byAttackEffect: Array<{ attackEffect: string; count: number }>;
	attemptsPerPosition: Array<{ attemptNumber: number; total: number; successes: number; successRate: number }>;
	durationByPhase: { meanAttackerMs: number; meanBenignMs: number; meanTotalMs: number };
	cumulativeProgress: Array<{
		index: number;
		completedRuns: number;
		cumulativeSuccesses: number;
		cumulativeSuccessRate: number;
	}>;
	successVsFailureCounts: { success: number; failure: number; pending: number };
	runStatusCounts: Array<{ status: string; count: number }>;
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
	const overallSuccessRateCi = wilsonCi(successfulRuns, completedRuns);
	const meanUtility = utilityCount > 0 ? utilitySum / utilityCount : 0;
	const meanAttemptsPerRun = utilityCount > 0 ? attemptsSum / utilityCount : 0;

	const completedAttempts = attempts.filter((a) => a.status === "completed");
	const totalAttempts = completedAttempts.length;
	const attemptSuccesses = completedAttempts.filter((a) => a.success).length;
	const attemptSuccessRate = totalAttempts > 0 ? attemptSuccesses / totalAttempts : 0;
	const attemptSuccessRateCi = wilsonCi(attemptSuccesses, totalAttempts);
	const totalDurationMs = completedAttempts.reduce((sum, a) => sum + a.totalDurationMs, 0);

	const attemptTokenCount = completedAttempts.filter((a) => a.attackerTokensUsed > 0).length;
	const meanTokensAttacker =
		attemptTokenCount > 0
			? completedAttempts.reduce((s, a) => s + a.attackerTokensUsed, 0) / attemptTokenCount
			: 0;
	const benignTokenCount = completedAttempts.filter((a) => a.benignTokensUsed > 0).length;
	const meanTokensBenign =
		benignTokenCount > 0
			? completedAttempts.reduce((s, a) => s + a.benignTokensUsed, 0) / benignTokenCount
			: 0;

	const attemptsByRun = new Map<string, AttemptRecord[]>();
	for (const attempt of completedAttempts) {
		const list = attemptsByRun.get(attempt.runId) ?? [];
		list.push(attempt);
		attemptsByRun.set(attempt.runId, list);
	}

	// Category rollup over completed runs (derived from scenario name suffix).
	const catAccum = new Map<string, { successes: number; count: number }>();
	for (const run of runs) {
		if (!run.summary) continue;
		const cat = categorizeScenario(run.scenarioName);
		const acc = catAccum.get(cat) ?? { successes: 0, count: 0 };
		acc.count += 1;
		if (run.summary.finalSuccess) acc.successes += 1;
		catAccum.set(cat, acc);
	}
	const byCategory = Array.from(catAccum.entries())
		.map(([category, { successes, count }]) => ({
			category,
			count,
			successes,
			successRate: count > 0 ? successes / count : 0,
			ci: wilsonCi(successes, count),
		}))
		.sort((a, b) => b.count - a.count);

	// Aggregate per-scenario across replicas.
	const scenarioAccum = new Map<string, { successCount: number; totalCount: number }>();
	for (const run of runs) {
		if (!run.summary) continue;
		const acc = scenarioAccum.get(run.scenarioName) ?? { successCount: 0, totalCount: 0 };
		acc.totalCount += 1;
		if (run.summary.finalSuccess) acc.successCount += 1;
		scenarioAccum.set(run.scenarioName, acc);
	}
	const perScenarioAggregate = Array.from(scenarioAccum.entries())
		.map(([scenarioName, { successCount, totalCount }]) => ({
			scenarioName,
			replicas: totalCount,
			successCount,
			totalCount,
			successRate: totalCount > 0 ? successCount / totalCount : 0,
			ci: wilsonCi(successCount, totalCount),
		}))
		.sort((a, b) => b.successRate - a.successRate);

	// Survival curve: Kaplan-Meier-ish. Each run is one subject; right-censored at maxAttempts
	// if it never succeeded.
	const maxAttemptNumber = runs.reduce((m, r) => Math.max(m, r.maxAttempts), 0);
	const survivalCurve: BulkRunDashboard["survivalCurve"] = [];
	{
		let atRisk = runs.filter((r) => r.summary !== null).length;
		let survival = 1;
		const successByPosition = new Map<number, number>();
		const censorByPosition = new Map<number, number>();
		for (const run of runs) {
			if (!run.summary) continue;
			if (run.summary.finalSuccess) {
				const pos = run.summary.attemptsUsed || 1;
				successByPosition.set(pos, (successByPosition.get(pos) ?? 0) + 1);
			} else {
				// censored at attemptsUsed (or maxAttempts if that's what it reached)
				const pos = run.summary.attemptsUsed || run.maxAttempts;
				censorByPosition.set(pos, (censorByPosition.get(pos) ?? 0) + 1);
			}
		}
		for (let k = 1; k <= Math.max(maxAttemptNumber, 1); k += 1) {
			const newSuccesses = successByPosition.get(k) ?? 0;
			const censored = censorByPosition.get(k) ?? 0;
			const hazard = atRisk > 0 ? newSuccesses / atRisk : 0;
			survival *= 1 - hazard;
			survivalCurve.push({
				attemptNumber: k,
				survivors: Math.max(0, atRisk - newSuccesses),
				newSuccesses,
				hazardRate: hazard,
				survivalRate: survival,
			});
			atRisk -= newSuccesses + censored;
			if (atRisk <= 0) break;
		}
	}

	const perScenario = runs.map((run) => {
		const runAttempts = attemptsByRun.get(run.id) ?? [];
		const successAttempts = runAttempts.filter((a) => a.success).length;
		const failAttempts = runAttempts.length - successAttempts;
		const meanAttackDurationMs =
			runAttempts.length > 0
				? runAttempts.reduce((sum, a) => sum + a.attackDurationMs, 0) / runAttempts.length
				: 0;
		const meanBenignDurationMs =
			runAttempts.length > 0
				? runAttempts.reduce((sum, a) => sum + a.benignDurationMs, 0) / runAttempts.length
				: 0;
		return {
			runId: run.id,
			scenarioName: run.scenarioName,
			status: run.status,
			attemptsUsed: run.summary?.attemptsUsed ?? 0,
			finalSuccess: run.summary?.finalSuccess ?? null,
			utilityScore: run.summary?.utilityScore ?? null,
			attackSuccessRate: run.summary?.attackSuccessRate ?? null,
			successAttempts,
			failAttempts,
			meanAttackDurationMs,
			meanBenignDurationMs,
		};
	});

	const byStrategy = groupBy(completedAttempts, (a) => a.strategy || "(unspecified)");
	const byIntendedEffect = groupBy(completedAttempts, (a) => a.intendedEffect || "unspecified");
	const byStealthLevel = groupBy(completedAttempts, (a) => a.stealthLevel || "unspecified");
	const byExpectedTrigger = groupBy(completedAttempts, (a) => a.expectedTrigger || "unspecified");

	const failedCompletedAttempts = completedAttempts.filter((a) => !a.success);
	const byWhyItFailed = groupByCount(
		failedCompletedAttempts,
		(a) => a.attackTelemetry?.whyItFailed ?? "unspecified",
	);
	const byAttackEffect = groupByCount(
		completedAttempts,
		(a) => a.attackTelemetry?.attackEffect ?? "none",
	);

	const positionMap = new Map<number, { total: number; successes: number }>();
	for (const attempt of completedAttempts) {
		const bucket = positionMap.get(attempt.attemptNumber) ?? { total: 0, successes: 0 };
		bucket.total += 1;
		if (attempt.success) bucket.successes += 1;
		positionMap.set(attempt.attemptNumber, bucket);
	}
	const attemptsPerPosition = Array.from(positionMap.entries())
		.map(([attemptNumber, { total, successes }]) => ({
			attemptNumber,
			total,
			successes,
			successRate: total > 0 ? successes / total : 0,
		}))
		.sort((a, b) => a.attemptNumber - b.attemptNumber);

	const durationByPhase =
		completedAttempts.length > 0
			? {
					meanAttackerMs:
						completedAttempts.reduce((s, a) => s + a.attackDurationMs, 0) / completedAttempts.length,
					meanBenignMs:
						completedAttempts.reduce((s, a) => s + a.benignDurationMs, 0) / completedAttempts.length,
					meanTotalMs:
						completedAttempts.reduce((s, a) => s + a.totalDurationMs, 0) / completedAttempts.length,
				}
			: { meanAttackerMs: 0, meanBenignMs: 0, meanTotalMs: 0 };

	const completedWithSummary = [...runs]
		.filter((r) => r.status === "completed" && r.summary)
		.sort((a, b) => (a.completedAt ?? a.updatedAt).localeCompare(b.completedAt ?? b.updatedAt));
	const cumulativeProgress: BulkRunDashboard["cumulativeProgress"] = [];
	let cumSuccesses = 0;
	completedWithSummary.forEach((run, index) => {
		if (run.summary?.finalSuccess) cumSuccesses += 1;
		const completed = index + 1;
		cumulativeProgress.push({
			index: completed,
			completedRuns: completed,
			cumulativeSuccesses: cumSuccesses,
			cumulativeSuccessRate: cumSuccesses / completed,
		});
	});

	const withSummaryCount = runs.filter((r) => r.summary).length;
	const successVsFailureCounts = {
		success: runs.filter((r) => r.summary?.finalSuccess).length,
		failure: runs.filter((r) => r.summary && !r.summary.finalSuccess).length,
		pending: totalRuns - withSummaryCount,
	};

	const statusCounter = new Map<string, number>();
	for (const run of runs) {
		statusCounter.set(run.status, (statusCounter.get(run.status) ?? 0) + 1);
	}
	const runStatusCounts = Array.from(statusCounter.entries())
		.map(([status, count]) => ({ status, count }))
		.sort((a, b) => b.count - a.count);

	return {
		totalRuns,
		completedRuns,
		runningRuns,
		queuedRuns,
		failedRuns,
		successfulRuns,
		overallSuccessRate,
		overallSuccessRateCi,
		meanUtility,
		meanAttemptsPerRun,
		totalAttempts,
		attemptSuccessRate,
		attemptSuccessRateCi,
		totalDurationMs,
		meanTokensAttacker,
		meanTokensBenign,
		perScenarioAggregate,
		survivalCurve,
		byCategory,
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
		byStealthLevel: byStealthLevel.map((entry) => ({
			stealthLevel: entry.key,
			count: entry.count,
			successes: entry.successes,
			successRate: entry.count > 0 ? entry.successes / entry.count : 0,
		})),
		byExpectedTrigger: byExpectedTrigger.map((entry) => ({
			expectedTrigger: entry.key,
			count: entry.count,
			successes: entry.successes,
			successRate: entry.count > 0 ? entry.successes / entry.count : 0,
		})),
		byWhyItFailed: byWhyItFailed.map((entry) => ({ whyItFailed: entry.key, count: entry.count })),
		byAttackEffect: byAttackEffect.map((entry) => ({ attackEffect: entry.key, count: entry.count })),
		attemptsPerPosition,
		durationByPhase,
		cumulativeProgress,
		successVsFailureCounts,
		runStatusCounts,
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

const CATEGORY_KEYWORDS: Array<{ keyword: string; label: string }> = [
	{ keyword: "exfiltration", label: "exfiltration" },
	{ keyword: "direct_harm", label: "direct_harm" },
	{ keyword: "fraud", label: "fraud" },
	{ keyword: "misinformation", label: "misinformation" },
	{ keyword: "tool_misuse", label: "tool_misuse" },
	{ keyword: "output_manipulation", label: "output_manipulation" },
	{ keyword: "text_marker", label: "text_marker_injection" },
	{ keyword: "url_recommendation", label: "url_recommendation" },
	{ keyword: "answer_inversion", label: "answer_inversion" },
	{ keyword: "style_format", label: "style_format_hijack" },
];

export function categorizeScenario(scenarioName: string): string {
	const lower = scenarioName.toLowerCase();
	for (const { keyword, label } of CATEGORY_KEYWORDS) {
		if (lower.includes(keyword)) return label;
	}
	return "uncategorized";
}

export function wilsonCi(successes: number, total: number, z = 1.96): CI {
	if (total <= 0) return { low: 0, high: 0 };
	const p = successes / total;
	const denom = 1 + (z * z) / total;
	const centre = (p + (z * z) / (2 * total)) / denom;
	const spread = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom;
	return { low: Math.max(0, centre - spread), high: Math.min(1, centre + spread) };
}

function groupByCount(attempts: AttemptRecord[], keyFn: (attempt: AttemptRecord) => string) {
	const map = new Map<string, number>();
	for (const attempt of attempts) {
		const key = keyFn(attempt);
		map.set(key, (map.get(key) ?? 0) + 1);
	}
	return Array.from(map.entries())
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count);
}
