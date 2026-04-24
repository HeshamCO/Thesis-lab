import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StopCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { ChartCard, Heatmap, SimpleBar, formatPercent } from "#/components/thesis/charts";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";

export const Route = createFileRoute("/sweeps/$sweepId")({ component: SweepDetail });

function SweepDetail() {
	const { sweepId } = Route.useParams();
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.sweep(sweepId),
		queryFn: () => api.sweep(sweepId),
		refetchInterval: (q) => {
			const running = q.state.data?.cells.some(
				(cell) => cell.bulkRun.status === "running" || cell.bulkRun.status === "queued",
			);
			return running ? 3000 : false;
		},
	});
	const stop = useMutation({
		mutationFn: () => api.stopSweep(sweepId),
		onSuccess: ({ cancelledRuns, pausedRuns, affectedBulks }) => {
			toast.success(
				`Stopped ${affectedBulks} bulk${affectedBulks === 1 ? "" : "s"}: cancelled ${cancelledRuns} queued run${cancelledRuns === 1 ? "" : "s"}, pausing ${pausedRuns} running.`,
			);
			queryClient.invalidateQueries({ queryKey: queryKeys.sweep(sweepId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.bulkRuns });
		},
		onError: (error) => toast.error(error.message),
	});

	if (query.isLoading) return <p className="p-4">Loading…</p>;
	if (!query.data) return <p className="p-4">Sweep not found.</p>;
	const { sweep, cells } = query.data;
	const canStop = cells.some((cell) => cell.bulkRun.status === "running" || cell.bulkRun.status === "queued");

	// Detect varying factor keys.
	const factorKeys = Object.keys(sweep.factorCells[0] ?? {});
	const twoFactor = factorKeys.length === 2 ? (factorKeys as [string, string]) : null;
	const heatmap = twoFactor ? buildHeatmap(twoFactor, cells, sweep.factorCells) : null;

	const kpiData = cells.map((cell, i) => ({
		cell: `#${i + 1}`,
		successRate: Number((cell.dashboard.overallSuccessRate * 100).toFixed(1)),
		attemptRate: Number((cell.dashboard.attemptSuccessRate * 100).toFixed(1)),
		meanUtility: Number(cell.dashboard.meanUtility.toFixed(2)),
	}));

	return (
		<>
			<PageHeading
				title={sweep.name}
				description={`${cells.length} cells · created ${new Date(sweep.createdAt).toLocaleString()}`}
			/>

			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					variant="destructive"
					disabled={!canStop || stop.isPending}
					onClick={() => {
						if (window.confirm("Stop this sweep? Queued runs will be cancelled and the active run will be paused.")) {
							stop.mutate();
						}
					}}
				>
					<StopCircleIcon data-icon="inline-start" />
					{stop.isPending ? "Stopping…" : canStop ? "Stop sweep" : "Already stopped"}
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Cells</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>Bulk</TableHead>
								<TableHead>Status</TableHead>
								{factorKeys.map((key) => (
									<TableHead key={key}>{key}</TableHead>
								))}
								<TableHead>Run ASR</TableHead>
								<TableHead>Attempt ASR</TableHead>
								<TableHead>Mean utility</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{cells.map((cell, i) => {
								const factorRow = sweep.factorCells[i] ?? {};
								return (
									<TableRow key={cell.bulkRun.id}>
										<TableCell>{i + 1}</TableCell>
										<TableCell>
											<Link
												to="/bulk-runs/$bulkRunId"
												params={{ bulkRunId: cell.bulkRun.id }}
												className="hover:underline"
											>
												{cell.bulkRun.name}
											</Link>
										</TableCell>
										<TableCell>
											<StatusBadge status={cell.bulkRun.status as never} />
										</TableCell>
										{factorKeys.map((key) => (
											<TableCell key={key} className="font-mono text-xs">
												{String(factorRow[key] ?? "—")}
											</TableCell>
										))}
										<TableCell>{formatPercent(cell.dashboard.overallSuccessRate)}</TableCell>
										<TableCell>{formatPercent(cell.dashboard.attemptSuccessRate)}</TableCell>
										<TableCell>{cell.dashboard.meanUtility.toFixed(2)}</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<ChartCard
				title="KPI by cell"
				description="Run-level success, attempt-level success, mean utility per cell."
			>
				<SimpleBar
					data={kpiData}
					xKey="cell"
					bars={[
						{ key: "successRate", label: "Run ASR %" },
						{ key: "attemptRate", label: "Attempt ASR %", colorIndex: 1 },
						{ key: "meanUtility", label: "Mean utility ×100", colorIndex: 2 },
					]}
					height={320}
				/>
			</ChartCard>

			{heatmap ? (
				<Card>
					<CardHeader>
						<CardTitle>
							ASR heatmap — {heatmap.rowKey} × {heatmap.colKey}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Heatmap
							rows={heatmap.rows}
							cols={heatmap.cols}
							values={heatmap.values}
							formatValue={(v) => `${(v * 100).toFixed(0)}%`}
						/>
					</CardContent>
				</Card>
			) : null}
		</>
	);
}

type Cell = {
	bulkRun: { id: string; status: string; name: string };
	dashboard: {
		overallSuccessRate: number;
		attemptSuccessRate: number;
		meanUtility: number;
	};
};

function buildHeatmap(keys: [string, string], cells: Cell[], factorCells: Array<Record<string, string | number>>) {
	const [rowKey, colKey] = keys;
	const rows = Array.from(new Set(factorCells.map((c) => String(c[rowKey]))));
	const cols = Array.from(new Set(factorCells.map((c) => String(c[colKey]))));
	const values: number[][] = rows.map(() => cols.map(() => 0));
	factorCells.forEach((factorRow, i) => {
		const rIdx = rows.indexOf(String(factorRow[rowKey]));
		const cIdx = cols.indexOf(String(factorRow[colKey]));
		if (rIdx >= 0 && cIdx >= 0 && cells[i]) {
			values[rIdx][cIdx] = cells[i].dashboard.overallSuccessRate;
		}
	});
	return { rowKey, colKey, rows, cols, values };
}
