import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
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
								<TableHead>Attempts used</TableHead>
								<TableHead>Final success</TableHead>
								<TableHead>Attack success rate</TableHead>
								<TableHead>Utility</TableHead>
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
									<TableCell>
										{row.finalSuccess === null
											? "—"
											: row.finalSuccess
												? "success"
												: "no"}
									</TableCell>
									<TableCell>
										{row.attackSuccessRate === null
											? "—"
											: `${(row.attackSuccessRate * 100).toFixed(0)}%`}
									</TableCell>
									<TableCell>
										{row.utilityScore === null ? "—" : row.utilityScore.toFixed(2)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-2">
				<BreakdownCard
					title="By attacker strategy"
					keyLabel="Strategy"
					rows={dashboard.byStrategy.map((row) => ({
						key: row.strategy,
						count: row.count,
						successes: row.successes,
						successRate: row.successRate,
					}))}
				/>
				<BreakdownCard
					title="By intended effect"
					keyLabel="Intended effect"
					rows={dashboard.byIntendedEffect.map((row) => ({
						key: row.intendedEffect,
						count: row.count,
						successes: row.successes,
						successRate: row.successRate,
					}))}
				/>
			</div>

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

function BreakdownCard({
	title,
	keyLabel,
	rows,
}: {
	title: string;
	keyLabel: string;
	rows: Array<{ key: string; count: number; successes: number; successRate: number }>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{keyLabel}</TableHead>
							<TableHead>Attempts</TableHead>
							<TableHead>Succeeded</TableHead>
							<TableHead>Rate</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-center text-muted-foreground">
									No data yet.
								</TableCell>
							</TableRow>
						) : (
							rows.map((row) => (
								<TableRow key={row.key}>
									<TableCell className="font-mono text-xs">{row.key}</TableCell>
									<TableCell>{row.count}</TableCell>
									<TableCell>{row.successes}</TableCell>
									<TableCell>{(row.successRate * 100).toFixed(0)}%</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
