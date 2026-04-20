import { CopyIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import type { RunLogRecord } from "#/lib/thesis/schemas";

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
			const attempt = (log.payload as { attemptNumber?: number }).attemptNumber;
			if (typeof attempt === "number") {
				set.add(attempt);
			}
		}
		return Array.from(set).sort((a, b) => a - b);
	}, [logs]);

	const filtered = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return logs.filter((log) => {
			if (level !== "all" && log.level !== level) {
				return false;
			}
			if (eventType !== "all" && log.eventType !== eventType) {
				return false;
			}
			if (attemptFilter !== "all") {
				const attemptNumber = (log.payload as { attemptNumber?: number }).attemptNumber;
				if (String(attemptNumber ?? "") !== attemptFilter) {
					return false;
				}
			}
			if (!needle) {
				return true;
			}
			const blob = `${log.message} ${JSON.stringify(log.payload)}`.toLowerCase();
			return blob.includes(needle);
		});
	}, [attemptFilter, eventType, level, logs, search]);

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
		<div className="flex flex-col gap-3">
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
		</div>
	);
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
