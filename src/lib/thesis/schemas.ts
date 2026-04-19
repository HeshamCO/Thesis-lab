import { z } from "zod";

export const defenseModeSchema = z.enum(["none", "prompt_guard", "retrieval_filter", "combined"]);

export const evaluatorTypeSchema = z.enum(["contains_text", "not_contains_text", "regex", "llm_judge"]);

export const runStatusSchema = z.enum(["queued", "running", "pausing", "paused", "completed", "failed"]);

export const ACTIVE_RUN_STATUSES: ReadonlyArray<z.infer<typeof runStatusSchema>> = [
	"queued",
	"running",
	"pausing",
	"paused",
];

export const attemptStatusSchema = z.enum(["running", "completed", "failed"]);

export const retrievalSettingsSchema = z.object({
	topK: z.coerce.number().int().min(1).max(20).default(5),
	query: z.string().trim().optional().default(""),
});

export const successStepInputSchema = z.object({
	id: z.string().optional(),
	orderIndex: z.coerce.number().int().min(0),
	name: z.string().trim().min(1),
	description: z.string().trim().optional().default(""),
	required: z.coerce.boolean().default(true),
	evaluatorType: evaluatorTypeSchema,
	evaluatorConfig: z.record(z.string(), z.unknown()).default({}),
	feedbackGuidance: z.string().trim().optional().default(""),
});

export const scenarioDocumentInputSchema = z.object({
	id: z.string().optional(),
	title: z.string().trim().min(1),
	content: z.string().trim().min(1),
});

export const scenarioInputSchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().trim().optional().default(""),
	benignTask: z.string().trim().min(1),
	attackerGoal: z.string().trim().min(1),
	retrievalQuery: z.string().trim().min(1),
	notes: z.string().trim().optional().default(""),
	documents: z.array(scenarioDocumentInputSchema).default([]),
	successSteps: z.array(successStepInputSchema).min(1),
});

export const modelConfigInputSchema = z.object({
	name: z.string().trim().min(1),
	baseUrl: z.string().trim().url(),
	modelName: z.string().trim().min(1),
	apiKeyEnvVar: z.string().trim().min(1).default("OPENAI_API_KEY"),
	temperature: z.coerce.number().min(0).max(2).default(0.2),
	maxTokens: z.coerce.number().int().min(32).max(20000).default(1200),
	roleTags: z.array(z.string().trim().min(1)).default([]),
});

export const defenseConfigInputSchema = z.object({
	name: z.string().trim().min(1),
	mode: defenseModeSchema,
	defensivePrompt: z.string().trim().optional().default(""),
	blockedPatterns: z.array(z.string().trim().min(1)).default([]),
	retrievalFilterEnabled: z.coerce.boolean().default(false),
});

export const startRunInputSchema = z.object({
	scenarioId: z.string().min(1),
	attackerModelId: z.string().min(1),
	benignModelId: z.string().min(1),
	defenseConfigId: z.string().min(1),
	maxAttempts: z.coerce.number().int().min(1).max(50),
	retrievalSettings: retrievalSettingsSchema,
});

export type DefenseMode = z.infer<typeof defenseModeSchema>;
export type EvaluatorType = z.infer<typeof evaluatorTypeSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;
export type RetrievalSettings = z.infer<typeof retrievalSettingsSchema>;
export type SuccessStepInput = z.infer<typeof successStepInputSchema>;
export type ScenarioDocumentInput = z.infer<typeof scenarioDocumentInputSchema>;
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export type ModelConfigInput = z.infer<typeof modelConfigInputSchema>;
export type DefenseConfigInput = z.infer<typeof defenseConfigInputSchema>;
export type StartRunInput = z.infer<typeof startRunInputSchema>;

export type Scenario = ScenarioInput & {
	id: string;
	createdAt: string;
	updatedAt: string;
};

export type ModelConfig = ModelConfigInput & {
	id: string;
	createdAt: string;
	updatedAt: string;
};

export type ModelConnectionResult = {
	ok: boolean;
	status: "connected" | "failed";
	message: string;
	latencyMs: number;
	checkedAt: string;
	sample?: string;
};

export type DefenseConfig = DefenseConfigInput & {
	id: string;
	createdAt: string;
	updatedAt: string;
};

export type RunSummary = {
	finalSuccess: boolean;
	attemptsUsed: number;
	attackSuccessRate: number;
	utilityScore: number;
};

export type RunListItem = {
	id: string;
	status: RunStatus;
	scenarioName: string;
	defenseName: string;
	attackerModelName: string;
	benignModelName: string;
	maxAttempts: number;
	summary: RunSummary | null;
	error: string;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
};

export type AttemptRecord = {
	id: string;
	runId: string;
	attemptNumber: number;
	status: AttemptStatus;
	injectionPrompt: string;
	injectedDocument: string;
	rationale: string;
	retrievedContext: Array<{ title: string; content: string; source: string }>;
	benignResponse: string;
	feedback: string;
	success: boolean;
	utilityScore: number;
	error: string;
	createdAt: string;
	completedAt: string | null;
};

export type StepResultRecord = {
	id: string;
	attemptId: string;
	orderIndex: number;
	stepSnapshot: SuccessStepInput;
	passed: boolean;
	score: number;
	evaluatorOutput: string;
	evidence: string;
	createdAt: string;
};

export type RunLogRecord = {
	id: string;
	runId: string;
	level: "info" | "warn" | "error";
	eventType: string;
	message: string;
	payload: Record<string, unknown>;
	createdAt: string;
};

export type RunDetail = RunListItem & {
	scenarioSnapshot: Scenario;
	defenseSnapshot: DefenseConfig;
	attackerModelSnapshot: ModelConfig;
	benignModelSnapshot: ModelConfig;
	retrievalSettings: RetrievalSettings;
	attempts: AttemptRecord[];
	stepResults: StepResultRecord[];
	logs: RunLogRecord[];
};
