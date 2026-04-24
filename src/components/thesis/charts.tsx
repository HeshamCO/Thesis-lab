import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "#/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

export const CHART_PALETTE = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function ChartCard({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

export function EmptyChart({ message = "No data yet." }: { message?: string }) {
	return (
		<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
			{message}
		</div>
	);
}

type SimpleBarProps = {
	data: Array<Record<string, unknown>>;
	xKey: string;
	bars: Array<{ key: string; label: string; colorIndex?: number; stackId?: string }>;
	layout?: "horizontal" | "vertical";
	height?: number;
	yTickFormatter?: (value: number) => string;
	xTickFormatter?: (value: string) => string;
};

export function SimpleBar({ data, xKey, bars, layout = "horizontal", height = 260, yTickFormatter, xTickFormatter }: SimpleBarProps) {
	const config = useMemo<ChartConfig>(() => {
		const cfg: ChartConfig = {};
		bars.forEach((bar, i) => {
			cfg[bar.key] = {
				label: bar.label,
				color: CHART_PALETTE[(bar.colorIndex ?? i) % CHART_PALETTE.length],
			};
		});
		return cfg;
	}, [bars]);

	if (!data.length) return <EmptyChart />;

	return (
		<ChartContainer config={config} className={`aspect-auto w-full`} style={{ height }}>
			<BarChart data={data} layout={layout} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
				<CartesianGrid strokeDasharray="3 3" vertical={layout === "vertical"} />
				{layout === "horizontal" ? (
					<>
						<XAxis
							dataKey={xKey}
							tickLine={false}
							axisLine={false}
							tickFormatter={xTickFormatter}
							interval={0}
							angle={data.length > 5 ? -25 : 0}
							textAnchor={data.length > 5 ? "end" : "middle"}
							height={data.length > 5 ? 60 : 30}
						/>
						<YAxis tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
					</>
				) : (
					<>
						<XAxis type="number" tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
						<YAxis
							type="category"
							dataKey={xKey}
							tickLine={false}
							axisLine={false}
							width={140}
							tickFormatter={xTickFormatter}
						/>
					</>
				)}
				<ChartTooltip content={<ChartTooltipContent />} />
				{bars.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
				{bars.map((bar) => (
					<Bar
						key={bar.key}
						dataKey={bar.key}
						fill={`var(--color-${bar.key})`}
						radius={4}
						stackId={bar.stackId}
					/>
				))}
			</BarChart>
		</ChartContainer>
	);
}

type SimpleLineProps = {
	data: Array<Record<string, unknown>>;
	xKey: string;
	lines: Array<{ key: string; label: string; colorIndex?: number }>;
	height?: number;
	yTickFormatter?: (value: number) => string;
};

export function SimpleLine({ data, xKey, lines, height = 260, yTickFormatter }: SimpleLineProps) {
	const config = useMemo<ChartConfig>(() => {
		const cfg: ChartConfig = {};
		lines.forEach((line, i) => {
			cfg[line.key] = {
				label: line.label,
				color: CHART_PALETTE[(line.colorIndex ?? i) % CHART_PALETTE.length],
			};
		});
		return cfg;
	}, [lines]);

	if (!data.length) return <EmptyChart />;

	return (
		<ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
			<LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey={xKey} tickLine={false} axisLine={false} />
				<YAxis tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
				<ChartTooltip content={<ChartTooltipContent />} />
				{lines.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
				{lines.map((line) => (
					<Line
						key={line.key}
						dataKey={line.key}
						type="monotone"
						stroke={`var(--color-${line.key})`}
						strokeWidth={2}
						dot={false}
					/>
				))}
			</LineChart>
		</ChartContainer>
	);
}

type SimplePieProps = {
	data: Array<{ name: string; value: number }>;
	height?: number;
	donut?: boolean;
};

export function SimplePie({ data, height = 260, donut = true }: SimplePieProps) {
	const filtered = data.filter((d) => d.value > 0);
	const config = useMemo<ChartConfig>(() => {
		const cfg: ChartConfig = {};
		filtered.forEach((d, i) => {
			cfg[d.name] = { label: d.name, color: CHART_PALETTE[i % CHART_PALETTE.length] };
		});
		return cfg;
	}, [filtered]);

	if (!filtered.length) return <EmptyChart />;

	return (
		<ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
			<PieChart>
				<ChartTooltip content={<ChartTooltipContent hideLabel />} />
				<Pie
					data={filtered}
					dataKey="value"
					nameKey="name"
					innerRadius={donut ? 55 : 0}
					outerRadius={90}
					strokeWidth={2}
				>
					{filtered.map((entry, i) => (
						<Cell key={entry.name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
					))}
				</Pie>
				<ChartLegend content={<ChartLegendContent nameKey="name" />} />
			</PieChart>
		</ChartContainer>
	);
}

export function formatPercent(value: number) {
	return `${(value * 100).toFixed(0)}%`;
}

type HeatmapProps = {
	rows: string[];
	cols: string[];
	values: number[][]; // values[rowIdx][colIdx] in [0,1] or arbitrary; normalized 0..max
	formatValue?: (v: number) => string;
	emptyValue?: number | null;
};

export function Heatmap({ rows, cols, values, formatValue = (v) => v.toFixed(2), emptyValue = null }: HeatmapProps) {
	if (rows.length === 0 || cols.length === 0) return <EmptyChart />;
	const flat = values.flat().filter((v) => v !== null && v !== undefined && Number.isFinite(v));
	const max = flat.length > 0 ? Math.max(...flat) : 1;
	const min = flat.length > 0 ? Math.min(...flat) : 0;
	const range = max - min || 1;
	return (
		<div className="overflow-auto">
			<table className="border-collapse text-xs">
				<thead>
					<tr>
						<th className="p-2 text-left text-muted-foreground" />
						{cols.map((col) => (
							<th key={col} className="p-2 text-left text-muted-foreground">
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIdx) => (
						<tr key={row}>
							<th className="p-2 text-right text-muted-foreground font-normal">{row}</th>
							{cols.map((col, colIdx) => {
								const raw = values[rowIdx]?.[colIdx];
								const v = raw === undefined || raw === null ? emptyValue : raw;
								const norm =
									v === null || v === undefined || !Number.isFinite(v) ? null : (v - min) / range;
								const bg =
									norm === null
										? "var(--muted)"
										: `color-mix(in oklab, var(--chart-1) ${Math.round(norm * 100)}%, transparent)`;
								return (
									<td
										key={col}
										className="p-2 text-center font-mono"
										style={{ background: bg }}
										title={`${row} × ${col}: ${v === null ? "—" : formatValue(v)}`}
									>
										{v === null ? "—" : formatValue(v)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function formatMs(value: number) {
	if (value < 1000) return `${value.toFixed(0)}ms`;
	return `${(value / 1000).toFixed(1)}s`;
}
