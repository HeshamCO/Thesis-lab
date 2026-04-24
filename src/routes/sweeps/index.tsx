import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { api } from "#/lib/thesis/api";
import { filterModelsByRole } from "#/lib/thesis/model-roles";
import { queryKeys } from "#/lib/thesis/query";
import {
	DEFAULT_ATTACKER_PROMPT_VERSION,
	DEFAULT_BENIGN_PROMPT_VERSION,
	DEFAULT_JUDGE_PROMPT_VERSION,
	type BulkRunInput,
} from "#/lib/thesis/schemas";

export const Route = createFileRoute("/sweeps/")({ component: SweepsPage });

type FactorSelections = {
	attackerModelId: string[];
	benignModelId: string[];
	judgeModelId: string[];
	defenseConfigId: string[];
	maxAttempts: number[];
	attackerPromptVersion: string[];
};

function SweepsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const sweeps = useQuery({ queryKey: queryKeys.sweeps, queryFn: api.sweeps });
	const scenarios = useQuery({ queryKey: queryKeys.scenarios, queryFn: api.scenarios });
	const models = useQuery({ queryKey: queryKeys.models, queryFn: api.models });
	const defenses = useQuery({ queryKey: queryKeys.defenses, queryFn: api.defenses });

	const [name, setName] = useState(`Sweep ${new Date().toLocaleString()}`);
	const [factors, setFactors] = useState<FactorSelections>({
		attackerModelId: [],
		benignModelId: [],
		judgeModelId: [],
		defenseConfigId: [],
		maxAttempts: [],
		attackerPromptVersion: [],
	});
	const [replicas, setReplicas] = useState(1);
	const [maxAttemptsBase, setMaxAttemptsBase] = useState(5);
	const [scenarioIds, setScenarioIds] = useState<string[]>([]);

	const createSweep = useMutation({
		mutationFn: api.createSweep,
		onSuccess: ({ sweep, bulks }) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.sweeps });
			queryClient.invalidateQueries({ queryKey: queryKeys.bulkRuns });
			const cellCount = sweep?.factorCells?.length ?? bulks.length;
			toast.success(`Sweep ${sweep?.name ?? name} created with ${cellCount} cell${cellCount === 1 ? "" : "s"}.`);
			navigate({ to: "/sweeps/$sweepId", params: { sweepId: sweep!.id } });
		},
		onError: (error) => toast.error(error.message),
	});

	const factorSummary = [
		factors.attackerModelId.length > 1 ? `attacker×${factors.attackerModelId.length}` : null,
		factors.benignModelId.length > 1 ? `benign×${factors.benignModelId.length}` : null,
		factors.judgeModelId.length > 1 ? `judge×${factors.judgeModelId.length}` : null,
		factors.defenseConfigId.length > 1 ? `defense×${factors.defenseConfigId.length}` : null,
		factors.maxAttempts.length > 1 ? `maxAttempts×${factors.maxAttempts.length}` : null,
		factors.attackerPromptVersion.length > 1 ? `attackerPrompt×${factors.attackerPromptVersion.length}` : null,
	].filter((v) => v !== null);
	const cellEstimate =
		Math.max(1, factors.attackerModelId.length) *
		Math.max(1, factors.benignModelId.length) *
		Math.max(1, factors.judgeModelId.length) *
		Math.max(1, factors.defenseConfigId.length) *
		Math.max(1, factors.maxAttempts.length) *
		Math.max(1, factors.attackerPromptVersion.length);

	const submit = () => {
		const firstAttacker = factors.attackerModelId[0] ?? models.data?.[0]?.id ?? "";
		const firstBenign = factors.benignModelId[0] ?? models.data?.[0]?.id ?? "";
		const firstDefense = factors.defenseConfigId[0] ?? defenses.data?.[0]?.id ?? "";
		if (!firstAttacker || !firstBenign || !firstDefense) {
			toast.error("Pick at least one attacker model, benign model, and defense.");
			return;
		}
		const base: BulkRunInput = {
			name: "sweep-base",
			scenarioIds,
			attackerModelId: firstAttacker,
			benignModelId: firstBenign,
			judgeModelId: factors.judgeModelId[0],
			defenseConfigId: firstDefense,
			maxAttempts: factors.maxAttempts[0] ?? maxAttemptsBase,
			retrievalSettings: { topK: 5, query: "" },
			attackerPromptVersion: (factors.attackerPromptVersion[0] ??
				DEFAULT_ATTACKER_PROMPT_VERSION) as BulkRunInput["attackerPromptVersion"],
			benignPromptVersion: DEFAULT_BENIGN_PROMPT_VERSION,
			judgePromptVersion: DEFAULT_JUDGE_PROMPT_VERSION,
			benignTaskHasSafetyClause: true,
			labelRetrievedDocuments: false,
			structuredBenignOutput: true,
			replicas,
		};
		createSweep.mutate({
			name,
			scenarioIds,
			base,
			factors: {
				attackerModelId: factors.attackerModelId.length > 0 ? factors.attackerModelId : undefined,
				benignModelId: factors.benignModelId.length > 0 ? factors.benignModelId : undefined,
				judgeModelId: factors.judgeModelId.length > 0 ? factors.judgeModelId : undefined,
				defenseConfigId: factors.defenseConfigId.length > 0 ? factors.defenseConfigId : undefined,
				maxAttempts: factors.maxAttempts.length > 0 ? factors.maxAttempts : undefined,
				attackerPromptVersion:
					factors.attackerPromptVersion.length > 0
						? (factors.attackerPromptVersion as Array<BulkRunInput["attackerPromptVersion"]>)
						: undefined,
			},
		});
	};

	const toggle = <K extends keyof FactorSelections>(key: K, value: FactorSelections[K][number]) => {
		setFactors((current) => {
			const list = current[key] as Array<FactorSelections[K][number]>;
			const exists = list.includes(value);
			const next = exists ? list.filter((v) => v !== value) : [...list, value];
			return { ...current, [key]: next } as FactorSelections;
		});
	};

	return (
		<>
			<PageHeading
				title="Sweeps"
				description="Fan a base config across a factor grid. Every cell becomes a bulk run inside one sweep group."
			/>

			<Card>
				<CardHeader>
					<CardTitle>New sweep</CardTitle>
					<CardDescription>
						Tick values for each factor you want to vary. Leaving a factor empty uses the base value.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="grid gap-3 md:grid-cols-3">
						<div className="flex flex-col gap-1">
							<Label>Name</Label>
							<Input value={name} onChange={(e) => setName(e.target.value)} />
						</div>
						<div className="flex flex-col gap-1">
							<Label>Replicas per cell</Label>
							<Input
								type="number"
								min={1}
								max={20}
								value={replicas}
								onChange={(e) => setReplicas(Number(e.target.value) || 1)}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label>Base maxAttempts (used if not varied)</Label>
							<Input
								type="number"
								min={1}
								max={50}
								value={maxAttemptsBase}
								onChange={(e) => setMaxAttemptsBase(Number(e.target.value) || 1)}
							/>
						</div>
					</div>

					<FactorPicker
						title="Attacker models"
						options={filterModelsByRole(models.data ?? [], "attacker").map((m) => ({ label: m.name, value: m.id }))}
						selected={factors.attackerModelId}
						onToggle={(v) => toggle("attackerModelId", v)}
					/>
					<FactorPicker
						title="Benign models"
						options={filterModelsByRole(models.data ?? [], "benign").map((m) => ({ label: m.name, value: m.id }))}
						selected={factors.benignModelId}
						onToggle={(v) => toggle("benignModelId", v)}
					/>
					<FactorPicker
						title="Judge models"
						options={filterModelsByRole(models.data ?? [], "judge").map((m) => ({ label: m.name, value: m.id }))}
						selected={factors.judgeModelId}
						onToggle={(v) => toggle("judgeModelId", v)}
					/>
					<FactorPicker
						title="Defenses"
						options={(defenses.data ?? []).map((d) => ({ label: `${d.name} (${d.mode})`, value: d.id }))}
						selected={factors.defenseConfigId}
						onToggle={(v) => toggle("defenseConfigId", v)}
					/>
					<FactorPicker
						title="maxAttempts"
						options={[1, 3, 5, 10].map((n) => ({ label: String(n), value: n }))}
						selected={factors.maxAttempts}
						onToggle={(v) => toggle("maxAttempts", v as number)}
					/>
					<FactorPicker
						title="Attacker prompt version"
						options={["attacker@v3", "attacker@v4"].map((v) => ({ label: v, value: v }))}
						selected={factors.attackerPromptVersion}
						onToggle={(v) => toggle("attackerPromptVersion", v as string)}
					/>

					<div className="flex flex-col gap-2">
						<Label>Scenarios ({scenarioIds.length === 0 ? "all" : scenarioIds.length} selected)</Label>
						<div className="grid gap-2 rounded-md border border-border/50 p-3 md:grid-cols-2 max-h-64 overflow-auto">
							{(scenarios.data ?? []).map((scenario) => {
								const selected = scenarioIds.length === 0 || scenarioIds.includes(scenario.id);
								return (
									<label key={scenario.id} className="flex items-center gap-2 text-sm cursor-pointer">
										<Checkbox
											checked={selected}
											onCheckedChange={() =>
												setScenarioIds((ids) => {
													const set = new Set(ids);
													if (set.has(scenario.id)) set.delete(scenario.id);
													else set.add(scenario.id);
													return Array.from(set);
												})
											}
										/>
										<span>{scenario.name}</span>
									</label>
								);
							})}
						</div>
					</div>

					<p className="text-sm text-muted-foreground">
						Estimated: {cellEstimate} cell{cellEstimate === 1 ? "" : "s"}
						{factorSummary.length > 0 ? ` · varying ${factorSummary.join(", ")}` : ""} · {replicas} replica
						{replicas === 1 ? "" : "s"} per cell
					</p>
					<div>
						<Button onClick={submit} disabled={createSweep.isPending}>
							<PlayIcon data-icon="inline-start" />
							{createSweep.isPending ? "Creating…" : "Create sweep"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Previous sweeps</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{(sweeps.data ?? []).map((sweep) => (
								<TableRow key={sweep.id}>
									<TableCell>
										<Link to="/sweeps/$sweepId" params={{ sweepId: sweep.id }} className="font-medium hover:underline">
											{sweep.name}
										</Link>
									</TableCell>
									<TableCell>{new Date(sweep.createdAt).toLocaleString()}</TableCell>
								</TableRow>
							))}
							{sweeps.data && sweeps.data.length === 0 ? (
								<TableRow>
									<TableCell colSpan={2} className="text-center text-muted-foreground">
										No sweeps yet.
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

function FactorPicker<T extends string | number>({
	title,
	options,
	selected,
	onToggle,
}: {
	title: string;
	options: Array<{ label: string; value: T }>;
	selected: T[];
	onToggle: (value: T) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label>{title}</Label>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const isSelected = selected.includes(option.value);
					return (
						<button
							key={String(option.value)}
							type="button"
							onClick={() => onToggle(option.value)}
							className={`rounded-full border px-3 py-1 text-xs transition-colors ${
								isSelected
									? "border-primary bg-primary text-primary-foreground"
									: "border-muted-foreground/30 hover:bg-muted"
							}`}
						>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
