import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { StatusBadge } from "#/components/thesis/status-badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { api } from "#/lib/thesis/api";
import { filterModelsByRole } from "#/lib/thesis/model-roles";
import { queryKeys } from "#/lib/thesis/query";
import {
	ATTACKER_PROMPT_VERSIONS,
	BENIGN_PROMPT_VERSIONS,
	DEFAULT_ATTACKER_PROMPT_VERSION,
	DEFAULT_BENIGN_PROMPT_VERSION,
	DEFAULT_JUDGE_PROMPT_VERSION,
	JUDGE_PROMPT_VERSIONS,
	type StartRunInput,
} from "#/lib/thesis/schemas";

export const Route = createFileRoute("/runs/")({ component: RunsPage });

function RunsPage() {
	const [form, setForm] = useState<StartRunInput>({
		scenarioId: "",
		attackerModelId: "",
		benignModelId: "",
		judgeModelId: "",
		defenseConfigId: "",
		maxAttempts: 2,
		retrievalSettings: { topK: 5, query: "" },
		attackerPromptVersion: DEFAULT_ATTACKER_PROMPT_VERSION,
		benignPromptVersion: DEFAULT_BENIGN_PROMPT_VERSION,
		judgePromptVersion: DEFAULT_JUDGE_PROMPT_VERSION,
		benignTaskHasSafetyClause: true,
		labelRetrievedDocuments: false,
		structuredBenignOutput: true,
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

	useEffect(() => {
		if (form.defenseConfigId || !defenses.data?.length) return;
		const baseline = defenses.data.find((d) => d.mode === "none") ?? defenses.data[0];
		setForm((current) => (current.defenseConfigId ? current : { ...current, defenseConfigId: baseline.id }));
	}, [defenses.data, form.defenseConfigId]);
	const runs = useQuery({
		queryKey: queryKeys.runs,
		queryFn: api.runs,
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
						The selected scenario, models, defense, and retrieval settings are copied into immutable run snapshots.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-3"
						onSubmit={(event) => {
							event.preventDefault();
							const { judgeModelId, ...rest } = form;
							startRun.mutate(judgeModelId ? { ...rest, judgeModelId } : rest);
						}}
					>
						<Field label="Scenario" col={2}>
							<EntitySelect
								value={form.scenarioId}
								placeholder="Select scenario"
								items={scenarios.data ?? []}
								onChange={(scenarioId) => setForm({ ...form, scenarioId })}
							/>
						</Field>
						<Field label="Defense">
							<EntitySelect
								value={form.defenseConfigId}
								placeholder="Select defense"
								items={defenses.data ?? []}
								onChange={(defenseConfigId) => setForm({ ...form, defenseConfigId })}
							/>
						</Field>
						<Field label="Attacker model">
							<EntitySelect
								value={form.attackerModelId}
								placeholder="Select attacker"
								items={filterModelsByRole(models.data ?? [], "attacker")}
								onChange={(attackerModelId) => setForm({ ...form, attackerModelId })}
							/>
						</Field>
						<Field label="Benign model">
							<EntitySelect
								value={form.benignModelId}
								placeholder="Select benign"
								items={filterModelsByRole(models.data ?? [], "benign")}
								onChange={(benignModelId) => setForm({ ...form, benignModelId })}
							/>
						</Field>
						<Field label="Judge model">
							<EntitySelect
								value={form.judgeModelId ?? ""}
								placeholder="Same as benign model"
								items={filterModelsByRole(models.data ?? [], "judge")}
								onChange={(judgeModelId) => setForm({ ...form, judgeModelId })}
							/>
						</Field>

						<Field label="Attacker prompt schema">
							<PromptVersionSelect
								value={form.attackerPromptVersion}
								items={ATTACKER_PROMPT_VERSIONS}
								onChange={(attackerPromptVersion) => setForm({ ...form, attackerPromptVersion })}
							/>
						</Field>
						<Field label="Benign prompt schema">
							<PromptVersionSelect
								value={form.benignPromptVersion}
								items={BENIGN_PROMPT_VERSIONS}
								onChange={(benignPromptVersion) => setForm({ ...form, benignPromptVersion })}
							/>
						</Field>
						<Field label="Judge prompt schema">
							<PromptVersionSelect
								value={form.judgePromptVersion}
								items={JUDGE_PROMPT_VERSIONS}
								onChange={(judgePromptVersion) => setForm({ ...form, judgePromptVersion })}
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

						<BooleanField
							label="Structured benign output"
							description="Ask the benign model for a JSON self-report (task_answer, used_docs, flags). Enables richer ASR/utility measurement."
							checked={form.structuredBenignOutput}
							onCheckedChange={(structuredBenignOutput) => setForm({ ...form, structuredBenignOutput })}
						/>
						<BooleanField
							label="Label retrieved documents"
							description="Default off for clean runs; benign prompts still use neutral labels only."
							checked={form.labelRetrievedDocuments}
							onCheckedChange={(labelRetrievedDocuments) => setForm({ ...form, labelRetrievedDocuments })}
						/>
						<div className="flex items-end col-span-full">
							<Button className="w-full" type="submit" disabled={startRun.isPending}>
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
					<CardDescription>Completed and interrupted runs remain available for inspection and export.</CardDescription>
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
									<TableCell>{run.summary ? String(run.summary.finalSuccess) : "—"}</TableCell>
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

function PromptVersionSelect<T extends string>({
	value,
	items,
	onChange,
}: {
	value: T;
	items: readonly T[];
	onChange: (value: T) => void;
}) {
	return (
		<Select value={value} onValueChange={(next) => onChange(next as T)}>
			<SelectTrigger className="w-full">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{items.map((item) => (
						<SelectItem key={item} value={item}>
							{item}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
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
			<SelectTrigger className="w-full">
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

function BooleanField({
	label,
	description,
	checked,
	onCheckedChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-start gap-3 rounded-md border p-3">
			<Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
			<div className="grid gap-1 leading-none">
				<Label>{label}</Label>
				<p className="m-0 text-muted-foreground text-xs leading-5">{description}</p>
			</div>
		</div>
	);
}

function Field({ label, children, col = 1 }: { label: string; children: React.ReactNode; col?: number }) {
	const cols = ["col-span-1", "col-span-2", "col-span-3", "col-span-4"];
	return (
		<label className={`flex flex-col gap-2 ${cols[col - 1]}`}>
			<Label>{label}</Label>
			{children}
		</label>
	);
}
