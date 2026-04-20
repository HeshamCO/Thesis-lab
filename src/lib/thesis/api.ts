import type {
	AttackerArtifact,
	AttemptRecord,
	DefenseConfig,
	DefenseConfigInput,
	ModelConfig,
	ModelConnectionResult,
	ModelConfigInput,
	RunDetail,
	RunListItem,
	RunLogRecord,
	Scenario,
	ScenarioInput,
	StartRunInput,
	StepResultRecord,
} from "./schemas";

export type AttemptDetail = {
	attempt: AttemptRecord;
	stepResults: StepResultRecord[];
	artifacts: AttackerArtifact[];
	logs: RunLogRecord[];
};

type DashboardData = {
	activeRun?: RunListItem;
	recentRuns: RunListItem[];
	scenarioCount: number;
	modelCount: number;
	defenseCount: number;
	runCount: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});

	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(body?.error ?? `Request failed with ${response.status}`);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}

export const api = {
	dashboard: () => request<DashboardData>("/api/dashboard"),
	scenarios: () => request<Scenario[]>("/api/scenarios"),
	scenario: (id: string) => request<Scenario>(`/api/scenarios/${id}`),
	createScenario: (data: ScenarioInput) =>
		request<Scenario>("/api/scenarios", {
			method: "POST",
			body: JSON.stringify(data),
		}),
	updateScenario: (id: string, data: ScenarioInput) =>
		request<Scenario>(`/api/scenarios/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),
	deleteScenario: (id: string) => request<void>(`/api/scenarios/${id}`, { method: "DELETE" }),
	models: () => request<ModelConfig[]>("/api/models"),
	createModel: (data: ModelConfigInput) =>
		request<ModelConfig>("/api/models", {
			method: "POST",
			body: JSON.stringify(data),
		}),
	updateModel: (id: string, data: ModelConfigInput) =>
		request<ModelConfig>(`/api/models/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),
	deleteModel: (id: string) => request<void>(`/api/models/${id}`, { method: "DELETE" }),
	testModel: (id: string) =>
		request<ModelConnectionResult>(`/api/models/${id}/test`, {
			method: "POST",
		}),
	defenses: () => request<DefenseConfig[]>("/api/defenses"),
	createDefense: (data: DefenseConfigInput) =>
		request<DefenseConfig>("/api/defenses", {
			method: "POST",
			body: JSON.stringify(data),
		}),
	updateDefense: (id: string, data: DefenseConfigInput) =>
		request<DefenseConfig>(`/api/defenses/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),
	deleteDefense: (id: string) => request<void>(`/api/defenses/${id}`, { method: "DELETE" }),
	runs: () => request<RunListItem[]>("/api/runs"),
	run: (id: string) => request<RunDetail>(`/api/runs/${id}`),
	startRun: (data: StartRunInput) =>
		request<RunDetail>("/api/runs", {
			method: "POST",
			body: JSON.stringify(data),
		}),
	pauseRun: (id: string) => request<RunDetail>(`/api/runs/${id}/pause`, { method: "POST" }),
	resumeRun: (id: string) => request<RunDetail>(`/api/runs/${id}/resume`, { method: "POST" }),
	attempt: (runId: string, attemptId: string) => request<AttemptDetail>(`/api/runs/${runId}/attempts/${attemptId}`),
	artifact: (runId: string, attemptId: string, artifactId: string) =>
		request<AttackerArtifact>(`/api/runs/${runId}/attempts/${attemptId}/artifacts/${artifactId}`),
};
