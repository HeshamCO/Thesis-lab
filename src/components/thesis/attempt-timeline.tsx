import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, ClockIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
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
			<p className="m-0 text-xs text-muted-foreground">The attempt timeline fills in as the engine completes phases.</p>
		);
	}

	return (
		<nav
			aria-label="Attempt timeline"
			className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 bg-background/40 px-1 py-2 backdrop-blur"
		>
			<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
				<span>
					{attempts.length} of {detail.maxAttempts} attempts
				</span>
				<span className="hidden sm:inline">
					Use <KeyHint>j</KeyHint> / <KeyHint>k</KeyHint> to step through
				</span>
			</div>
			<div className="flex gap-1.5 overflow-x-auto p-1" role="tablist">
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
								"group flex min-w-[180px] shrink-0 flex-col gap-0.5 rounded px-3 py-2 text-left transition-colors",
								"hover:bg-muted",
								isFocused ? "bg-muted ring-1 ring-ring" : "ring-1 ring-ring/40 bg-muted/20",
							)}
						>
							<span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								<HeadlineIcon tone={headline.tone} />
								Attempt {attempt.attemptNumber}
							</span>
							<span className="line-clamp-2 text-sm leading-snug text-foreground">{shortHeadline(headline.title)}</span>
							<span className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
								<ClockIcon className="size-3" />
								{formatDurationMs(attempt.totalDurationMs)}
								<span className="opacity-60">·</span>
								<span className="uppercase tracking-wider">{attempt.status}</span>
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
			return <CircleCheckIcon className="size-3.5 text-[var(--success)]" />;
		case "fail":
			return <CircleXIcon className="size-3.5 text-destructive" />;
		case "warn":
			return <CircleAlertIcon className="size-3.5 text-[var(--warning)]" />;
		case "running":
			return <ClockIcon className="size-3.5 text-[var(--info)]" />;
		default:
			return null;
	}
}

function KeyHint({ children }: { children: React.ReactNode }) {
	return <kbd className="inline-flex h-4 items-center rounded bg-muted px-1 font-mono text-[10px]">{children}</kbd>;
}

function shortHeadline(title: string) {
	return title.replace(/^Attempt\s+\d+\s+/, "");
}
