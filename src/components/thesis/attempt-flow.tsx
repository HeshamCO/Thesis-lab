import {
	BotIcon,
	ChevronDownIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	CircleXIcon,
	ClockIcon,
	type LucideIcon,
	MessageSquareIcon,
	ScrollTextIcon,
	SearchIcon,
	ShieldIcon,
	WrenchIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible";
import { cn } from "#/lib/utils";
import {
	type AttemptHeadline,
	narrateAttacker,
	narrateAttempt,
	narrateBenign,
	narrateDefense,
	narrateFeedback,
	narrateRetrieval,
	narrateStepResult,
	narrateSteps,
	narrateToolCalls,
	preview,
} from "#/lib/thesis/attempt-narrative";
import { artifactKindLabel, artifactKindOrder, getAttemptNumber } from "#/lib/thesis/run-tree";
import { formatDurationMs } from "#/lib/thesis/run-stats";
import type {
	AttackerArtifact,
	AttemptRecord,
	RunDetail,
	RunLogRecord,
	StepResultRecord,
	ToolCallRecord,
} from "#/lib/thesis/schemas";
import type { ArtifactPanelPayload } from "./artifact-panel";
import { HighlightedText } from "./highlighted-text";

type Tone = AttemptHeadline["tone"];

type Props = {
	detail: RunDetail;
	attempt: AttemptRecord;
	id?: string;
	onSelect: (payload: ArtifactPanelPayload) => void;
	isFocused?: boolean;
};

const TONE_CHIP: Record<Tone, string> = {
	pass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
	fail: "bg-destructive/15 text-destructive border-destructive/40",
	warn: "bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-300",
	info: "bg-muted text-muted-foreground border-border",
	running: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300",
};

const TONE_RAIL: Record<Tone, string> = {
	pass: "border-emerald-500/60 text-emerald-600 dark:text-emerald-400",
	fail: "border-destructive/70 text-destructive",
	warn: "border-amber-500/60 text-amber-600 dark:text-amber-400",
	info: "border-border text-muted-foreground",
	running: "border-sky-500/60 text-sky-600 dark:text-sky-400",
};

const ATTEMPT_LOG_EVENTS = ["retrieval.queried", "defense.applied", "benign.responded"] as const;

export function AttemptFlow({ detail, attempt, id, onSelect, isFocused }: Props) {
	const headline = narrateAttempt(detail, attempt);
	const stepResults = useMemo(
		() =>
			(detail.stepResults ?? [])
				.filter((step) => step.attemptId === attempt.id)
				.sort((a, b) => a.orderIndex - b.orderIndex),
		[attempt.id, detail.stepResults],
	);
	const artifacts = useMemo(
		() => (detail.attackerArtifacts ?? []).filter((artifact) => artifact.attemptId === attempt.id),
		[attempt.id, detail.attackerArtifacts],
	);
	const toolCalls = useMemo(
		() =>
			(detail.toolCalls ?? [])
				.filter((call) => call.attemptId === attempt.id)
				.sort((a, b) => a.turn - b.turn || Date.parse(a.createdAt) - Date.parse(b.createdAt)),
		[attempt.id, detail.toolCalls],
	);
	const attemptLogs = useMemo(() => {
		const latest: Partial<Record<(typeof ATTEMPT_LOG_EVENTS)[number], RunLogRecord>> = {};
		for (const log of detail.logs ?? []) {
			if (getAttemptNumber(log) !== attempt.attemptNumber) {
				continue;
			}
			for (const eventType of ATTEMPT_LOG_EVENTS) {
				if (log.eventType === eventType) {
					latest[eventType] = log;
					break;
				}
			}
		}
		return latest;
	}, [attempt.attemptNumber, detail.logs]);
	const retrievalLog = attemptLogs["retrieval.queried"] ?? null;
	const defenseLog = attemptLogs["defense.applied"] ?? null;
	const benignLog = attemptLogs["benign.responded"] ?? null;

	return (
		<section
			id={id}
			aria-label={`Attempt ${attempt.attemptNumber}`}
			className={cn(
				"flex scroll-mt-24 flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow",
				isFocused && "ring-2 ring-primary/40",
			)}
		>
			<AttemptHeader attempt={attempt} headline={headline} />
			<div className="flex flex-col gap-2">
				<PhaseCard
					number={1}
					icon={BotIcon}
					title="Attacker model"
					meta={`${formatDurationMs(attempt.attackDurationMs)} · ${attempt.rawAttackerParseOk ? "parsed" : "parse failed"}`}
					narrative={narrateAttacker(attempt)}
					tone={attempt.rawAttackerParseOk ? "info" : "warn"}
				>
					<AttackerArtifacts attempt={attempt} artifacts={artifacts} runId={detail.id} onSelect={onSelect} />
				</PhaseCard>

				<PhaseConnector />

				<PhaseCard
					number={2}
					icon={SearchIcon}
					title="Retrieval"
					meta={`k=${detail.retrievalSettings.topK}`}
					narrative={narrateRetrieval(attempt, retrievalLog, detail.retrievalSettings.topK)}
					tone="info"
				>
					<RetrievalList attempt={attempt} retrievalLog={retrievalLog} onSelect={onSelect} />
				</PhaseCard>

				<PhaseConnector />

				<PhaseCard
					number={3}
					icon={ShieldIcon}
					title="Defense"
					meta={`mode=${detail.defenseSnapshot.mode}`}
					narrative={narrateDefense(attempt, defenseLog, detail.defenseSnapshot.mode)}
					tone={attempt.defenseFilteredCount > 0 ? "warn" : "info"}
				>
					<DefenseList defenseLog={defenseLog} onSelect={onSelect} />
				</PhaseCard>

				<PhaseConnector />

				<PhaseCard
					number={4}
					icon={MessageSquareIcon}
					title="Benign response"
					meta={`${formatDurationMs(attempt.benignDurationMs)} · ${attempt.benignResponse.length.toLocaleString()} chars`}
					narrative={narrateBenign(attempt, benignLog)}
					tone="info"
					defaultOpen
				>
					<HighlightedText
						text={attempt.benignResponse}
						steps={stepResults}
						emptyText="The benign model returned no text."
						className="max-h-72 overflow-auto"
					/>
				</PhaseCard>

				<PhaseConnector />

				<PhaseCard
					number={5}
					icon={WrenchIcon}
					title="Tool calls"
					meta={toolCalls.length === 0 ? "no calls" : `${toolCalls.length} call${toolCalls.length === 1 ? "" : "s"}`}
					narrative={narrateToolCalls(toolCalls)}
					tone={
						toolCalls.length === 0
							? "info"
							: toolCalls.some((call) => call.status === "error" || call.status === "blocked_by_defense")
								? "warn"
								: "info"
					}
					defaultOpen={toolCalls.length > 0}
				>
					<ToolCallList toolCalls={toolCalls} onSelect={onSelect} attempt={attempt} />
				</PhaseCard>

				<PhaseConnector />

				<PhaseCard
					number={6}
					icon={CircleCheckIcon}
					title="Step results"
					meta={`${stepResults.filter((step) => step.passed).length}/${stepResults.length} passed`}
					narrative={narrateSteps(stepResults)}
					tone={
						stepResults.length === 0
							? "info"
							: stepResults.every((step) => step.passed)
								? "pass"
								: stepResults.some((step) => !step.passed && step.stepSnapshot.required)
									? "fail"
									: "warn"
					}
					defaultOpen
				>
					<StepList steps={stepResults} onSelect={onSelect} />
				</PhaseCard>

				<PhaseConnector />

				<PhaseCard
					number={7}
					icon={ScrollTextIcon}
					title="Feedback to next attempt"
					meta={attempt.feedback ? `${attempt.feedback.length.toLocaleString()} chars` : "—"}
					narrative={narrateFeedback(attempt)}
					tone="info"
				>
					{attempt.feedback ? (
						<pre className="m-0 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap break-words">
							{attempt.feedback}
						</pre>
					) : (
						<p className="m-0 text-sm text-muted-foreground italic">No feedback recorded.</p>
					)}
				</PhaseCard>
			</div>
		</section>
	);
}

function AttemptHeader({ attempt, headline }: { attempt: AttemptRecord; headline: AttemptHeadline }) {
	return (
		<header className="flex flex-col gap-1">
			<div className="flex flex-wrap items-center gap-2">
				<ToneIcon tone={headline.tone} className="size-5" />
				<h3 className="m-0 text-base font-semibold">{headline.title}</h3>
				<span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
					<span className="inline-flex items-center gap-1">
						<ClockIcon className="size-3.5" />
						{formatDurationMs(attempt.totalDurationMs)}
					</span>
					<Badge variant="outline" className={cn("border", TONE_CHIP[headline.tone])}>
						{headline.tone === "pass"
							? "Attack succeeded"
							: headline.tone === "fail"
								? "Did not pass"
								: headline.tone === "running"
									? "Running"
									: headline.tone === "warn"
										? "Partial"
										: attempt.status}
					</Badge>
				</span>
			</div>
			<p className="m-0 ml-7 text-sm text-muted-foreground">{headline.body}</p>
		</header>
	);
}

function PhaseCard({
	number,
	icon: Icon,
	title,
	meta,
	narrative,
	tone,
	defaultOpen,
	children,
}: {
	number: number;
	icon: LucideIcon;
	title: string;
	meta?: string;
	narrative: string;
	tone: Tone;
	defaultOpen?: boolean;
	children?: React.ReactNode;
}) {
	const id = useId();
	const [open, setOpen] = useState(Boolean(defaultOpen));
	const hasContent = Boolean(children);
	return (
		<Collapsible open={open} onOpenChange={setOpen} className="flex flex-col">
			<div className="flex gap-3">
				<div
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold",
						TONE_RAIL[tone],
					)}
					aria-hidden
				>
					{number}
				</div>
				<div className="flex flex-1 flex-col gap-1 rounded-md border bg-background p-3">
					<div className="flex flex-wrap items-center gap-2">
						<Icon className={cn("size-4", TONE_RAIL[tone])} aria-hidden />
						<span className="text-sm font-semibold">{title}</span>
						{meta ? <span className="text-xs text-muted-foreground">· {meta}</span> : null}
						{hasContent ? (
							<CollapsibleTrigger asChild>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="ml-auto h-7 gap-1 text-xs"
									aria-controls={id}
									aria-expanded={open}
								>
									<ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
									{open ? "Hide details" : "Show details"}
								</Button>
							</CollapsibleTrigger>
						) : null}
					</div>
					<p className="m-0 text-sm text-foreground/90">{narrative}</p>
					{hasContent ? (
						<CollapsibleContent id={id} className="pt-2">
							{children}
						</CollapsibleContent>
					) : null}
				</div>
			</div>
		</Collapsible>
	);
}

function PhaseConnector() {
	return (
		<div className="flex" aria-hidden>
			<div className="flex w-8 justify-center">
				<span className="block h-3 w-px bg-border" />
			</div>
			<div className="flex-1" />
		</div>
	);
}

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
	switch (tone) {
		case "pass":
			return <CircleCheckIcon className={cn("text-emerald-600 dark:text-emerald-400", className)} />;
		case "fail":
			return <CircleXIcon className={cn("text-destructive", className)} />;
		case "warn":
			return <CircleAlertIcon className={cn("text-amber-600 dark:text-amber-400", className)} />;
		case "running":
			return <ClockIcon className={cn("text-sky-600 dark:text-sky-400", className)} />;
		default:
			return null;
	}
}

function AttackerArtifacts({
	attempt,
	artifacts,
	runId,
	onSelect,
}: {
	attempt: AttemptRecord;
	artifacts: readonly AttackerArtifact[];
	runId: string;
	onSelect: (payload: ArtifactPanelPayload) => void;
}) {
	if (artifacts.length === 0) {
		return null;
	}
	const ordered = [...artifacts].sort((a, b) => artifactKindOrder(a.kind) - artifactKindOrder(b.kind));
	return (
		<div className="flex flex-col gap-2">
			{ordered.map((artifact) => (
				<button
					key={artifact.id}
					type="button"
					onClick={() =>
						onSelect({
							id: artifact.id,
							title: artifact.title,
							subtitle: `Attempt ${attempt.attemptNumber} · ${artifactKindLabel(artifact.kind)}`,
							tags: [`kind=${artifact.kind}`, `attempt=${attempt.attemptNumber}`],
							body: artifact.content,
							contentType: artifact.kind === "raw_output" ? "json" : "text",
							openUrl: `/api/runs/${runId}/attempts/${attempt.id}/artifacts/${artifact.id}`,
						})
					}
					className="flex flex-col items-start gap-1 rounded-md border bg-muted/30 p-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/60"
				>
					<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{artifactKindLabel(artifact.kind)}
					</span>
					<span className="text-sm leading-snug">{preview(artifact.content, 220) || "(empty)"}</span>
				</button>
			))}
		</div>
	);
}

function RetrievalList({
	attempt,
	retrievalLog,
	onSelect,
}: {
	attempt: AttemptRecord;
	retrievalLog: RunLogRecord | null;
	onSelect: (payload: ArtifactPanelPayload) => void;
}) {
	const docsFromLog = retrievalLog?.payload?.documents as
		| Array<{ rank: number; title: string; source: string }>
		| undefined;
	const docs =
		attempt.retrievedContext.length > 0
			? attempt.retrievedContext.map((document, index) => ({
					rank: docsFromLog?.[index]?.rank ?? index + 1,
					title: document.title,
					source: document.source,
					content: document.content,
				}))
			: (docsFromLog ?? []).map((document) => ({
					rank: document.rank,
					title: document.title,
					source: document.source,
					content: "",
				}));

	if (docs.length === 0) {
		return <p className="m-0 text-sm text-muted-foreground italic">No documents were retrieved this attempt.</p>;
	}

	return (
		<ol className="m-0 flex flex-col gap-1.5 p-0">
			{docs.map((document) => (
				<li
					key={`${document.rank}-${document.title}`}
					className="flex items-start gap-2 rounded-md border bg-background px-2 py-1.5 text-sm"
				>
					<span className="font-mono text-xs text-muted-foreground tabular-nums">#{document.rank}</span>
					<SourceBadge source={document.source} />
					<div className="flex-1 min-w-0">
						<button
							type="button"
							onClick={() =>
								onSelect({
									id: `retrieved:${attempt.id}:${document.rank}`,
									title: document.title,
									subtitle: `Attempt ${attempt.attemptNumber} · ${document.source} · rank #${document.rank}`,
									tags: [`source=${document.source}`, `rank=${document.rank}`],
									body: document.content || "(content unavailable)",
									contentType: "text",
								})
							}
							className="m-0 truncate text-left text-sm hover:underline"
						>
							{document.title}
						</button>
					</div>
				</li>
			))}
		</ol>
	);
}

function DefenseList({
	defenseLog,
	onSelect,
}: {
	defenseLog: RunLogRecord | null;
	onSelect: (payload: ArtifactPanelPayload) => void;
}) {
	const dropped = defenseLog?.payload?.dropped as Array<{ title: string; source: string; pattern: string }> | undefined;
	if (!dropped || dropped.length === 0) {
		return <p className="m-0 text-sm text-muted-foreground italic">No documents were filtered.</p>;
	}
	return (
		<ul className="m-0 flex flex-col gap-1.5 p-0">
			{dropped.map((entry, index) => (
				<li
					key={`${entry.title}-${index}`}
					className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-sm"
				>
					<SourceBadge source={entry.source} />
					<div className="flex-1 min-w-0">
						<p className="m-0 truncate text-sm font-medium">{entry.title}</p>
						<p className="m-0 truncate text-xs text-muted-foreground">
							matched <code className="rounded bg-muted px-1">/{entry.pattern}/</code>
						</p>
					</div>
					<button
						type="button"
						onClick={() =>
							onSelect({
								id: `defense-drop:${index}`,
								title: `Filtered: ${entry.title}`,
								subtitle: `Pattern matched: /${entry.pattern}/`,
								tags: [`source=${entry.source}`, `pattern=${entry.pattern}`],
								body: `Title: ${entry.title}\nSource: ${entry.source}\nPattern: /${entry.pattern}/`,
								contentType: "text",
							})
						}
						className="text-xs text-muted-foreground underline-offset-2 hover:underline"
					>
						Details
					</button>
				</li>
			))}
		</ul>
	);
}

function StepList({
	steps,
	onSelect,
}: {
	steps: readonly StepResultRecord[];
	onSelect: (payload: ArtifactPanelPayload) => void;
}) {
	if (steps.length === 0) {
		return <p className="m-0 text-sm text-muted-foreground italic">No step results yet for this attempt.</p>;
	}
	return (
		<ul className="m-0 flex flex-col gap-1.5 p-0">
			{steps.map((step) => (
				<li
					key={step.id}
					className={cn(
						"flex items-start gap-2 rounded-md border px-2 py-2 text-sm",
						step.passed
							? "border-emerald-500/30 bg-emerald-500/5"
							: step.stepSnapshot.required
								? "border-destructive/40 bg-destructive/5"
								: "border-amber-500/30 bg-amber-500/5",
					)}
				>
					{step.passed ? (
						<CircleCheckIcon className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400" />
					) : (
						<CircleXIcon
							className={cn(
								"mt-0.5 size-4",
								step.stepSnapshot.required ? "text-destructive" : "text-amber-600 dark:text-amber-400",
							)}
						/>
					)}
					<div className="flex flex-1 flex-col gap-0.5 min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-sm font-medium">{step.stepSnapshot.name}</span>
							<Badge variant={step.stepSnapshot.required ? "default" : "outline"} className="h-5 text-[10px]">
								{step.stepSnapshot.required ? "required" : "optional"}
							</Badge>
							<Badge variant="outline" className="h-5 text-[10px]">
								{step.stepSnapshot.evaluatorType}
							</Badge>
							<span className="ml-auto text-xs text-muted-foreground tabular-nums">score {step.score.toFixed(2)}</span>
						</div>
						<p className="m-0 text-sm text-foreground/90">{narrateStepResult(step)}</p>
						{step.rawJudgeOutput ? (
							<button
								type="button"
								onClick={() =>
									onSelect({
										id: `step-${step.id}-judge`,
										title: `Raw judge output — ${step.stepSnapshot.name}`,
										subtitle: step.rawJudgeParseOk ? "Parsed cleanly" : "Failed JSON parsing",
										tags: ["raw judge output"],
										body: step.rawJudgeOutput,
										contentType: "json",
									})
								}
								className="mt-1 self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
							>
								View raw judge output
							</button>
						) : null}
					</div>
				</li>
			))}
		</ul>
	);
}

function SourceBadge({ source }: { source: string }) {
	const tone =
		source === "attacker"
			? "bg-destructive/15 text-destructive border-destructive/30"
			: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
	return (
		<Badge variant="outline" className={cn("h-5 border text-[10px] uppercase tracking-wide", tone)}>
			{source}
		</Badge>
	);
}

function ToolCallList({
	toolCalls,
	onSelect,
	attempt,
}: {
	toolCalls: readonly ToolCallRecord[];
	onSelect: (payload: ArtifactPanelPayload) => void;
	attempt: AttemptRecord;
}) {
	if (toolCalls.length === 0) {
		return <p className="m-0 text-sm text-muted-foreground italic">The model did not call any tools this attempt.</p>;
	}
	return (
		<ol className="m-0 flex flex-col gap-1.5 p-0">
			{toolCalls.map((call) => {
				const tone =
					call.status === "ok"
						? "border-emerald-500/30 bg-emerald-500/5"
						: call.status === "blocked_by_defense"
							? "border-amber-500/30 bg-amber-500/5"
							: "border-destructive/40 bg-destructive/5";
				const statusLabel = call.status === "ok" ? "ok" : call.status === "blocked_by_defense" ? "blocked" : "error";
				return (
					<li key={call.id} className={cn("flex items-start gap-2 rounded-md border px-2 py-1.5 text-sm", tone)}>
						<span className="font-mono text-xs text-muted-foreground tabular-nums">turn {call.turn}</span>
						<Badge variant="outline" className="h-5 text-[10px] uppercase">
							{statusLabel}
						</Badge>
						<div className="flex-1 min-w-0">
							<button
								type="button"
								onClick={() =>
									onSelect({
										id: call.id,
										title: `${call.toolName} (turn ${call.turn})`,
										subtitle: `Attempt ${attempt.attemptNumber} · ${call.status} · ${call.durationMs} ms`,
										tags: [`tool=${call.toolName}`, `status=${call.status}`],
										body: JSON.stringify(
											{ arguments: call.arguments, result: call.result, error: call.error || undefined },
											null,
											2,
										),
										contentType: "json",
									})
								}
								className="m-0 truncate text-left text-sm font-mono hover:underline"
							>
								{call.toolName}({preview(JSON.stringify(call.arguments), 80)})
							</button>
						</div>
						<span className="text-xs text-muted-foreground tabular-nums">{call.durationMs} ms</span>
					</li>
				);
			})}
		</ol>
	);
}
