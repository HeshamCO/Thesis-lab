import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Textarea } from "#/components/ui/textarea";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";
import type {
	EvaluatorType,
	ScenarioDocumentInput,
	ScenarioInput,
	SuccessStepInput,
	ToolDefinitionInput,
} from "#/lib/thesis/schemas";

export const Route = createFileRoute("/scenarios/$scenarioId")({
	component: ScenarioDetailPage,
});

function ScenarioDetailPage() {
	const { scenarioId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const scenario = useQuery({
		queryKey: queryKeys.scenario(scenarioId),
		queryFn: () => api.scenario(scenarioId),
	});
	const [form, setForm] = useState<ScenarioInput | null>(null);

	useEffect(() => {
		if (scenario.data) {
			setForm({
				name: scenario.data.name,
				description: scenario.data.description,
				benignTask: scenario.data.benignTask,
				attackerGoal: scenario.data.attackerGoal,
				retrievalQuery: scenario.data.retrievalQuery,
				notes: scenario.data.notes,
				documents: scenario.data.documents,
				successSteps: scenario.data.successSteps,
				tools: scenario.data.tools,
			});
		}
	}, [scenario.data]);

	const updateScenario = useMutation({
		mutationFn: (data: ScenarioInput) => api.updateScenario(scenarioId, data),
		onSuccess: (updated) => {
			queryClient.setQueryData(queryKeys.scenario(scenarioId), updated);
			queryClient.invalidateQueries({ queryKey: queryKeys.scenarios });
			toast.success("Scenario saved");
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteScenario = useMutation({
		mutationFn: () => api.deleteScenario(scenarioId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.scenarios });
			toast.success("Scenario deleted");
			navigate({ to: "/scenarios" });
		},
		onError: (error) => toast.error(error.message),
	});

	if (!form) {
		return (
			<PageHeading
				title="Scenario"
				description="Loading the selected scenario and success-step evaluator configuration."
			/>
		);
	}

	return (
		<>
			<PageHeading
				title={scenario.data?.name ?? "Scenario"}
				description="Edit the immutable template used when an experiment run starts."
				action={
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => deleteScenario.mutate()} disabled={deleteScenario.isPending}>
							<Trash2Icon data-icon="inline-start" />
							Delete
						</Button>
						<Button onClick={() => updateScenario.mutate(normalizeScenario(form))} disabled={updateScenario.isPending}>
							<SaveIcon data-icon="inline-start" />
							Save
						</Button>
					</div>
				}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Scenario brief</CardTitle>
					<CardDescription>These fields become part of each run snapshot.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<Field label="Name">
							<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} />
						</Field>
						<Field label="Retrieval query">
							<Input
								value={form.retrievalQuery}
								onChange={(event) =>
									setForm({
										...form,
										retrievalQuery: event.currentTarget.value,
									})
								}
							/>
						</Field>
						<Field label="Description">
							<Textarea
								value={form.description}
								onChange={(event) =>
									setForm({
										...form,
										description: event.currentTarget.value,
									})
								}
							/>
						</Field>
						<Field label="Notes">
							<Textarea
								value={form.notes}
								onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })}
							/>
						</Field>
						<Field label="Benign task">
							<Textarea
								value={form.benignTask}
								onChange={(event) => setForm({ ...form, benignTask: event.currentTarget.value })}
							/>
						</Field>
						<Field label="Attacker goal">
							<Textarea
								value={form.attackerGoal}
								onChange={(event) => setForm({ ...form, attackerGoal: event.currentTarget.value })}
							/>
						</Field>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Seed corpus documents</CardTitle>
					<CardDescription>These documents are inserted into each run-isolated RAG store.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{form.documents.map((document, index) => (
						<DocumentEditor
							key={index}
							document={document}
							onChange={(next) =>
								setForm({
									...form,
									documents: replaceAt(form.documents, index, next),
								})
							}
							onRemove={() =>
								setForm({
									...form,
									documents: form.documents.filter((_, itemIndex) => itemIndex !== index),
								})
							}
						/>
					))}
					<Button
						variant="outline"
						type="button"
						onClick={() =>
							setForm({
								...form,
								documents: [...form.documents, { title: "", content: "" }],
							})
						}
					>
						<PlusIcon data-icon="inline-start" />
						Add document
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Ordered success steps</CardTitle>
					<CardDescription>Every required step must pass for a full attack success.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{form.successSteps.map((step, index) => (
						<StepEditor
							key={index}
							step={step}
							onChange={(next) =>
								setForm({
									...form,
									successSteps: replaceAt(form.successSteps, index, next),
								})
							}
							onRemove={() =>
								setForm({
									...form,
									successSteps: form.successSteps.filter((_, itemIndex) => itemIndex !== index),
								})
							}
						/>
					))}
					<Button
						variant="outline"
						type="button"
						onClick={() =>
							setForm({
								...form,
								successSteps: [
									...form.successSteps,
									{
										orderIndex: form.successSteps.length,
										name: "",
										description: "",
										required: true,
										evaluatorType: "contains_text",
										evaluatorConfig: { target: "" },
										feedbackGuidance: "",
									},
								],
							})
						}
					>
						<PlusIcon data-icon="inline-start" />
						Add success step
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Tools</CardTitle>
					<CardDescription>
						Tools the benign assistant can call. Use the `tool_called` / `tool_called_with` / `tool_not_called`
						evaluators on a success step to score whether the attack landed.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{form.tools.map((tool, index) => (
						<ToolEditor
							key={index}
							tool={tool}
							onChange={(next) =>
								setForm({
									...form,
									tools: replaceAt(form.tools, index, next),
								})
							}
							onRemove={() =>
								setForm({
									...form,
									tools: form.tools.filter((_, itemIndex) => itemIndex !== index),
								})
							}
						/>
					))}
					<Button
						variant="outline"
						type="button"
						onClick={() =>
							setForm({
								...form,
								tools: [
									...form.tools,
									{
										orderIndex: form.tools.length,
										name: "",
										description: "",
										parameters: { type: "object", properties: {} },
										executor: { kind: "mock", returnValue: null },
									},
								],
							})
						}
					>
						<PlusIcon data-icon="inline-start" />
						Add tool
					</Button>
				</CardContent>
			</Card>
		</>
	);
}

function DocumentEditor({
	document,
	onChange,
	onRemove,
}: {
	document: ScenarioDocumentInput;
	onChange: (document: ScenarioDocumentInput) => void;
	onRemove: () => void;
}) {
	return (
		<div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
			<Field label="Title">
				<Input
					value={document.title}
					onChange={(event) => onChange({ ...document, title: event.currentTarget.value })}
				/>
			</Field>
			<Field label="Content">
				<Textarea
					value={document.content}
					onChange={(event) => onChange({ ...document, content: event.currentTarget.value })}
				/>
			</Field>
			<Button variant="ghost" type="button" onClick={onRemove}>
				Remove document
			</Button>
		</div>
	);
}

function ToolEditor({
	tool,
	onChange,
	onRemove,
}: {
	tool: ToolDefinitionInput;
	onChange: (tool: ToolDefinitionInput) => void;
	onRemove: () => void;
}) {
	const [parametersText, setParametersText] = useState(() => JSON.stringify(tool.parameters, null, 2));
	const [parametersError, setParametersError] = useState<string | null>(null);
	const [returnValueText, setReturnValueText] = useState(() =>
		tool.executor.kind === "mock" ? JSON.stringify(tool.executor.returnValue ?? null, null, 2) : "",
	);
	const [returnValueError, setReturnValueError] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
			<div className="grid gap-3 md:grid-cols-2">
				<Field label="Name (matches /^[a-zA-Z_][a-zA-Z0-9_]*$/)">
					<Input value={tool.name} onChange={(event) => onChange({ ...tool, name: event.currentTarget.value })} />
				</Field>
				<Field label="Executor">
					<Select
						value={tool.executor.kind}
						onValueChange={(value) =>
							onChange({
								...tool,
								executor:
									value === "http"
										? { kind: "http", method: "POST", url: "", headers: {}, timeoutMs: 5000 }
										: { kind: "mock", returnValue: null },
							})
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="mock">Mock (literal return)</SelectItem>
								<SelectItem value="http">HTTP (call URL)</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			</div>
			<Field label="Description (sent to the model)">
				<Textarea
					value={tool.description}
					onChange={(event) => onChange({ ...tool, description: event.currentTarget.value })}
				/>
			</Field>
			<Field label="Parameters (JSON Schema)">
				<Textarea
					value={parametersText}
					onChange={(event) => {
						const next = event.currentTarget.value;
						setParametersText(next);
						try {
							const parsed = JSON.parse(next) as Record<string, unknown>;
							setParametersError(null);
							onChange({ ...tool, parameters: parsed });
						} catch (error) {
							setParametersError(error instanceof Error ? error.message : "Invalid JSON");
						}
					}}
				/>
				{parametersError ? <p className="m-0 text-xs text-destructive">{parametersError}</p> : null}
			</Field>
			{tool.executor.kind === "mock" ? (
				<Field label="Mock return value (JSON)">
					<Textarea
						value={returnValueText}
						onChange={(event) => {
							const next = event.currentTarget.value;
							setReturnValueText(next);
							try {
								const parsed = JSON.parse(next);
								setReturnValueError(null);
								onChange({ ...tool, executor: { kind: "mock", returnValue: parsed } });
							} catch (error) {
								setReturnValueError(error instanceof Error ? error.message : "Invalid JSON");
							}
						}}
					/>
					{returnValueError ? <p className="m-0 text-xs text-destructive">{returnValueError}</p> : null}
				</Field>
			) : (
				<HttpExecutorEditor executor={tool.executor} onChange={(executor) => onChange({ ...tool, executor })} />
			)}
			<Button variant="ghost" type="button" onClick={onRemove}>
				Remove tool
			</Button>
		</div>
	);
}

type HttpExecutor = Extract<ToolDefinitionInput["executor"], { kind: "http" }>;

function HttpExecutorEditor({
	executor,
	onChange,
}: {
	executor: HttpExecutor;
	onChange: (executor: HttpExecutor) => void;
}) {
	return (
		<div className="grid gap-3 md:grid-cols-[8rem_1fr_8rem]">
			<Field label="Method">
				<Select
					value={executor.method}
					onValueChange={(value) => onChange({ ...executor, method: value as HttpExecutor["method"] })}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="GET">GET</SelectItem>
							<SelectItem value="POST">POST</SelectItem>
							<SelectItem value="PUT">PUT</SelectItem>
							<SelectItem value="DELETE">DELETE</SelectItem>
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
			<Field label="URL">
				<Input value={executor.url} onChange={(event) => onChange({ ...executor, url: event.currentTarget.value })} />
			</Field>
			<Field label="Timeout (ms)">
				<Input
					type="number"
					value={executor.timeoutMs}
					onChange={(event) => onChange({ ...executor, timeoutMs: Number(event.currentTarget.value) || 5000 })}
				/>
			</Field>
		</div>
	);
}

function StepEditor({
	step,
	onChange,
	onRemove,
}: {
	step: SuccessStepInput;
	onChange: (step: SuccessStepInput) => void;
	onRemove: () => void;
}) {
	const configValue =
		typeof step.evaluatorConfig.pattern === "string"
			? step.evaluatorConfig.pattern
			: typeof step.evaluatorConfig.target === "string"
				? step.evaluatorConfig.target
				: typeof step.evaluatorConfig.rubric === "string"
					? step.evaluatorConfig.rubric
					: "";
	const toolName = typeof step.evaluatorConfig.toolName === "string" ? step.evaluatorConfig.toolName : "";
	const argumentMatchers =
		step.evaluatorConfig.argumentMatchers && typeof step.evaluatorConfig.argumentMatchers === "object"
			? (step.evaluatorConfig.argumentMatchers as Record<string, string>)
			: {};
	const isToolEval =
		step.evaluatorType === "tool_called" ||
		step.evaluatorType === "tool_not_called" ||
		step.evaluatorType === "tool_called_with";

	return (
		<div className="flex flex-col gap-4 rounded-lg bg-muted p-4">
			<div className="grid gap-4 md:grid-cols-[5rem_1fr_12rem]">
				<Field label="Order">
					<Input
						type="number"
						value={step.orderIndex}
						onChange={(event) =>
							onChange({
								...step,
								orderIndex: Number(event.currentTarget.value),
							})
						}
					/>
				</Field>
				<Field label="Name">
					<Input value={step.name} onChange={(event) => onChange({ ...step, name: event.currentTarget.value })} />
				</Field>
				<Field label="Evaluator">
					<Select
						value={step.evaluatorType}
						onValueChange={(value) =>
							onChange({
								...step,
								evaluatorType: value as EvaluatorType,
								evaluatorConfig: nextEvaluatorConfig(value as EvaluatorType, {
									previousValue: configValue,
									previousToolName: toolName,
									previousMatchers: argumentMatchers,
								}),
							})
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="contains_text">Contains text</SelectItem>
								<SelectItem value="not_contains_text">Avoids text</SelectItem>
								<SelectItem value="regex">Regex</SelectItem>
								<SelectItem value="llm_judge">LLM judge</SelectItem>
								<SelectItem value="tool_called">Tool called</SelectItem>
								<SelectItem value="tool_not_called">Tool not called</SelectItem>
								<SelectItem value="tool_called_with">Tool called with args</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			</div>
			<Field label="Description">
				<Textarea
					value={step.description}
					onChange={(event) => onChange({ ...step, description: event.currentTarget.value })}
				/>
			</Field>
			{isToolEval ? (
				<>
					<Field label="Tool name">
						<Input
							value={toolName}
							onChange={(event) => {
								const nextName = event.currentTarget.value;
								onChange({
									...step,
									evaluatorConfig:
										step.evaluatorType === "tool_called_with"
											? { toolName: nextName, argumentMatchers }
											: { toolName: nextName },
								});
							}}
						/>
					</Field>
					{step.evaluatorType === "tool_called_with" ? (
						<Field label="Argument matchers (one `key=regex` per line)">
							<Textarea
								value={Object.entries(argumentMatchers)
									.map(([key, pattern]) => `${key}=${pattern}`)
									.join("\n")}
								onChange={(event) =>
									onChange({
										...step,
										evaluatorConfig: {
											toolName,
											argumentMatchers: parseArgumentMatchers(event.currentTarget.value),
										},
									})
								}
							/>
						</Field>
					) : null}
				</>
			) : (
				<Field label="Evaluator target, pattern, or rubric">
					<Input
						value={configValue}
						onChange={(event) =>
							onChange({
								...step,
								evaluatorConfig: nextEvaluatorConfig(step.evaluatorType, {
									previousValue: event.currentTarget.value,
									previousToolName: toolName,
									previousMatchers: argumentMatchers,
								}),
							})
						}
					/>
				</Field>
			)}
			<Field label="Feedback guidance">
				<Textarea
					value={step.feedbackGuidance}
					onChange={(event) =>
						onChange({
							...step,
							feedbackGuidance: event.currentTarget.value,
						})
					}
				/>
			</Field>
			<Separator />
			<div className="flex items-center justify-between gap-3">
				<label className="flex items-center gap-2 text-sm">
					<Checkbox
						checked={step.required}
						onCheckedChange={(checked) => onChange({ ...step, required: checked === true })}
					/>
					Required for full success
				</label>
				<Button variant="ghost" type="button" onClick={onRemove}>
					Remove step
				</Button>
			</div>
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

function replaceAt<T>(items: T[], index: number, item: T) {
	return items.map((current, currentIndex) => (currentIndex === index ? item : current));
}

function normalizeScenario(form: ScenarioInput): ScenarioInput {
	return {
		...form,
		documents: form.documents.filter((document) => document.title.trim() && document.content.trim()),
		successSteps: form.successSteps
			.map((step, index) => ({ ...step, orderIndex: index }))
			.filter((step) => step.name.trim()),
		tools: form.tools.map((tool, index) => ({ ...tool, orderIndex: index })).filter((tool) => tool.name.trim()),
	};
}

function nextEvaluatorConfig(
	type: EvaluatorType,
	context: {
		previousValue: string;
		previousToolName: string;
		previousMatchers: Record<string, string>;
	},
): Record<string, unknown> {
	switch (type) {
		case "regex":
			return { pattern: context.previousValue };
		case "llm_judge":
			return { rubric: context.previousValue };
		case "tool_called":
		case "tool_not_called":
			return { toolName: context.previousToolName };
		case "tool_called_with":
			return {
				toolName: context.previousToolName,
				argumentMatchers: context.previousMatchers,
			};
		default:
			return { target: context.previousValue };
	}
}

function parseArgumentMatchers(value: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of value.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const eq = trimmed.indexOf("=");
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		const pattern = trimmed.slice(eq + 1).trim();
		if (key && pattern) {
			out[key] = pattern;
		}
	}
	return out;
}
