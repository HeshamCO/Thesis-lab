import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheckIcon, CircleXIcon, Loader2Icon, PlugZapIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";
import type {
	ModelConfig,
	ModelConfigInput,
	ModelConnectionResult,
	ModelProvider,
} from "#/lib/thesis/schemas";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/models/")({ component: ModelsPage });

const PROVIDER_OPTIONS: ReadonlyArray<{ value: ModelProvider; label: string }> = [
	{ value: "openai-compat", label: "OpenAI-compatible" },
	{ value: "cliproxy", label: "cliproxy (local)" },
	{ value: "openrouter", label: "OpenRouter" },
	{ value: "ollama", label: "Ollama" },
];

const emptyModel: ModelConfigInput = {
	name: "",
	baseUrl: "https://api.openai.com/v1",
	modelName: "gpt-4.1-mini",
	apiKeyEnvVar: "OPENAI_API_KEY",
	temperature: 0.2,
	maxTokens: 1200,
	roleTags: ["attacker", "benign", "judge"],
	provider: "openai-compat",
};

function ModelsPage() {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<ModelConfigInput>(emptyModel);
	const [connectionByModelId, setConnectionByModelId] = useState<Record<string, ModelConnectionState>>({});
	const queryClient = useQueryClient();
	const models = useQuery({ queryKey: queryKeys.models, queryFn: api.models });
	const testModel = useMutation({
		mutationFn: (model: ModelConfig) => api.testModel(model.id),
		onMutate: (model) => {
			setConnectionByModelId((current) => ({
				...current,
				[model.id]: {
					status: "testing",
					message: "Checking endpoint and model response...",
				},
			}));
		},
		onSuccess: (result, model) => {
			setConnectionByModelId((current) => ({
				...current,
				[model.id]: toConnectionState(result),
			}));
			if (result.ok) {
				toast.success(`${model.name} connected`);
			} else {
				toast.error(`${model.name} failed: ${result.message}`);
			}
		},
		onError: (error, model) => {
			setConnectionByModelId((current) => ({
				...current,
				[model.id]: {
					status: "failed",
					message: error.message,
				},
			}));
			toast.error(`${model.name} failed: ${error.message}`);
		},
	});
	const saveModel = useMutation({
		mutationFn: (input: ModelConfigInput) => (editingId ? api.updateModel(editingId, input) : api.createModel(input)),
		onSuccess: (model) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.models });
			toast.success(editingId ? "Model updated" : "Model created");
			testModel.mutate(model);
			setEditingId(null);
			setForm(emptyModel);
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteModel = useMutation({
		mutationFn: api.deleteModel,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.models });
			toast.success("Model deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<>
			<PageHeading
				title="Model configurations"
				description="Reference OpenAI-compatible models by endpoint, model name, and environment variable."
			/>

			<Card>
				<CardHeader>
					<CardTitle>{editingId ? "Edit model" : "Create model"}</CardTitle>
					<CardDescription>API keys stay in `.env.local`; configs store only the env var name.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-3"
						onSubmit={(event) => {
							event.preventDefault();
							saveModel.mutate(form);
						}}
					>
						<Field label="Name">
							<Input
								value={form.name}
								onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
								required
							/>
						</Field>
						<Field label="Base URL">
							<Input
								value={form.baseUrl}
								onChange={(event) => setForm({ ...form, baseUrl: event.currentTarget.value })}
								required
							/>
						</Field>
						<Field label="Model name">
							<Input
								value={form.modelName}
								onChange={(event) => setForm({ ...form, modelName: event.currentTarget.value })}
								required
							/>
						</Field>
						<Field label="API key env var">
							<Input
								value={form.apiKeyEnvVar}
								onChange={(event) =>
									setForm({
										...form,
										apiKeyEnvVar: event.currentTarget.value,
									})
								}
								required
							/>
						</Field>
						<Field label="Temperature">
							<Input
								type="number"
								step="0.1"
								value={form.temperature}
								onChange={(event) =>
									setForm({
										...form,
										temperature: Number(event.currentTarget.value),
									})
								}
							/>
						</Field>
						<Field label="Max tokens">
							<Input
								type="number"
								value={form.maxTokens}
								onChange={(event) =>
									setForm({
										...form,
										maxTokens: Number(event.currentTarget.value),
									})
								}
							/>
						</Field>
						<Field label="Role tags">
							<Input
								value={form.roleTags.join(", ")}
								onChange={(event) =>
									setForm({
										...form,
										roleTags: splitList(event.currentTarget.value),
									})
								}
							/>
						</Field>
						<Field label="Provider">
							<select
								className="border-input bg-background h-9 rounded-md border px-3 text-sm"
								value={form.provider ?? "openai-compat"}
								onChange={(event) =>
									setForm({
										...form,
										provider: event.currentTarget.value as ModelProvider,
									})
								}
							>
								{PROVIDER_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</Field>
						<div className="flex items-end gap-2 md:col-span-2">
							<Button type="submit" disabled={saveModel.isPending}>
								<SaveIcon data-icon="inline-start" />
								{editingId ? "Save model" : "Create model"}
							</Button>
							{editingId ? (
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setEditingId(null);
										setForm(emptyModel);
									}}
								>
									Cancel
								</Button>
							) : null}
						</div>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configured models</CardTitle>
					<CardDescription>Use role tags to remember intended use; run selection remains explicit.</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Provider</TableHead>
								<TableHead>Model</TableHead>
								<TableHead>Endpoint</TableHead>
								<TableHead>Env var</TableHead>
								<TableHead>Connection</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(models.data ?? []).map((model) => {
								const connection = connectionByModelId[model.id] ?? {
									status: "unknown",
									message: "Not tested in this session.",
								};
								return (
									<TableRow key={model.id}>
										<TableCell>{model.name}</TableCell>
										<TableCell>
											<Badge variant="outline">{model.provider ?? "—"}</Badge>
										</TableCell>
										<TableCell>{model.modelName}</TableCell>
										<TableCell>{model.baseUrl}</TableCell>
										<TableCell>{model.apiKeyEnvVar}</TableCell>
										<TableCell>
											<ModelConnectionBadge connection={connection} />
										</TableCell>
										<TableCell>
											<div className="flex gap-2">
												<Button
													variant="outline"
													size="sm"
													disabled={connection.status === "testing"}
													onClick={() => testModel.mutate(model)}
												>
													<PlugZapIcon data-icon="inline-start" />
													Test
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														setEditingId(model.id);
														setForm(toModelInput(model));
													}}
												>
													Edit
												</Button>
												<Button variant="ghost" size="sm" onClick={() => deleteModel.mutate(model.id)}>
													<Trash2Icon data-icon="inline-start" />
													Delete
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

type ModelConnectionState = {
	status: "unknown" | "testing" | "connected" | "failed";
	message: string;
	latencyMs?: number;
	checkedAt?: string;
	sample?: string;
};

const CONNECTION_BADGES: Record<ModelConnectionState["status"], React.ReactNode> = {
	testing: (
		<Badge
			variant="outline"
			className="bg-[color-mix(in_oklch,var(--info)_12%,transparent)] text-[var(--info)]"
		>
			<Loader2Icon className="animate-spin" />
			Testing
		</Badge>
	),
	connected: (
		<Badge
			variant="outline"
			className="bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]"
		>
			<CircleCheckIcon />
			Live
		</Badge>
	),
	failed: (
		<Badge
			variant="outline"
			className="bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-destructive"
		>
			<CircleXIcon />
			Failed
		</Badge>
	),
	unknown: (
		<Badge variant="outline" className="bg-muted text-muted-foreground">
			Not tested
		</Badge>
	),
};

function ModelConnectionBadge({ connection }: { connection: ModelConnectionState }) {
	const detail =
		connection.status === "connected"
			? `${connection.latencyMs} ms${connection.sample ? ` · ${connection.sample}` : ""}`
			: connection.message;
	return (
		<div className="flex flex-col gap-1">
			{CONNECTION_BADGES[connection.status]}
			<span className={cn("text-muted-foreground text-xs", connection.status === "failed" && "max-w-72")}>
				{detail}
			</span>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-2">
			<Label>{label}</Label>
			{children}
		</label>
	);
}

function splitList(value: string) {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

function toModelInput(model: ModelConfig): ModelConfigInput {
	const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = model;
	return input;
}

function toConnectionState(result: ModelConnectionResult): ModelConnectionState {
	return result;
}
