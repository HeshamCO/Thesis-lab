import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, ClockIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import { narrateAttempt } from "#/lib/thesis/attempt-narrative";
import { formatDurationMs } from "#/lib/thesis/run-stats";
import type { RunDetail } from "#/lib/thesis/schemas";

type Props = {
	detail: RunDetail;
	focusedAttemptId: string | null;
	onFocus: (attemptId: string) => void;
};

export function AttemptTimeline({ detail, focusedAttemptId, onFocus }: Props) {
	const attempts = useMemo(
		() => [...detail.attempts].sort((a, b) => a.attemptNumber - b.attemptNumber),
		[detail.attempts],
	);
	const focusedRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		focusedRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
	}, [focusedAttemptId]);

	if (attempts.length === 0) {
		return (
			<div className="rounded-md border border-dashed bg-card px-3 py-2 text-xs text-muted-foreground">
				The attempt timeline fills in as the engine completes phases.
			</div>
		);
	}

	return (
		<nav
			aria-label="Attempt timeline"
			className="sticky top-0 z-10 -mx-1 flex flex-col gap-1 border bg-card/95 backdrop-blur-sm rounded-md px-2 py-2 shadow-sm"
		>
			<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
				<span>
					{attempts.length} of {detail.maxAttempts} attempts
				</span>
				<span className="hidden sm:inline">
					Use <KeyHint>j</KeyHint> / <KeyHint>k</KeyHint> to step through attempts
				</span>
			</div>
			<div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
				{attempts.map((attempt) => {
					const headline = narrateAttempt(detail, attempt);
					const isFocused = attempt.id === focusedAttemptId;
					return (
						<button
							key={attempt.id}
							ref={isFocused ? focusedRef : undefined}
							type="button"
							role="tab"
							aria-selected={isFocused}
							onClick={() => onFocus(attempt.id)}
							className={cn(
								"group flex min-w-[180px] shrink-0 flex-col gap-1 rounded-md border bg-background px-3 py-2 text-left transition-colors",
								"hover:border-primary/50",
								isFocused && "border-primary ring-2 ring-primary/30",
							)}
						>
							<span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
								<HeadlineIcon tone={headline.tone} />
								Attempt {attempt.attemptNumber}
							</span>
							<span className="line-clamp-2 text-sm leading-snug">{shortHeadline(headline.title)}</span>
							<span className="flex items-center gap-2 text-xs text-muted-foreground">
								<span className="inline-flex items-center gap-1">
									<ClockIcon className="size-3" />
									{formatDurationMs(attempt.totalDurationMs)}
								</span>
								<Badge variant="outline" className="h-4 text-[10px] uppercase">
									{attempt.status}
								</Badge>
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}

function HeadlineIcon({ tone }: { tone: ReturnType<typeof narrateAttempt>["tone"] }) {
	switch (tone) {
		case "pass":
			return <CircleCheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
		case "fail":
			return <CircleXIcon className="size-3.5 text-destructive" />;
		case "warn":
			return <CircleAlertIcon className="size-3.5 text-amber-600 dark:text-amber-400" />;
		case "running":
			return <ClockIcon className="size-3.5 text-sky-600 dark:text-sky-400" />;
		default:
			return null;
	}
}

function KeyHint({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px]">{children}</kbd>
	);
}

function shortHeadline(title: string) {
	return title.replace(/^Attempt\s+\d+\s+/, "");
}
