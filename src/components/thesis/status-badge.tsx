import { cn } from "#/lib/utils";
import type { RunStatus } from "#/lib/thesis/schemas";

const TONE: Record<string, { dot: string; text: string; bg: string; border: string; label?: string }> = {
	completed: {
		dot: "bg-[var(--success)]",
		text: "text-[var(--success)]",
		bg: "bg-[color-mix(in_oklch,var(--success)_12%,transparent)]",
		border: "border-[color-mix(in_oklch,var(--success)_30%,transparent)]",
	},
	failed: {
		dot: "bg-destructive",
		text: "text-destructive",
		bg: "bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)]",
		border: "border-[color-mix(in_oklch,var(--destructive)_35%,transparent)]",
	},
	running: {
		dot: "bg-[var(--info)] animate-[subtle-pulse_1.6s_ease-in-out_infinite]",
		text: "text-[var(--info)]",
		bg: "bg-[color-mix(in_oklch,var(--info)_10%,transparent)]",
		border: "border-[color-mix(in_oklch,var(--info)_30%,transparent)]",
	},
	queued: {
		dot: "bg-[var(--warning)]",
		text: "text-[var(--warning)]",
		bg: "bg-[color-mix(in_oklch,var(--warning)_12%,transparent)]",
		border: "border-[color-mix(in_oklch,var(--warning)_35%,transparent)]",
	},
};

const FALLBACK = {
	dot: "bg-muted-foreground",
	text: "text-muted-foreground",
	bg: "bg-muted",
	border: "border-border",
};

export function StatusBadge({ status }: { status: RunStatus | string }) {
	const tone = TONE[status] ?? FALLBACK;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
				tone.bg,
				tone.border,
				tone.text,
			)}
		>
			<span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
			{status}
		</span>
	);
}
