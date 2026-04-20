import { useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import type { AttackerArtifact, RunDetail } from "#/lib/thesis/schemas";
import type { ArtifactPanelPayload } from "./artifact-panel";

type Row = {
	id: string;
	attemptNumber: number | null;
	source: "attacker" | "retrieval";
	kind: string;
	title: string;
	body: string;
	createdAt: string;
	openUrl?: string;
};

type Props = {
	detail: RunDetail;
	onSelect: (payload: ArtifactPanelPayload) => void;
};

export function RunArtifacts({ detail, onSelect }: Props) {
	const [filter, setFilter] = useState("");

	const rows = useMemo(() => buildRows(detail), [detail]);
	const filtered = useMemo(() => {
		const needle = filter.trim().toLowerCase();
		if (!needle) {
			return rows;
		}
		return rows.filter((row) => {
			return (
				row.title.toLowerCase().includes(needle) ||
				row.kind.toLowerCase().includes(needle) ||
				row.body.toLowerCase().includes(needle)
			);
		});
	}, [filter, rows]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<Input
					placeholder="Filter by title, kind, or content"
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					className="max-w-sm"
				/>
				<span className="text-xs text-muted-foreground">
					{filtered.length} of {rows.length} artifact{rows.length === 1 ? "" : "s"}
				</span>
			</div>
			{rows.length === 0 ? (
				<div className="rounded-md bg-muted/30 p-6 text-sm text-muted-foreground">
					No artifacts yet. Attacker outputs and retrieved documents appear here as the engine runs each attempt.
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Attempt</TableHead>
							<TableHead>Source</TableHead>
							<TableHead>Kind</TableHead>
							<TableHead>Title</TableHead>
							<TableHead>Created</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filtered.map((row) => (
							<TableRow
								key={row.id}
								className="cursor-pointer"
								onClick={() =>
									onSelect({
										id: row.id,
										title: row.title,
										subtitle: `${row.source} · ${row.kind}`,
										tags: [
											row.attemptNumber !== null ? `attempt=${row.attemptNumber}` : "scenario",
											`source=${row.source}`,
											`kind=${row.kind}`,
										],
										body: row.body,
										contentType: row.kind === "raw_output" ? "json" : "text",
										openUrl: row.openUrl,
									})
								}
							>
								<TableCell>{row.attemptNumber ?? "—"}</TableCell>
								<TableCell>
									<Badge variant={row.source === "attacker" ? "destructive" : "secondary"}>{row.source}</Badge>
								</TableCell>
								<TableCell>{row.kind}</TableCell>
								<TableCell className="max-w-xs truncate">{row.title}</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{new Date(row.createdAt).toLocaleTimeString()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}

function buildRows(detail: RunDetail): Row[] {
	const attemptByNumber = new Map(detail.attempts.map((attempt) => [attempt.id, attempt.attemptNumber]));
	const artifactRows: Row[] = (detail.attackerArtifacts ?? []).map((artifact: AttackerArtifact) => ({
		id: artifact.id,
		attemptNumber: attemptByNumber.get(artifact.attemptId) ?? null,
		source: "attacker",
		kind: artifact.kind,
		title: artifact.title,
		body: artifact.content,
		createdAt: artifact.createdAt,
		openUrl: `/api/runs/${detail.id}/attempts/${artifact.attemptId}/artifacts/${artifact.id}`,
	}));
	const retrievalRows: Row[] = [];
	for (const attempt of detail.attempts) {
		attempt.retrievedContext.forEach((document, index) => {
			retrievalRows.push({
				id: `retrieved:${attempt.id}:${index}`,
				attemptNumber: attempt.attemptNumber,
				source: "retrieval",
				kind: document.source,
				title: document.title,
				body: document.content,
				createdAt: attempt.createdAt,
			});
		});
	}
	return [...artifactRows, ...retrievalRows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
