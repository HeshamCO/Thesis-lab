import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompareIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
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
	type BulkRunInput,
} from "#/lib/thesis/schemas";
import { useReadOnly } from "#/hooks/use-read-only";

export const Route = createFileRoute("/bulk-runs/")({ component: BulkRunsPage });

function BulkRunsPage() {
	const readOnly = useReadOnly();
	const [form, setForm] = useState<BulkRunInput>({
		name: `Bulk run ${new Date().toLocaleString()}`,
		scenarioIds: [],
		attackerModelId: "",
		benignModelId: "",
		judgeModelId: undefined,
		defenseConfigId: "",
		maxAttempts: 2,
		retrievalSettings: { topK: 5, query: "" },
		attackerPromptVersion: DEFAULT_ATTACKER_PROMPT_VERSION,
		benignPromptVersion: DEFAULT_BENIGN_PROMPT_VERSION,
		judgePromptVersion: DEFAULT_JUDGE_PROMPT_VERSION,
		benignTaskHasSafetyClause: true,
		labelRetrievedDocuments: false,
		structuredBenignOutput: true,
		replicas: 1,
		concurrency: 1,
		perModelConcurrency: 4,
		shuffleSeed: undefined,
	});
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const scenarios = useQuery({ queryKey: queryKeys.scenarios, queryFn: api.scenarios });
	const models = useQuery({ queryKey: queryKeys.models, queryFn: api.models });
	const defenses = useQuery({ queryKey: queryKeys.defenses, queryFn: api.defenses });
	const bulkRuns = useQuery({ queryKey: queryKeys.bulkRuns, queryFn: api.bulkRuns });

	useEffect(() => {
		if (form.defenseConfigId || !defenses.data?.length) return;
		const baseline = defenses.data.find((d) => d.mode === "none") ?? defenses.data[0];
		setForm((current) =>
			current.defenseConfigId ? current : { ...current, defenseConfigId: baseline.id },
		);
	}, [defenses.data, form.defenseConfigId]);

	const deleteBulk = useMutation({
		mutationFn: api.deleteBulkRun,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.bulkRuns });
			toast.success("Bulk run deleted.");
		},
		onError: (error) => toast.error(error.message),
	});

	const createBulk = useMutation({
		mutationFn: api.createBulkRun,
		onSuccess: ({ bulkRun }) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.bulkRuns });
			queryClient.invalidateQueries({ queryKey: queryKeys.runs });
			toast.success(`Bulk run created with ${bulkRun.totalRuns} scenarios`);
			navigate({ to: "/bulk-runs/$bulkRunId", params: { bulkRunId: bulkRun.id } });
		},
		onError: (error) => toast.error(error.message),
	});

	const allSelected = useMemo(
		() => !form.scenarioIds || form.scenarioIds.length === 0,
		[form.scenarioIds],
	);

	const toggleScenario = (id: string) => {
		setForm((current) => {
			const selected = new Set(current.scenarioIds ?? []);
			if (selected.has(id)) selected.delete(id);
			else selected.add(id);
			return { ...current, scenarioIds: Array.from(selected) };
		});
	};

	const effectiveJudgeModelId = form.judgeModelId || form.benignModelId;
	const selfJudgingWarning =
		effectiveJudgeModelId && effectiveJudgeModelId === form.attackerModelId
			? "Judge and attacker are the same model — results will be biased. Pick a different judge model."
			: null;

	const handleSubmit = () => {
		if (!form.attackerModelId || !form.benignModelId || !form.defenseConfigId) {
			toast.error("Select attacker model, benign model, and defense.");
			return;
		}
		if (
			selfJudgingWarning &&
			!window.confirm(`${selfJudgingWarning}\n\nProceed anyway?`)
		) {
			return;
		}
		createBulk.mutate(form);
	};

	return (
		<>
			<PageHeading
				title="Bulk runs"
				description="Run every scenario under the same config and compare success across them."
			/>

			<Card>
				<CardHeader>
					<CardTitle>New bulk run</CardTitle>
					<CardDescription>
						Select a model/defense combo and a set of scenarios. Each scenario runs as its own child run.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="grid gap-3 md:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label>Name</Label>
							<Input
								value={form.name}
								onChange={(event) => setForm({ ...form, name: event.target.value })}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Max attempts per scenario</Label>
							<Input
								type="number"
								min={1}
								max={50}
								value={form.maxAttempts}
								onChange={(event) =>
									setForm({ ...form, maxAttempts: Number(event.target.value) || 1 })
								}
							/>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label>Replicates per scenario</Label>
							<Input
								type="number"
								min={1}
								max={20}
								value={form.replicas ?? 1}
								onChange={(event) =>
									setForm({ ...form, replicas: Number(event.target.value) || 1 })
								}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Shuffle seed (empty = random)</Label>
							<Input
								type="number"
								min={0}
								value={form.shuffleSeed ?? ""}
								onChange={(event) => {
									const raw = event.target.value;
									setForm({ ...form, shuffleSeed: raw === "" ? undefined : Number(raw) });
								}}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Concurrency (parallel runs in this bulk)</Label>
							<Input
								type="number"
								min={1}
								max={8}
								value={form.concurrency ?? 1}
								onChange={(event) =>
									setForm({ ...form, concurrency: Math.max(1, Math.min(8, Number(event.target.value) || 1)) })
								}
							/>
							<p className="text-xs text-muted-foreground">
								1 = strictly serial. Raise to fan out independent scenarios; per-model cap below
								keeps any single model from being overrun.
							</p>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Per-model concurrency cap</Label>
							<Input
								type="number"
								min={1}
								max={8}
								value={form.perModelConcurrency ?? 4}
								onChange={(event) =>
									setForm({
										...form,
										perModelConcurrency: Math.max(1, Math.min(8, Number(event.target.value) || 4)),
									})
								}
							/>
							<p className="text-xs text-muted-foreground">
								Max simultaneous calls hitting the same model id (defends against rate limits).
							</p>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-3">
						<ModelPicker
							label="Attacker model"
							value={form.attackerModelId}
							options={filterModelsByRole(models.data ?? [], "attacker")}
							onChange={(value) => setForm({ ...form, attackerModelId: value })}
						/>
						<ModelPicker
							label="Benign model"
							value={form.benignModelId}
							options={filterModelsByRole(models.data ?? [], "benign")}
							onChange={(value) => setForm({ ...form, benignModelId: value })}
						/>
						<ModelPicker
							label="Judge model (optional)"
							value={form.judgeModelId ?? ""}
							options={filterModelsByRole(models.data ?? [], "judge")}
							onChange={(value) => setForm({ ...form, judgeModelId: value || undefined })}
							allowEmpty
						/>
					</div>
					{selfJudgingWarning ? (
						<p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
							⚠ {selfJudgingWarning}
						</p>
					) : null}

					<div className="grid gap-3 md:grid-cols-3">
						<div className="flex flex-col gap-1">
							<Label>Attacker prompt schema</Label>
							<Select
								value={form.attackerPromptVersion}
								onValueChange={(v) =>
									setForm({ ...form, attackerPromptVersion: v as BulkRunInput["attackerPromptVersion"] })
								}
							>
								<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{ATTACKER_PROMPT_VERSIONS.map((v) => (
											<SelectItem key={v} value={v}>{v}</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Benign prompt schema</Label>
							<Select
								value={form.benignPromptVersion}
								onValueChange={(v) =>
									setForm({ ...form, benignPromptVersion: v as BulkRunInput["benignPromptVersion"] })
								}
							>
								<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{BENIGN_PROMPT_VERSIONS.map((v) => (
											<SelectItem key={v} value={v}>{v}</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Judge prompt schema</Label>
							<Select
								value={form.judgePromptVersion}
								onValueChange={(v) =>
									setForm({ ...form, judgePromptVersion: v as BulkRunInput["judgePromptVersion"] })
								}
							>
								<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{JUDGE_PROMPT_VERSIONS.map((v) => (
											<SelectItem key={v} value={v}>{v}</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label>Defense</Label>
							<Select
								value={form.defenseConfigId}
								onValueChange={(value) => setForm({ ...form, defenseConfigId: value })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select defense" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{(defenses.data ?? []).map((defense) => (
											<SelectItem key={defense.id} value={defense.id}>
												{defense.name} ({defense.mode})
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Retrieval top-K</Label>
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
											topK: Number(event.target.value) || 1,
										},
									})
								}
							/>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<Label>Scenarios ({allSelected ? "all" : form.scenarioIds!.length} selected)</Label>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setForm({ ...form, scenarioIds: [] })}
							>
								Run all
							</Button>
						</div>
						<div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
							{(scenarios.data ?? []).map((scenario) => {
								const selected =
									allSelected || (form.scenarioIds ?? []).includes(scenario.id);
								return (
									<label
										key={scenario.id}
										className="flex items-center gap-2 text-sm cursor-pointer"
									>
										<Checkbox
											checked={selected}
											onCheckedChange={() => toggleScenario(scenario.id)}
										/>
										<span>{scenario.name}</span>
									</label>
								);
							})}
						</div>
					</div>

					<div>
						<Button
							onClick={handleSubmit}
							disabled={createBulk.isPending || readOnly}
							title={readOnly ? "Read-only in production — run locally to start bulk runs" : undefined}
						>
							<PlayIcon data-icon="inline-start" />
							{createBulk.isPending ? "Starting…" : "Start bulk run"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-4">
					<CardTitle>Previous bulk runs</CardTitle>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={selectedIds.length < 2}
						onClick={() =>
							navigate({
								to: "/bulk-runs/compare",
								search: { ids: selectedIds.join(",") },
							})
						}
					>
						<GitCompareIcon data-icon="inline-start" />
						Compare ({selectedIds.length})
					</Button>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-8" />
								<TableHead>Name</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Runs</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="w-8" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(bulkRuns.data ?? []).map((bulk) => {
								const checked = selectedIds.includes(bulk.id);
								return (
									<TableRow key={bulk.id}>
										<TableCell>
											<Checkbox
												checked={checked}
												onCheckedChange={() =>
													setSelectedIds((current) =>
														current.includes(bulk.id)
															? current.filter((id) => id !== bulk.id)
															: [...current, bulk.id],
													)
												}
											/>
										</TableCell>
										<TableCell>
											<Link
												to="/bulk-runs/$bulkRunId"
												params={{ bulkRunId: bulk.id }}
												className="font-medium hover:underline"
											>
												{bulk.name}
											</Link>
										</TableCell>
										<TableCell className="capitalize">{bulk.status}</TableCell>
										<TableCell>{bulk.totalRuns}</TableCell>
										<TableCell>{new Date(bulk.createdAt).toLocaleString()}</TableCell>
									<TableCell>
										<Button
											size="icon"
											variant="ghost"
											className="h-7 w-7 text-destructive hover:text-destructive"
											disabled={deleteBulk.isPending}
											onClick={() => {
												if (window.confirm(`Delete "${bulk.name}" and all its child runs?`)) {
													deleteBulk.mutate(bulk.id);
												}
											}}
										>
											<Trash2Icon className="h-4 w-4" />
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
						{bulkRuns.data && bulkRuns.data.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center text-muted-foreground">
									No bulk runs yet.
								</TableCell>
								</TableRow>
							) : null}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

type ModelPickerOption = { id: string; name: string };

function ModelPicker({
	label,
	value,
	options,
	onChange,
	allowEmpty,
}: {
	label: string;
	value: string;
	options: ModelPickerOption[];
	onChange: (value: string) => void;
	allowEmpty?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1">
			<Label>{label}</Label>
			<Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
				<SelectTrigger>
					<SelectValue placeholder="Select model" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{allowEmpty ? <SelectItem value="__none__">(none)</SelectItem> : null}
						{options.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
