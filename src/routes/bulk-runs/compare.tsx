import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { PageHeading } from "#/components/thesis/page-heading";
import {
	ChartCard,
	SimpleBar,
	SimpleLine,
	formatPercent,
	CHART_PALETTE,
} from "#/components/thesis/charts";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";
import type { BulkRunConfig, BulkRunRecord } from "#/lib/thesis/schemas";
import type { BulkRunDashboard } from "#/lib/thesis/bulk-dashboard";

type CompareSearch = { ids: string };

export const Route = createFileRoute("/bulk-runs/compare")({
	validateSearch: (search: Record<string, unknown>): CompareSearch => ({
		ids: typeof search.ids === "string" ? search.ids : "",
	}),
	component: BulkRunCompare,
});

type BulkPayload = { bulkRun: BulkRunRecord; dashboard: BulkRunDashboard };

function BulkRunCompare() {
	const { ids } = Route.useSearch();
	const idList = ids.split(",").filter(Boolean);

	const queries = useQueries({
		queries: idList.map((id) => ({
			queryKey: queryKeys.bulkRun(id),
			queryFn: () => api.bulkRun(id),
		})),
	});

	if (idList.length < 2) {
		return (
			<div className="p-4">
				<p>Select at least 2 bulk runs from the list to compare.</p>
				<Link to="/bulk-runs" className="text-sm underline">
					Back to bulk runs
				</Link>
			</div>
		);
	}

	if (queries.some((q) => q.isLoading)) return <p className="p-4">Loading…</p>;
	const payloads: BulkPayload[] = queries
		.map((q) => q.data)
		.filter((d): d is NonNullable<typeof d> => Boolean(d))
		.map((d) => ({ bulkRun: d.bulkRun, dashboard: d.dashboard }));
	if (payloads.length < 2) return <p className="p-4">Could not load all selected bulk runs.</p>;

	const labels = payloads.map((p) => p.bulkRun.name);

	const kpiData = [
		{ metric: "Run success %", values: payloads.map((p) => p.dashboard.overallSuccessRate * 100) },
		{ metric: "Attempt success %", values: payloads.map((p) => p.dashboard.attemptSuccessRate * 100) },
		{ metric: "Mean utility", values: payloads.map((p) => p.dashboard.meanUtility) },
		{ metric: "Mean attempts", values: payloads.map((p) => p.dashboard.meanAttemptsPerRun) },
	].map((row) => {
		const entry: Record<string, number | string> = { metric: row.metric };
		row.values.forEach((v, i) => {
			entry[`run${i}`] = Number(v.toFixed(2));
		});
		return entry;
	});

	const learningCurve = mergeSeries(
		payloads.map((p) =>
			p.dashboard.attemptsPerPosition.map((pos) => ({
				x: pos.attemptNumber,
				y: Number((pos.successRate * 100).toFixed(1)),
			})),
		),
		(x) => `#${x}`,
	);

	const cumulative = mergeSeries(
		payloads.map((p) =>
			p.dashboard.cumulativeProgress.map((cp) => ({
				x: cp.index,
				y: Number((cp.cumulativeSuccessRate * 100).toFixed(1)),
			})),
		),
		(x) => String(x),
	);

	const strategyGrouped = mergeCategorical(
		payloads.map((p) =>
			p.dashboard.byStrategy.map((row) => ({ key: row.strategy, value: row.count })),
		),
	);
	const intendedEffectGrouped = mergeCategorical(
		payloads.map((p) =>
			p.dashboard.byIntendedEffect.map((row) => ({
				key: row.intendedEffect,
				value: Number((row.successRate * 100).toFixed(1)),
			})),
		),
	);
	const whyFailedGrouped = mergeCategorical(
		payloads.map((p) =>
			p.dashboard.byWhyItFailed.map((row) => ({ key: row.whyItFailed, value: row.count })),
		),
	);

	const scenarioDelta = buildScenarioDelta(payloads);
	const runLines = labels.map((label, i) => ({ key: `run${i}`, label, colorIndex: i }));

	return (
		<>
			<PageHeading
				title="Compare bulk runs"
				description={`${payloads.length} bulk runs side-by-side`}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Configuration diff</CardTitle>
				</CardHeader>
				<CardContent>
					<ConfigDiffTable payloads={payloads} />
				</CardContent>
			</Card>

			<ChartCard
				title="Headline metrics"
				description="Grouped comparison across key aggregate KPIs."
			>
				<SimpleBar data={kpiData} xKey="metric" bars={runLines} height={300} />
			</ChartCard>

			<div className="grid gap-4 md:grid-cols-2">
				<ChartCard
					title="Attacker learning curve"
					description="Success rate per attempt position — does more iteration help each config?"
				>
					<SimpleLine
						data={learningCurve}
						xKey="label"
						lines={runLines}
						yTickFormatter={(v) => `${v}%`}
					/>
				</ChartCard>
				<ChartCard
					title="Cumulative success rate"
					description="Running success rate across completed runs."
				>
					<SimpleLine
						data={cumulative}
						xKey="label"
						lines={runLines}
						yTickFormatter={(v) => `${v}%`}
					/>
				</ChartCard>
				<ChartCard title="Strategy counts" description="Strategy frequency per bulk run.">
					<SimpleBar data={strategyGrouped} xKey="category" bars={runLines} height={300} />
				</ChartCard>
				<ChartCard
					title="Intended-effect success rate"
					description="Which intended effects get through under each config."
				>
					<SimpleBar
						data={intendedEffectGrouped}
						xKey="category"
						bars={runLines}
						height={300}
						yTickFormatter={(v) => `${v}%`}
					/>
				</ChartCard>
				<ChartCard
					title="Failure reasons"
					description="Count of failed attempts by reason, per bulk run."
					className="md:col-span-2"
				>
					<SimpleBar data={whyFailedGrouped} xKey="category" bars={runLines} height={300} />
				</ChartCard>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Per-scenario attack success rate</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Scenario</TableHead>
								{labels.map((label) => (
									<TableHead key={label}>{label}</TableHead>
								))}
								<TableHead>Δ (last − first)</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{scenarioDelta.map((row) => (
								<TableRow key={row.scenarioName}>
									<TableCell>{row.scenarioName}</TableCell>
									{row.rates.map((rate, i) => (
										<TableCell key={i}>
											{rate === null ? "—" : formatPercent(rate)}
										</TableCell>
									))}
									<TableCell
										className={cn(
											"font-mono",
											row.delta !== null && row.delta > 0 && "text-red-600 dark:text-red-400",
											row.delta !== null && row.delta < 0 && "text-emerald-600 dark:text-emerald-400",
										)}
									>
										{row.delta === null ? "—" : `${row.delta > 0 ? "+" : ""}${(row.delta * 100).toFixed(0)}%`}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

function ConfigDiffTable({ payloads }: { payloads: BulkPayload[] }) {
	const keys: Array<keyof BulkRunConfig> = [
		"attackerModelId",
		"benignModelId",
		"judgeModelId",
		"defenseConfigId",
		"maxAttempts",
		"attackerPromptVersion",
		"benignPromptVersion",
		"judgePromptVersion",
		"benignTaskHasSafetyClause",
		"labelRetrievedDocuments",
		"structuredBenignOutput",
	];

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Field</TableHead>
					{payloads.map((p, i) => (
						<TableHead key={p.bulkRun.id}>
							<span
								className="inline-block size-2 rounded-full"
								style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
							/>{" "}
							{p.bulkRun.name}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell className="font-medium">totalRuns</TableCell>
					{payloads.map((p) => (
						<TableCell key={p.bulkRun.id}>{p.bulkRun.totalRuns}</TableCell>
					))}
				</TableRow>
				{keys.map((key) => {
					const values = payloads.map((p) => String(p.bulkRun.config[key] ?? "—"));
					const differs = new Set(values).size > 1;
					return (
						<TableRow key={String(key)} className={differs ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
							<TableCell className="font-medium">{String(key)}</TableCell>
							{values.map((v, i) => (
								<TableCell key={i} className="font-mono text-xs">
									{v}
								</TableCell>
							))}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

function mergeSeries(
	seriesList: Array<Array<{ x: number; y: number }>>,
	labelFn: (x: number) => string,
) {
	const xs = new Set<number>();
	for (const series of seriesList) for (const p of series) xs.add(p.x);
	const sorted = Array.from(xs).sort((a, b) => a - b);
	return sorted.map((x) => {
		const entry: Record<string, number | string | null> = { label: labelFn(x) };
		seriesList.forEach((series, i) => {
			const point = series.find((p) => p.x === x);
			entry[`run${i}`] = point ? point.y : null;
		});
		return entry as Record<string, number | string>;
	});
}

function mergeCategorical(seriesList: Array<Array<{ key: string; value: number }>>) {
	const cats = new Set<string>();
	for (const series of seriesList) for (const p of series) cats.add(p.key);
	return Array.from(cats).map((category) => {
		const entry: Record<string, number | string> = { category };
		seriesList.forEach((series, i) => {
			const point = series.find((p) => p.key === category);
			entry[`run${i}`] = point ? point.value : 0;
		});
		return entry;
	});
}

function buildScenarioDelta(payloads: BulkPayload[]) {
	const scenarios = new Set<string>();
	for (const p of payloads) for (const row of p.dashboard.perScenario) scenarios.add(row.scenarioName);
	const rows = Array.from(scenarios).map((scenarioName) => {
		const rates = payloads.map((p) => {
			const row = p.dashboard.perScenario.find((r) => r.scenarioName === scenarioName);
			return row?.attackSuccessRate ?? null;
		});
		const first = rates[0];
		const last = rates[rates.length - 1];
		const delta = first !== null && last !== null ? last - first : null;
		return { scenarioName, rates, delta };
	});
	return rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
}
