import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";
import type { StartRunInput } from "#/lib/thesis/schemas";

export const Route = createFileRoute("/runs/")({ component: RunsPage });

function RunsPage() {
	const [form, setForm] = useState<StartRunInput>({
		scenarioId: "",
		attackerModelId: "",
		benignModelId: "",
		defenseConfigId: "",
		maxAttempts: 5,
		retrievalSettings: { topK: 5, query: "" },
	});
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const scenarios = useQuery({
		queryKey: queryKeys.scenarios,
		queryFn: api.scenarios,
	});
	const models = useQuery({ queryKey: queryKeys.models, queryFn: api.models });
	const defenses = useQuery({
		queryKey: queryKeys.defenses,
		queryFn: api.defenses,
	});
	const runs = useQuery({
		queryKey: queryKeys.runs,
		queryFn: api.runs,
		refetchInterval: 3000,
	});
	const startRun = useMutation({
		mutationFn: api.startRun,
		onSuccess: (run) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.runs });
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
			toast.success("Run started");
			navigate({ to: "/runs/$runId", params: { runId: run.id } });
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<PageHeading
				title="Runs"
				description="Launch a checkpointed feedback loop from a scenario snapshot and model/defense selections."
			/>

			<Card>
				<CardHeader>
					<CardTitle>Start experiment run</CardTitle>
					<CardDescription>
						The selected scenario, models, defense, and retrieval settings are
						copied into immutable run snapshots.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-3"
						onSubmit={(event) => {
							event.preventDefault();
							startRun.mutate(form);
						}}
					>
						<Field label="Scenario">
							<EntitySelect
								value={form.scenarioId}
								placeholder="Select scenario"
								items={scenarios.data ?? []}
								onChange={(scenarioId) => setForm({ ...form, scenarioId })}
							/>
						</Field>
						<Field label="Attacker model">
							<EntitySelect
								value={form.attackerModelId}
								placeholder="Select attacker"
								items={models.data ?? []}
								onChange={(attackerModelId) =>
									setForm({ ...form, attackerModelId })
								}
							/>
						</Field>
						<Field label="Benign model">
							<EntitySelect
								value={form.benignModelId}
								placeholder="Select benign"
								items={models.data ?? []}
								onChange={(benignModelId) =>
									setForm({ ...form, benignModelId })
								}
							/>
						</Field>
						<Field label="Defense">
							<EntitySelect
								value={form.defenseConfigId}
								placeholder="Select defense"
								items={defenses.data ?? []}
								onChange={(defenseConfigId) =>
									setForm({ ...form, defenseConfigId })
								}
							/>
						</Field>
						<Field label="Max attempts">
							<Input
								type="number"
								min={1}
								max={50}
								value={form.maxAttempts}
								onChange={(event) =>
									setForm({
										...form,
										maxAttempts: Number(event.currentTarget.value),
									})
								}
							/>
						</Field>
						<Field label="Top K retrieval">
							<Input
								type="number"
								min={1}
								max={20}
								value={form.retrievalSettings.topK}
								onChange={(event) =>
									setForm({
										...form,
										retrievalSettings: {
											...form.retrievalSettings,
											topK: Number(event.currentTarget.value),
										},
									})
								}
							/>
						</Field>
						<Field label="Retrieval query override">
							<Input
								value={form.retrievalSettings.query}
								onChange={(event) =>
									setForm({
										...form,
										retrievalSettings: {
											...form.retrievalSettings,
											query: event.currentTarget.value,
										},
									})
								}
							/>
						</Field>
						<div className="flex items-end md:col-span-2">
							<Button type="submit" disabled={startRun.isPending}>
								<PlayIcon data-icon="inline-start" />
								Start run
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Run history</CardTitle>
					<CardDescription>
						Completed and interrupted runs remain available for inspection and
						export.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Scenario</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Defense</TableHead>
								<TableHead>Attempts</TableHead>
								<TableHead>Final success</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(runs.data ?? []).map((run) => (
								<TableRow key={run.id}>
									<TableCell>{run.scenarioName}</TableCell>
									<TableCell>
										<StatusBadge status={run.status} />
									</TableCell>
									<TableCell>{run.defenseName}</TableCell>
									<TableCell>
										{run.summary?.attemptsUsed ?? 0}/{run.maxAttempts}
									</TableCell>
									<TableCell>
										{run.summary ? String(run.summary.finalSuccess) : "—"}
									</TableCell>
									<TableCell>
										<Button variant="outline" size="sm" asChild>
											<Link to="/runs/$runId" params={{ runId: run.id }}>
												Open
											</Link>
										</Button>
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

function EntitySelect({
	value,
	placeholder,
	items,
	onChange,
}: {
	value: string;
	placeholder: string;
	items: Array<{ id: string; name: string }>;
	onChange: (id: string) => void;
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{items.map((item) => (
						<SelectItem key={item.id} value={item.id}>
							{item.name}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className="flex flex-col gap-2">
			<Label>{label}</Label>
			{children}
		</label>
	);
}
