import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, PauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "#/components/thesis/metric-card";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { Separator } from "#/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { useRunSocket } from "#/hooks/use-run-socket";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";

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
		refetchInterval: 5000,
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

	if (!run.data) {
		return (
			<PageHeading
				title="Run"
				description="Loading the selected run, attempts, step results, and logs."
			/>
		);
	}

	const detail = run.data;
	const progress =
		detail.summary?.attemptsUsed ??
		Math.min(detail.attempts.length, detail.maxAttempts);
	const active = ["queued", "running", "pausing"].includes(detail.status);
	const resumable = detail.status === "paused";

	return (
		<>
			<PageHeading
				title={detail.scenarioName}
				description={`${detail.attackerModelName} → ${detail.benignModelName} under ${detail.defenseName}`}
				action={
					<div className="flex flex-wrap gap-2">
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
							<Button
								variant="outline"
								onClick={() => pauseRun.mutate()}
								disabled={pauseRun.isPending}
							>
								<PauseIcon data-icon="inline-start" />
								Pause
							</Button>
						) : null}
						{resumable ? (
							<Button
								onClick={() => resumeRun.mutate()}
								disabled={resumeRun.isPending}
							>
								<PlayIcon data-icon="inline-start" />
								Resume
							</Button>
						) : null}
					</div>
				}
			/>

			<section className="grid gap-4 md:grid-cols-4">
				<MetricCard
					label="Status"
					value={detail.status}
					description={detail.error || "Persistent status from the worker."}
				/>
				<MetricCard
					label="Attempts"
					value={`${progress}/${detail.maxAttempts}`}
					description="Attempt checkpoints persisted for recovery."
				/>
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
			</section>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<StatusBadge status={detail.status} />
						Run progress
					</CardTitle>
					<CardDescription>
						Live updates arrive over Socket.IO and are also persisted in SQLite.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Progress value={(progress / detail.maxAttempts) * 100} />
					<div className="grid gap-3 text-sm md:grid-cols-3">
						<p className="m-0 text-muted-foreground">
							Defense mode: {detail.defenseSnapshot.mode}
						</p>
						<p className="m-0 text-muted-foreground">
							Top K: {detail.retrievalSettings.topK}
						</p>
						<p className="m-0 text-muted-foreground">
							Query:{" "}
							{detail.retrievalSettings.query ||
								detail.scenarioSnapshot.retrievalQuery}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Attempts</CardTitle>
					<CardDescription>
						Generated attack artifacts, retrieved context, benign response, and
						feedback for the next loop.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-5">
					{detail.attempts.map((attempt) => {
						const stepResults = detail.stepResults.filter(
							(step) => step.attemptId === attempt.id,
						);
						return (
							<div
								key={attempt.id}
								className="flex flex-col gap-3 rounded-lg border p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<h2 className="m-0 text-base font-semibold">
											Attempt {attempt.attemptNumber}
										</h2>
										<p className="m-0 text-sm text-muted-foreground">
											{attempt.status} · success {String(attempt.success)} ·
											utility {attempt.utilityScore.toFixed(2)}
										</p>
									</div>
									<StatusBadge status={attempt.status} />
								</div>
								<Separator />
								<TextBlock
									title="Injection prompt"
									value={attempt.injectionPrompt}
								/>
								<TextBlock
									title="Injected document"
									value={attempt.injectedDocument}
								/>
								<TextBlock
									title="Benign response"
									value={attempt.benignResponse}
								/>
								<TextBlock title="Attacker feedback" value={attempt.feedback} />
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Step</TableHead>
											<TableHead>Passed</TableHead>
											<TableHead>Score</TableHead>
											<TableHead>Output</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{stepResults.map((step) => (
											<TableRow key={step.id}>
												<TableCell>{step.stepSnapshot.name}</TableCell>
												<TableCell>{String(step.passed)}</TableCell>
												<TableCell>{step.score.toFixed(2)}</TableCell>
												<TableCell>{step.evaluatorOutput}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						);
					})}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Persistent logs</CardTitle>
					<CardDescription>
						Chronological worker events captured for reproducibility.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Time</TableHead>
								<TableHead>Level</TableHead>
								<TableHead>Event</TableHead>
								<TableHead>Message</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{detail.logs.map((log) => (
								<TableRow key={log.id}>
									<TableCell>
										{new Date(log.createdAt).toLocaleTimeString()}
									</TableCell>
									<TableCell>{log.level}</TableCell>
									<TableCell>{log.eventType}</TableCell>
									<TableCell>{log.message}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

function TextBlock({ title, value }: { title: string; value: string }) {
	if (!value) {
		return null;
	}

	return (
		<div className="flex flex-col gap-1">
			<h3 className="m-0 text-sm font-medium">{title}</h3>
			<pre className="m-0 max-h-48 overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
				{value}
			</pre>
		</div>
	);
}
