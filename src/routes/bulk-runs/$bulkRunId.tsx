import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import {
	ChartCard,
	SimpleBar,
	SimpleLine,
	SimplePie,
	formatMs,
	formatPercent,
} from "#/components/thesis/charts";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";

export const Route = createFileRoute("/bulk-runs/$bulkRunId")({ component: BulkRunDashboard });

function BulkRunDashboard() {
	const { bulkRunId } = Route.useParams();
	const query = useQuery({
		queryKey: queryKeys.bulkRun(bulkRunId),
		queryFn: () => api.bulkRun(bulkRunId),
		refetchInterval: (q) => {
			const status = q.state.data?.bulkRun.status;
			return status === "running" || status === "queued" ? 2000 : false;
		},
	});

	if (query.isLoading) return <p className="p-4">Loading…</p>;
	if (!query.data) return <p className="p-4">Bulk run not found.</p>;

	const { bulkRun, runs, dashboard } = query.data;
	const progress =
		dashboard.totalRuns > 0
			? ((dashboard.completedRuns + dashboard.failedRuns) / dashboard.totalRuns) * 100
			: 0;

	const scenarioBarData = [...dashboard.perScenario]
		.filter((s) => s.attackSuccessRate !== null)
		.sort((a, b) => (b.attackSuccessRate ?? 0) - (a.attackSuccessRate ?? 0))
		.map((s) => ({
			scenario: truncate(s.scenarioName, 22),
			successRate: Number(((s.attackSuccessRate ?? 0) * 100).toFixed(1)),
		}));

	const scenarioAttemptsData = [...dashboard.perScenario]
		.sort((a, b) => b.attemptsUsed - a.attemptsUsed)
		.map((s) => ({
			scenario: truncate(s.scenarioName, 22),
			attempts: s.attemptsUsed,
		}));

	const attemptsPerPositionData = dashboard.attemptsPerPosition.map((p) => ({
		position: `#${p.attemptNumber}`,
		successRate: Number((p.successRate * 100).toFixed(1)),
		attempts: p.total,
	}));

	const cumulativeData = dashboard.cumulativeProgress.map((p) => ({
		runIndex: p.index,
		successRate: Number((p.cumulativeSuccessRate * 100).toFixed(1)),
	}));

	const strategyData = dashboard.byStrategy.map((row) => ({
		strategy: truncate(row.strategy, 18),
		successes: row.successes,
		failures: row.count - row.successes,
	}));

	const intendedEffectData = dashboard.byIntendedEffect.map((row) => ({
		intendedEffect: row.intendedEffect,
		attempts: row.count,
		successRate: Number((row.successRate * 100).toFixed(1)),
	}));

	const stealthData = dashboard.byStealthLevel.map((row) => ({
		stealthLevel: row.stealthLevel,
		attempts: row.count,
		successRate: Number((row.successRate * 100).toFixed(1)),
	}));

	const triggerData = dashboard.byExpectedTrigger.map((row) => ({
		expectedTrigger: row.expectedTrigger,
		attempts: row.count,
		successRate: Number((row.successRate * 100).toFixed(1)),
	}));

	const whyFailedData = dashboard.byWhyItFailed.map((row) => ({
		reason: row.whyItFailed,
		count: row.count,
	}));

	const attackEffectPie = dashboard.byAttackEffect.map((row) => ({
		name: row.attackEffect,
		value: row.count,
	}));

	const statusPie = dashboard.runStatusCounts.map((row) => ({
		name: row.status,
		value: row.count,
	}));

	const outcomePie = [
		{ name: "success", value: dashboard.successVsFailureCounts.success },
		{ name: "failure", value: dashboard.successVsFailureCounts.failure },
		{ name: "pending", value: dashboard.successVsFailureCounts.pending },
	];

	const durationData = [
		{ phase: "attacker", ms: Math.round(dashboard.durationByPhase.meanAttackerMs) },
		{ phase: "benign", ms: Math.round(dashboard.durationByPhase.meanBenignMs) },
		{ phase: "total", ms: Math.round(dashboard.durationByPhase.meanTotalMs) },
	];

	return (
		<>
			<PageHeading
				title={bulkRun.name}
				description={`Status: ${bulkRun.status} · ${dashboard.totalRuns} scenarios · created ${new Date(bulkRun.createdAt).toLocaleString()}`}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Progress</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Progress value={progress} />
					<div className="grid grid-cols-2 gap-3 md:grid-cols-5">
						<Metric label="Completed" value={dashboard.completedRuns} />
						<Metric label="Running" value={dashboard.runningRuns} />
						<Metric label="Queued" value={dashboard.queuedRuns} />
						<Metric label="Failed" value={dashboard.failedRuns} />
						<Metric label="Successful" value={dashboard.successfulRuns} />
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Run-level success rate</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-semibold">
							{(dashboard.overallSuccessRate * 100).toFixed(1)}%
						</div>
						<p className="text-sm text-muted-foreground">
							{dashboard.successfulRuns}/{dashboard.completedRuns} completed runs succeeded
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Attempt-level success</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-semibold">
							{(dashboard.attemptSuccessRate * 100).toFixed(1)}%
						</div>
						<p className="text-sm text-muted-foreground">
							{dashboard.totalAttempts} attempts total
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Mean utility</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-semibold">{dashboard.meanUtility.toFixed(2)}</div>
						<p className="text-sm text-muted-foreground">
							Mean attempts per run: {dashboard.meanAttemptsPerRun.toFixed(1)}
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<ChartCard
					title="Run status"
					description="Distribution of child run lifecycle states."
				>
					<SimplePie data={statusPie} />
				</ChartCard>
				<ChartCard
					title="Run outcomes"
					description="Final attack success vs failure across completed runs."
				>
					<SimplePie data={outcomePie} />
				</ChartCard>
				<ChartCard
					title="Attack effect"
					description="Distribution of attack effect severity across attempts."
				>
					<SimplePie data={attackEffectPie} />
				</ChartCard>

				<ChartCard
					title="Attack success rate by scenario"
					description="Which scenarios are most vulnerable under this config?"
					className="md:col-span-2 xl:col-span-2"
				>
					<SimpleBar
						data={scenarioBarData}
						xKey="scenario"
						bars={[{ key: "successRate", label: "Success rate %" }]}
						height={320}
						yTickFormatter={(v) => `${v}%`}
					/>
				</ChartCard>
				<ChartCard
					title="Attempts used per scenario"
					description="Scenarios requiring more attempts are harder for the attacker."
				>
					<SimpleBar
						data={scenarioAttemptsData}
						xKey="scenario"
						bars={[{ key: "attempts", label: "Attempts", colorIndex: 1 }]}
						height={320}
					/>
				</ChartCard>

				<ChartCard
					title="Attacker learning curve"
					description="Success rate at each attempt position — does iterating help?"
				>
					<SimpleLine
						data={attemptsPerPositionData}
						xKey="position"
						lines={[{ key: "successRate", label: "Success rate %" }]}
						yTickFormatter={(v) => `${v}%`}
					/>
				</ChartCard>
				<ChartCard
					title="Cumulative success rate"
					description="Running success rate as completed runs accumulate."
				>
					<SimpleLine
						data={cumulativeData}
						xKey="runIndex"
						lines={[{ key: "successRate", label: "Cumulative success %", colorIndex: 2 }]}
						yTickFormatter={(v) => `${v}%`}
					/>
				</ChartCard>
				<ChartCard
					title="Duration by phase"
					description="Mean latency per attempt across attacker / benign / total."
				>
					<SimpleBar
						data={durationData}
						xKey="phase"
						bars={[{ key: "ms", label: "Mean ms", colorIndex: 3 }]}
						yTickFormatter={(v) => formatMs(v)}
					/>
				</ChartCard>

				<ChartCard
					title="Strategy: success vs failure"
					description="Which attacker strategies land vs get blocked?"
					className="md:col-span-2"
				>
					<SimpleBar
						data={strategyData}
						xKey="strategy"
						bars={[
							{ key: "successes", label: "Successes", stackId: "s" },
							{ key: "failures", label: "Failures", colorIndex: 3, stackId: "s" },
						]}
					/>
				</ChartCard>
				<ChartCard
					title="Intended effect"
					description="Attempt count + success rate per intended effect."
				>
					<SimpleBar
						data={intendedEffectData}
						xKey="intendedEffect"
						bars={[
							{ key: "attempts", label: "Attempts" },
							{ key: "successRate", label: "Success rate %", colorIndex: 2 },
						]}
					/>
				</ChartCard>
				<ChartCard title="Stealth level" description="How stealthy were attempts, and did it matter?">
					<SimpleBar
						data={stealthData}
						xKey="stealthLevel"
						bars={[
							{ key: "attempts", label: "Attempts" },
							{ key: "successRate", label: "Success rate %", colorIndex: 2 },
						]}
					/>
				</ChartCard>
				<ChartCard
					title="Expected trigger"
					description="Which user-intent triggers do attackers exploit?"
				>
					<SimpleBar
						data={triggerData}
						xKey="expectedTrigger"
						bars={[
							{ key: "attempts", label: "Attempts" },
							{ key: "successRate", label: "Success rate %", colorIndex: 2 },
						]}
					/>
				</ChartCard>
				<ChartCard
					title="Why attacks failed"
					description="Failure-mode breakdown over failed attempts."
					className="md:col-span-2"
				>
					<SimpleBar
						data={whyFailedData}
						xKey="reason"
						bars={[{ key: "count", label: "Failures", colorIndex: 3 }]}
					/>
				</ChartCard>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Per-scenario results</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Scenario</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Attempts</TableHead>
								<TableHead>✓/✗</TableHead>
								<TableHead>Final</TableHead>
								<TableHead>ASR</TableHead>
								<TableHead>Utility</TableHead>
								<TableHead>Att ms</TableHead>
								<TableHead>Ben ms</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{dashboard.perScenario.map((row) => (
								<TableRow key={row.runId}>
									<TableCell>
										<Link
											to="/runs/$runId"
											params={{ runId: row.runId }}
											className="hover:underline"
										>
											{row.scenarioName}
										</Link>
									</TableCell>
									<TableCell>
										<StatusBadge status={row.status as never} />
									</TableCell>
									<TableCell>{row.attemptsUsed}</TableCell>
									<TableCell className="font-mono text-xs">
										{row.successAttempts}/{row.failAttempts}
									</TableCell>
									<TableCell>
										{row.finalSuccess === null ? "—" : row.finalSuccess ? "success" : "no"}
									</TableCell>
									<TableCell>
										{row.attackSuccessRate === null
											? "—"
											: formatPercent(row.attackSuccessRate)}
									</TableCell>
									<TableCell>
										{row.utilityScore === null ? "—" : row.utilityScore.toFixed(2)}
									</TableCell>
									<TableCell>{formatMs(row.meanAttackDurationMs)}</TableCell>
									<TableCell>{formatMs(row.meanBenignDurationMs)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Child runs ({runs.length})</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>Scenario</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{runs.map((run) => (
								<TableRow key={run.id}>
									<TableCell>{run.bulkRunIndex ?? "—"}</TableCell>
									<TableCell>
										<Link
											to="/runs/$runId"
											params={{ runId: run.id }}
											className="hover:underline"
										>
											{run.scenarioName}
										</Link>
									</TableCell>
									<TableCell>
										<StatusBadge status={run.status} />
									</TableCell>
									<TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col rounded-md border p-3">
			<span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
			<span className="text-2xl font-semibold">{value}</span>
		</div>
	);
}

function truncate(value: string, max: number) {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}
