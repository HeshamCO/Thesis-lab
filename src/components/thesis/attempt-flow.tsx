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
	pass: "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]",
	fail: "bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-destructive",
	warn: "bg-[color-mix(in_oklch,var(--warning)_14%,transparent)] text-[var(--warning)]",
	info: "bg-muted text-muted-foreground",
	running: "bg-[color-mix(in_oklch,var(--info)_14%,transparent)] text-[var(--info)]",
};

const TONE_RAIL: Record<Tone, string> = {
	pass: "bg-[var(--success)] text-[var(--success)]",
	fail: "bg-destructive text-destructive",
	warn: "bg-[var(--warning)] text-[var(--warning)]",
	info: "bg-border text-muted-foreground",
	running: "bg-[var(--info)] text-[var(--info)]",
};

const TONE_TEXT: Record<Tone, string> = {
	pass: "text-[var(--success)]",
	fail: "text-destructive",
	warn: "text-[var(--warning)]",
	info: "text-muted-foreground",
	running: "text-[var(--info)]",
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
				"flex scroll-mt-24 flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-colors",
				isFocused && "border-ring/60 ring-1 ring-ring/30",
			)}
		>
			<AttemptHeader attempt={attempt} headline={headline} />
			<div className="flex flex-col">
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

				<PhaseCard
					number={4}
					icon={MessageSquareIcon}
					title="Benign response"
					meta={`${formatDurationMs(attempt.benignDurationMs)} · ${attempt.benignResponse.length.toLocaleString()} chars`}
					narrative={narrateBenign(attempt, benignLog)}
					tone="info"
					defaultOpen
				>
					<BenignResponseView attempt={attempt} stepResults={stepResults} />
				</PhaseCard>

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
		<header className="flex flex-col gap-1.5 border-b border-border/60 pb-3">
			<div className="flex flex-wrap items-center gap-2">
				<ToneIcon tone={headline.tone} className="size-5" />
				<h3 className="m-0 text-base font-semibold">{headline.title}</h3>
				<span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
					<span className="inline-flex items-center gap-1 tabular-nums">
						<ClockIcon className="size-3.5" />
						{formatDurationMs(attempt.totalDurationMs)}
					</span>
					<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE_CHIP[headline.tone])}>
						{headline.tone === "pass"
							? "Attack succeeded"
							: headline.tone === "fail"
								? "Did not pass"
								: headline.tone === "running"
									? "Running"
									: headline.tone === "warn"
										? "Partial"
										: attempt.status}
					</span>
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
		<Collapsible open={open} onOpenChange={setOpen} className="group/phase relative flex flex-col py-3 first:pt-0">
			<div className="flex gap-3">
				<div className="flex flex-col items-center pt-0.5">
					<span className={cn("text-xs font-semibold tabular-nums", TONE_TEXT[tone])} aria-hidden>
						{number}
					</span>
					<span className={cn("mt-1 w-px flex-1", TONE_RAIL[tone], "opacity-30")} aria-hidden />
				</div>
				<div className="flex flex-1 flex-col gap-1 pb-1">
					<div className="flex flex-wrap items-center gap-2">
						<Icon className={cn("size-4", TONE_TEXT[tone])} aria-hidden />
						<span className="text-sm font-semibold">{title}</span>
						{meta ? <span className="text-xs text-muted-foreground">· {meta}</span> : null}
						{hasContent ? (
							<CollapsibleTrigger asChild>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="ml-auto h-7 gap-1 px-2 text-xs"
									aria-controls={id}
									aria-expanded={open}
								>
									<ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
									{open ? "Hide" : "Details"}
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

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
	switch (tone) {
		case "pass":
			return <CircleCheckIcon className={cn("text-[var(--success)]", className)} />;
		case "fail":
			return <CircleXIcon className={cn("text-destructive", className)} />;
		case "warn":
			return <CircleAlertIcon className={cn("text-[var(--warning)]", className)} />;
		case "running":
			return <ClockIcon className={cn("text-[var(--info)]", className)} />;
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
					className="flex flex-col items-start gap-1 rounded-md bg-muted p-2.5 text-left text-sm transition-colors hover:bg-accent"
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
					className="flex items-start gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm"
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
					className="flex items-start gap-2 rounded-md bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] px-2.5 py-1.5 text-sm"
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
						"flex items-start gap-2 rounded-md px-2.5 py-2 text-sm",
						step.passed
							? "bg-[color-mix(in_oklch,var(--success)_8%,transparent)]"
							: step.stepSnapshot.required
								? "bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)]"
								: "bg-[color-mix(in_oklch,var(--warning)_8%,transparent)]",
					)}
				>
					{step.passed ? (
						<CircleCheckIcon className="mt-0.5 size-4 text-[var(--success)]" />
					) : (
						<CircleXIcon
							className={cn("mt-0.5 size-4", step.stepSnapshot.required ? "text-destructive" : "text-[var(--warning)]")}
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
			? "bg-[color-mix(in_oklch,var(--destructive)_14%,transparent)] text-destructive"
			: "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]";
	return (
		<span
			className={cn(
				"inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium uppercase tracking-wide",
				tone,
			)}
		>
			{source}
		</span>
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
						? "bg-[color-mix(in_oklch,var(--success)_8%,transparent)]"
						: call.status === "blocked_by_defense"
							? "bg-[color-mix(in_oklch,var(--warning)_8%,transparent)]"
							: "bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)]";
				const statusLabel = call.status === "ok" ? "ok" : call.status === "blocked_by_defense" ? "blocked" : "error";
				return (
					<li key={call.id} className={cn("flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm", tone)}>
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

function BenignResponseView({ attempt, stepResults }: { attempt: AttemptRecord; stepResults: StepResultRecord[] }) {
	const [showRaw, setShowRaw] = useState(false);
	const parsedOk = attempt.benignStructuredParseOk === true;
	const hasStructured = parsedOk && typeof attempt.benignTaskAnswer === "string";

	if (!hasStructured) {
		return (
			<HighlightedText
				text={attempt.benignResponse}
				steps={stepResults}
				emptyText="The benign model returned no text."
				className="max-h-72 overflow-auto"
			/>
		);
	}

	const flags: Array<{ label: string; value: boolean | null }> = [
		{ label: "suspicious_instruction_detected", value: attempt.benignSuspiciousInstructionDetected },
		{ label: "tool_called", value: attempt.benignToolCalledSelfReport },
		{ label: "sensitive_data_exposed", value: attempt.benignSensitiveDataExposed },
	];

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<Badge variant="outline" className="text-[10px]">
					structured
				</Badge>
				{attempt.benignUsedDocs && attempt.benignUsedDocs.length > 0 ? (
					<span className="text-xs text-muted-foreground">used docs: {attempt.benignUsedDocs.join(", ")}</span>
				) : null}
				<button
					type="button"
					onClick={() => setShowRaw((v) => !v)}
					className="ml-auto text-xs text-muted-foreground underline"
				>
					{showRaw ? "Show parsed" : "Show raw"}
				</button>
			</div>
			{showRaw ? (
				<HighlightedText
					text={attempt.benignResponse}
					steps={stepResults}
					emptyText="The benign model returned no text."
					className="max-h-72 overflow-auto"
				/>
			) : (
				<>
					<HighlightedText
						text={attempt.benignTaskAnswer ?? ""}
						steps={stepResults}
						emptyText="The benign model returned an empty task_answer."
						className="max-h-72 overflow-auto"
					/>
					<dl className="grid grid-cols-1 gap-1 rounded-md border border-dashed p-3 text-xs md:grid-cols-3">
						{flags.map((flag) => (
							<div key={flag.label} className="flex items-center gap-2">
								<dt className="font-mono text-muted-foreground">{flag.label}</dt>
								<dd
									className={cn(
										"font-mono",
										flag.value === true && "text-red-600 dark:text-red-400",
										flag.value === false && "text-emerald-600 dark:text-emerald-400",
										flag.value === null && "text-muted-foreground",
									)}
								>
									{flag.value === null ? "—" : String(flag.value)}
								</dd>
							</div>
						))}
					</dl>
				</>
			)}
		</div>
	);
}
