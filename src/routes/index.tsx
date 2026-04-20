import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityIcon, ArrowRightIcon, BotIcon, ShieldIcon, TargetIcon } from "lucide-react";
import { MetricCard } from "#/components/thesis/metric-card";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
	const dashboard = useQuery({
		queryKey: queryKeys.dashboard,
		queryFn: api.dashboard,
		refetchInterval: 3000,
	});
	const data = dashboard.data;

	return (
		<>
			<PageHeading
				title="Experiment dashboard"
				description="Monitor active work, recent results, and the research objects available for prompt-injection experiments."
				action={
					<Button asChild>
						<Link to="/runs">
							<ActivityIcon data-icon="inline-start" />
							Start run
						</Link>
					</Button>
				}
			/>

			<section className="grid gap-3 md:grid-cols-4">
				<MetricCard
					label="Scenarios"
					value={data?.scenarioCount ?? "—"}
					description="Benign tasks, attacker goals, corpus docs, and success steps."
					icon={TargetIcon}
				/>
				<MetricCard
					label="Models"
					value={data?.modelCount ?? "—"}
					description="OpenAI-compatible endpoints referenced by role."
					icon={BotIcon}
				/>
				<MetricCard
					label="Defenses"
					value={data?.defenseCount ?? "—"}
					description="Prompt guards and retrieval filters ready for runs."
					icon={ShieldIcon}
				/>
				<MetricCard
					label="Runs"
					value={data?.runCount ?? "—"}
					description="Persisted attempts, logs, snapshots, and summaries."
					icon={ActivityIcon}
				/>
			</section>

			<Card>
				<CardHeader>
					<CardTitle>Active run</CardTitle>
					<CardDescription>One active run is supported in v1 to keep checkpoint recovery simple.</CardDescription>
				</CardHeader>
				<CardContent>
					{data?.activeRun ? (
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2">
										<StatusBadge status={data.activeRun.status} />
										<span className="font-medium">{data.activeRun.scenarioName}</span>
									</div>
									<p className="m-0 text-sm text-muted-foreground">
										{data.activeRun.attackerModelName} attacking {data.activeRun.benignModelName} with{" "}
										{data.activeRun.defenseName}
									</p>
								</div>
								<Button variant="outline" asChild>
									<Link to="/runs/$runId" params={{ runId: data.activeRun.id }}>
										Open run
										<ArrowRightIcon data-icon="inline-end" />
									</Link>
								</Button>
							</div>
							<Progress
								value={
									data.activeRun.summary?.attemptsUsed
										? (data.activeRun.summary.attemptsUsed / data.activeRun.maxAttempts) * 100
										: 0
								}
							/>
						</div>
					) : (
						<p className="m-0 text-sm text-muted-foreground">No active run. Start one from the runs workspace.</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent runs</CardTitle>
					<CardDescription>Last persisted runs with final success and utility score when available.</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Scenario</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Attempts</TableHead>
								<TableHead>Success</TableHead>
								<TableHead>Utility</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(data?.recentRuns ?? []).map((run) => (
								<TableRow key={run.id}>
									<TableCell>{run.scenarioName}</TableCell>
									<TableCell>
										<StatusBadge status={run.status} />
									</TableCell>
									<TableCell>
										{run.summary?.attemptsUsed ?? 0}/{run.maxAttempts}
									</TableCell>
									<TableCell>{run.summary ? String(run.summary.finalSuccess) : "—"}</TableCell>
									<TableCell>{run.summary ? run.summary.utilityScore.toFixed(2) : "—"}</TableCell>
									<TableCell>
										<Button variant="ghost" size="sm" asChild>
											<Link to="/runs/$runId" params={{ runId: run.id }}>
												View
											</Link>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}
