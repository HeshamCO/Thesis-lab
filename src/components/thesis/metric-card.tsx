import type { LucideIcon } from "lucide-react";
import { cn } from "#/lib/utils";

export function MetricCard({
	label,
	value,
	description,
	icon: Icon,
	className,
}: {
	label: string;
	value: string | number;
	description: string;
	icon?: LucideIcon;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-4", className)}>
			<div className="flex items-center justify-between gap-2">
				<p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
				{Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
			</div>
			<p className="m-0 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
			<p className="m-0 text-xs leading-5 text-muted-foreground">{description}</p>
		</div>
	);
}
