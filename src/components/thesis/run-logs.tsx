import { CopyIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { narrateLogEvent } from "#/lib/thesis/attempt-narrative";
import { getAttemptNumber } from "#/lib/thesis/run-tree";
import type { RunLogRecord } from "#/lib/thesis/schemas";
import { cn } from "#/lib/utils";

type Props = {
	logs: RunLogRecord[];
};

const LEVEL_OPTIONS = ["all", "info", "warn", "error"] as const;

export function RunLogs({ logs }: Props) {
	const [search, setSearch] = useState("");
	const [level, setLevel] = useState<(typeof LEVEL_OPTIONS)[number]>("all");
	const [eventType, setEventType] = useState<string>("all");
	const [attemptFilter, setAttemptFilter] = useState<string>("all");

	const eventTypes = useMemo(() => {
		const set = new Set<string>();
		for (const log of logs) {
			set.add(log.eventType);
		}
		return Array.from(set).sort();
	}, [logs]);

	const attemptNumbers = useMemo(() => {
		const set = new Set<number>();
		for (const log of logs) {
			const attempt = getAttemptNumber(log);
			if (attempt !== null) {
				set.add(attempt);
			}
		}
		return Array.from(set).sort((a, b) => a - b);
	}, [logs]);

	const indexed = useMemo(
		() =>
			logs.map((log) => ({
				log,
				attemptNumber: getAttemptNumber(log),
				blob: `${log.message} ${JSON.stringify(log.payload)}`.toLowerCase(),
			})),
		[logs],
	);

	const filtered = useMemo(() => {
		const needle = search.trim().toLowerCase();
		const result: RunLogRecord[] = [];
		for (const entry of indexed) {
			const log = entry.log;
			if (level !== "all" && log.level !== level) {
				continue;
			}
			if (eventType !== "all" && log.eventType !== eventType) {
				continue;
			}
			if (attemptFilter !== "all" && String(entry.attemptNumber ?? "") !== attemptFilter) {
				continue;
			}
			if (needle && !entry.blob.includes(needle)) {
				continue;
			}
			result.push(log);
		}
		return result;
	}, [attemptFilter, eventType, indexed, level, search]);

	const copyJsonl = async () => {
		try {
			const text = filtered
				.map((log) =>
					JSON.stringify({
						createdAt: log.createdAt,
						level: log.level,
						eventType: log.eventType,
						message: log.message,
						payload: log.payload,
					}),
				)
				.join("\n");
			await navigator.clipboard.writeText(text);
			toast.success(`Copied ${filtered.length} log line(s) as JSONL`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Copy failed");
		}
	};

	return (
		<Tabs defaultValue="friendly" className="gap-3">
			<div className="flex items-center justify-between gap-2">
				<TabsList variant="line">
					<TabsTrigger value="friendly">Friendly</TabsTrigger>
					<TabsTrigger value="raw">Raw events</TabsTrigger>
				</TabsList>
				<span className="text-xs text-muted-foreground">
					{filtered.length} of {logs.length} events
				</span>
			</div>

			<TabsContent value="friendly">
				<FriendlyLogs logs={filtered} />
			</TabsContent>

			<TabsContent value="raw" className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<Input
						placeholder="Search message and payload"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="max-w-sm"
					/>
					<Select value={level} onValueChange={(value) => setLevel(value as typeof level)}>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LEVEL_OPTIONS.map((option) => (
								<SelectItem key={option} value={option}>
									level: {option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={eventType} onValueChange={setEventType}>
						<SelectTrigger className="w-56">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">event: all</SelectItem>
							{eventTypes.map((option) => (
								<SelectItem key={option} value={option}>
									event: {option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={attemptFilter} onValueChange={setAttemptFilter}>
						<SelectTrigger className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">attempt: all</SelectItem>
							{attemptNumbers.map((number) => (
								<SelectItem key={number} value={String(number)}>
									attempt: {number}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button size="sm" variant="outline" onClick={copyJsonl} disabled={filtered.length === 0}>
						<CopyIcon data-icon="inline-start" />
						Copy as JSONL
					</Button>
					<span className="text-xs text-muted-foreground">
						{filtered.length} of {logs.length}
					</span>
				</div>
				<p className="m-0 text-xs text-muted-foreground">
					Tip: filter by event=defense.applied to see which retrieved documents were dropped and which pattern matched.
					Filter by event=attack.generated to inspect attacker parse failures.
				</p>
				<div className="flex flex-col gap-1">
					{filtered.length === 0 ? (
						<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
							No logs match the current filters.
						</div>
					) : (
						filtered.map((log) => <LogRow key={log.id} log={log} />)
					)}
				</div>
			</TabsContent>
		</Tabs>
	);
}

function FriendlyLogs({ logs }: { logs: readonly RunLogRecord[] }) {
	const groups = useMemo(() => groupByAttempt(logs), [logs]);
	if (logs.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
				Nothing to summarize. Adjust the filters in the Raw events tab to widen the set.
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{groups.map((group) => (
				<div key={group.key} className="rounded-md border bg-card">
					<div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
						<span className="font-semibold">{group.title}</span>
						<span className="text-muted-foreground">{group.events.length} event(s)</span>
					</div>
					<ol className="m-0 flex flex-col gap-0 p-0">
						{group.events.map((log, index) => (
							<li
								key={log.id}
								className={cn(
									"flex items-start gap-3 px-3 py-2 text-sm",
									index !== group.events.length - 1 && "border-b border-border/40",
								)}
							>
								<span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
									{new Date(log.createdAt).toLocaleTimeString()}
								</span>
								<LevelDot level={log.level} />
								<span className="flex-1 leading-snug">{narrateLogEvent(log)}</span>
							</li>
						))}
					</ol>
				</div>
			))}
		</div>
	);
}

function groupByAttempt(logs: readonly RunLogRecord[]) {
	const groups = new Map<string, { key: string; title: string; order: number; events: RunLogRecord[] }>();
	const RUN_KEY = "__run__";
	groups.set(RUN_KEY, { key: RUN_KEY, title: "Run lifecycle", order: -1, events: [] });
	for (const log of logs) {
		const attemptNumber = getAttemptNumber(log);
		if (attemptNumber === null) {
			groups.get(RUN_KEY)?.events.push(log);
			continue;
		}
		const key = `attempt-${attemptNumber}`;
		if (!groups.has(key)) {
			groups.set(key, {
				key,
				title: `Attempt ${attemptNumber}`,
				order: attemptNumber,
				events: [],
			});
		}
		groups.get(key)?.events.push(log);
	}
	return Array.from(groups.values())
		.filter((group) => group.events.length > 0)
		.sort((a, b) => a.order - b.order);
}

function LevelDot({ level }: { level: RunLogRecord["level"] }) {
	const className = level === "error" ? "bg-destructive" : level === "warn" ? "bg-amber-500" : "bg-emerald-500";
	return <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", className)} aria-label={level} />;
}

function LogRow({ log }: { log: RunLogRecord }) {
	const [open, setOpen] = useState(false);
	const payloadEmpty = Object.keys(log.payload).length === 0;
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50">
				<span className="w-20 shrink-0 text-muted-foreground tabular-nums">
					{new Date(log.createdAt).toLocaleTimeString()}
				</span>
				<LevelBadge level={log.level} />
				<span className="w-44 shrink-0 truncate font-mono">{log.eventType}</span>
				<span className="flex-1">{log.message}</span>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<pre className="m-0 mt-1 ml-24 max-h-72 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-words">
					{payloadEmpty ? "(empty payload)" : JSON.stringify(log.payload, null, 2)}
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}

function LevelBadge({ level }: { level: RunLogRecord["level"] }) {
	const variant = level === "error" ? "destructive" : level === "warn" ? "secondary" : "outline";
	return (
		<Badge variant={variant} className="w-14 shrink-0 justify-center text-[10px] uppercase">
			{level}
		</Badge>
	);
}
