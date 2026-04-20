import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ArtifactPanel, type ArtifactPanelPayload } from "#/components/thesis/artifact-panel";
import { HelpDrawer } from "#/components/thesis/help-drawer";
import { MetricCard } from "#/components/thesis/metric-card";
import { PageHeading } from "#/components/thesis/page-heading";
import { RunArtifacts } from "#/components/thesis/run-artifacts";
import { RunLogs } from "#/components/thesis/run-logs";
import { RunTree } from "#/components/thesis/run-tree";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { useRunSocket } from "#/hooks/use-run-socket";
import { api } from "#/lib/thesis/api";
import { narrateRun } from "#/lib/thesis/attempt-narrative";
import { queryKeys } from "#/lib/thesis/query";
import { computeRunStats, formatDurationMs, formatPercent } from "#/lib/thesis/run-stats";
import type { RunDetail } from "#/lib/thesis/schemas";

export const Route = createFileRoute("/runs/$runId")({
	component: RunDetailPage,
});

function RunDetailPage() {
	const { runId } = Route.useParams();
	useRunSocket(runId);
	const queryClient = useQueryClient();
	const run = useQuery({
		queryKey: queryKeys.run(runId),
		queryFn: () => api.run(runId),
	});
	const pauseRun = useMutation({
		mutationFn: () => api.pauseRun(runId),
		onSuccess: (updated) => {
			queryClient.setQueryData(queryKeys.run(runId), updated);
			toast.success("Pause requested");
		},
		onError: (error) => toast.error(error.message),
	});
	const resumeRun = useMutation({
		mutationFn: () => api.resumeRun(runId),
		onSuccess: (updated) => {
			queryClient.setQueryData(queryKeys.run(runId), updated);
			toast.success("Run resumed");
		},
		onError: (error) => toast.error(error.message),
	});
	const [panel, setPanel] = useState<ArtifactPanelPayload | null>(null);

	if (!run.data) {
		return <PageHeading title="Run" description="Loading the selected run, attempts, step results, and logs." />;
	}

	const detail = run.data;
	const progress = detail.summary?.attemptsUsed ?? Math.min(detail.attempts.length, detail.maxAttempts);
	const active = ["queued", "running", "pausing"].includes(detail.status);
	const resumable = detail.status === "paused";

	return (
		<>
			<PageHeading
				title={detail.scenarioName}
				description={`${detail.attackerModelName} → ${detail.benignModelName} under ${detail.defenseName}`}
				backButton="runs"
				action={
					<div className="flex flex-wrap items-center gap-2">
						<HelpDrawer />
						<Button variant="outline" asChild>
							<a href={`/api/runs/${detail.id}/export.json`}>
								<DownloadIcon data-icon="inline-start" />
								JSON
							</a>
						</Button>
						<Button variant="outline" asChild>
							<a href={`/api/runs/${detail.id}/export.csv`}>
								<DownloadIcon data-icon="inline-start" />
								CSV
							</a>
						</Button>
						{active ? (
							<Button variant="outline" onClick={() => pauseRun.mutate()} disabled={pauseRun.isPending}>
								<PauseIcon data-icon="inline-start" />
								Pause
							</Button>
						) : null}
						{resumable ? (
							<Button onClick={() => resumeRun.mutate()} disabled={resumeRun.isPending}>
								<PlayIcon data-icon="inline-start" />
								Resume
							</Button>
						) : null}
					</div>
				}
			/>

			<Tabs defaultValue="tree" className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="tree">Attempts</TabsTrigger>
					<TabsTrigger value="artifacts">Artifacts</TabsTrigger>
					<TabsTrigger value="logs">Logs</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="flex flex-col gap-4">
					<OverviewTab detail={detail} progress={progress} />
				</TabsContent>

				<TabsContent value="tree" className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<h2 className="m-0 text-base font-semibold">Attempt walkthrough</h2>
					</div>
					<RunTree detail={detail} onSelect={setPanel} />
				</TabsContent>

				<TabsContent value="artifacts">
					<Card>
						<CardHeader>
							<CardTitle>Artifacts</CardTitle>
							<CardDescription>
								Every attacker artifact and retrieved document for this run, sorted by time created.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<RunArtifacts detail={detail} onSelect={setPanel} />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="logs">
					<Card>
						<CardHeader>
							<CardTitle>Persistent logs</CardTitle>
							<CardDescription>
								Chronological worker events captured for reproducibility. Filter and expand payloads for analysis.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<RunLogs logs={detail.logs} />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<ArtifactPanel payload={panel} onClose={() => setPanel(null)} />
		</>
	);
}

function OverviewTab({ detail, progress }: { detail: RunDetail; progress: number }) {
	const stats = computeRunStats(detail);
	const summary = narrateRun(detail);
	const progressPct = (progress / detail.maxAttempts) * 100;
	return (
		<>
			<div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<StatusBadge status={detail.status} />
						<span className="text-sm text-muted-foreground">
							Attempt{" "}
							<span className="font-medium text-foreground tabular-nums">
								{progress}/{detail.maxAttempts}
							</span>
						</span>
					</div>
					<span className="text-xs text-muted-foreground tabular-nums">{progressPct.toFixed(0)}% complete</span>
				</div>
				<Progress value={progressPct} />
				<dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-3">
					<ConfigRow label="Defense mode" value={detail.defenseSnapshot.mode} />
					<ConfigRow label="Top K" value={String(detail.retrievalSettings.topK)} />
					<ConfigRow
						label="Query"
						value={detail.retrievalSettings.query || detail.scenarioSnapshot.retrievalQuery || "—"}
					/>
				</dl>
			</div>

			<section className="grid gap-3 md:grid-cols-4">
				<MetricCard
					label="Final success"
					value={detail.summary ? String(detail.summary.finalSuccess) : "—"}
					description="True only when every required step passed."
				/>
				<MetricCard
					label="Utility"
					value={detail.summary ? detail.summary.utilityScore.toFixed(2) : "—"}
					description="Average final-attempt evaluator score."
				/>
				<MetricCard
					label="Total duration"
					value={formatDurationMs(stats.totalDurationMs)}
					description="Sum of completed attempt durations."
				/>
				<MetricCard
					label="Avg attempt"
					value={formatDurationMs(stats.avgAttemptDurationMs)}
					description={`attack ${formatDurationMs(stats.avgAttackDurationMs)} · benign ${formatDurationMs(stats.avgBenignDurationMs)}`}
				/>
			</section>

			<section className="grid gap-3 md:grid-cols-2">
				<MetricCard
					label="Defense filter hit rate"
					value={formatPercent(stats.defenseFilterHitRate)}
					description={`${stats.defenseFilteredCount} document(s) filtered across ${stats.completedAttempts} attempt(s).`}
				/>
				<MetricCard
					label="Parse failures"
					value={`${stats.attackerParseFailures} / ${stats.judgeParseFailures}`}
					description="Attacker JSON / LLM judge JSON parse failures. Filter logs by warn level for raw outputs."
				/>
			</section>

			<Card>
				<CardHeader>
					<CardTitle>Summary</CardTitle>
					<CardDescription>
						Auto-generated narrative of this run. See the Attempts tab for the per-attempt walkthrough.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="m-0 text-sm leading-relaxed text-foreground/90">{summary}</p>
				</CardContent>
			</Card>
		</>
	);
}

function ConfigRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5 min-w-0">
			<dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
			<dd className="m-0 truncate text-sm text-foreground">{value}</dd>
		</div>
	);
}
