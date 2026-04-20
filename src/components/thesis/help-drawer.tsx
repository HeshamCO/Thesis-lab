import { CircleHelpIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "#/components/ui/sheet";

export function HelpDrawer() {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="outline" size="icon" aria-label="Help">
					<CircleHelpIcon />
				</Button>
			</SheetTrigger>
			<SheetContent className="sm:!max-w-md flex flex-col gap-4">
				<SheetHeader>
					<SheetTitle>Reading a run</SheetTitle>
					<SheetDescription>How to debug an attack and study results from this run.</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-4 px-4 pb-4 text-sm">
					<Section title="Overview tab">
						<p className="m-0 text-muted-foreground">
							Top-level metrics: status, attempts used, final success, average utility, plus durations and parse-failure
							counts. Use this as the snapshot of run health before drilling in.
						</p>
					</Section>
					<Section title="Tree tab">
						<p className="m-0 text-muted-foreground">
							Each attempt expands into attacker artifacts → retrieval → defense → benign response → step results →
							feedback. Click any leaf to open its full content. Failed attempts show a one-line "why" caption derived
							from the first failed required step.
						</p>
					</Section>
					<Section title="Artifacts tab">
						<p className="m-0 text-muted-foreground">
							A flat searchable table of every attacker artifact (injection prompt, injected document, rationale, raw
							output) and every retrieved RAG document. Use it to compare what the attacker produced across attempts.
						</p>
					</Section>
					<Section title="Logs tab">
						<p className="m-0 text-muted-foreground">
							Filter by level, event type, attempt number, and free-text. Click a row to expand its JSON payload. Use{" "}
							<code className="rounded bg-muted px-1 text-xs">event=defense.applied</code> to see which retrieved
							documents were dropped, or <code className="rounded bg-muted px-1 text-xs">event=attack.generated</code>{" "}
							to inspect attacker parse outcomes. Copy the filtered set as JSONL for offline analysis.
						</p>
					</Section>
					<Section title="Exports">
						<p className="m-0 text-muted-foreground">
							JSON contains the full RunDetail (snapshots, attempts, step results, logs, artifacts, durations). CSV is
							one row per (attempt, step) with attack family, durations, defense filter counts, and parse-success flags
							— pivot it in a notebook.
						</p>
					</Section>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<h3 className="m-0 text-sm font-semibold">{title}</h3>
			{children}
		</div>
	);
}
