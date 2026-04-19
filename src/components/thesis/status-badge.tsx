import { Badge } from "#/components/ui/badge";
import type { RunStatus } from "#/lib/thesis/schemas";

export function StatusBadge({ status }: { status: RunStatus | string }) {
	const variant =
		status === "completed"
			? "default"
			: status === "failed"
				? "destructive"
				: status === "running" || status === "queued"
					? "secondary"
					: "outline";

	return <Badge variant={variant}>{status}</Badge>;
}
