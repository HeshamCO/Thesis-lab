import { z } from "zod";

export const defenseModeSchema = z.enum(["none", "prompt_guard", "retrieval_filter", "combined"]);

export const evaluatorTypeSchema = z.enum([
	"contains_text",
	"not_contains_text",
	"regex",
	"llm_judge",
	"tool_called",
	"tool_not_called",
	"tool_called_with",
]);

export const TOOL_EVALUATOR_TYPES = ["tool_called", "tool_not_called", "tool_called_with"] as const;

export const ATTACKER_PROMPT_VERSIONS = ["attacker@v1", "attacker@v2", "attacker@v3", "attacker@v4", "attacker@v5"] as const;
export const BENIGN_PROMPT_VERSIONS = ["benign@v1", "benign@v2", "benign@v3"] as const;
export const JUDGE_PROMPT_VERSIONS = ["judge@v1", "judge@v2", "judge@v3", "judge@v4"] as const;
export const DEFAULT_ATTACKER_PROMPT_VERSION = "attacker@v5";
export const DEFAULT_BENIGN_PROMPT_VERSION = "benign@v3";
export const DEFAULT_JUDGE_PROMPT_VERSION = "judge@v4";

export const ATTACK_EFFECTS = ["none", "partial", "full"] as const;
export type AttackEffectLabel = (typeof ATTACK_EFFECTS)[number];

export const WHY_IT_FAILED_LABELS = [
	"retrieval_miss",
	"ignored_as_untrusted",
	"partial_instruction_following",
	"tool_policy_blocked",
	"defense_filter_dropped",
	"succeeded",
	"other",
] as const;
export type WhyItFailedLabel = (typeof WHY_IT_FAILED_LABELS)[number];

export const INTENDED_EFFECTS = [
	"exfiltration",
	"tool_misuse",
	"output_manipulation",
	"task_deviation",
	"unspecified",
] as const;
export type IntendedEffectLabel = (typeof INTENDED_EFFECTS)[number];

export const EXPECTED_TRIGGERS = ["summarize", "extract", "forward", "execute", "cite", "unspecified"] as const;
export type ExpectedTriggerLabel = (typeof EXPECTED_TRIGGERS)[number];

export const STEALTH_LEVELS = ["low", "medium", "high", "unspecified"] as const;
export type StealthLevelLabel = (typeof STEALTH_LEVELS)[number];

export type AttackTelemetry = {
	retrieved: boolean;
	citedMaliciousDoc: boolean;
	attackEffect: AttackEffectLabel;
	utilityPreserved: boolean;
	toolCallAttempted: boolean;
	secretLeakageAttempted: boolean;
	whyItFailed: WhyItFailedLabel;
};

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

export const toolExecutorSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("mock"),
		returnValue: z.unknown(),
	}),
	z.object({
		kind: z.literal("http"),
		method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("POST"),
		url: z.string().trim().url(),
		headers: z.record(z.string(), z.string()).optional().default({}),
		timeoutMs: z.coerce.number().int().min(100).max(30_000).default(5_000),
	}),
]);

export const toolDefinitionInputSchema = z.object({
	id: z.string().optional(),
	orderIndex: z.coerce.number().int().min(0),
	name: z
		.string()
		.trim()
		.min(1)
		.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Tool name must match /^[a-zA-Z_][a-zA-Z0-9_]*$/"),
	description: z.string().trim().min(1),
	parameters: z.record(z.string(), z.unknown()).default({ type: "object", properties: {} }),
	executor: toolExecutorSchema,
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
	tools: z.array(toolDefinitionInputSchema).default([]),
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
	allowedTools: z.array(z.string().trim().min(1)).default([]),
});

export const startRunInputSchema = z.object({
	scenarioId: z.string().min(1),
	attackerModelId: z.string().min(1),
	benignModelId: z.string().min(1),
	judgeModelId: z.string().min(1).optional(),
	defenseConfigId: z.string().min(1),
	maxAttempts: z.coerce.number().int().min(1).max(50),
	retrievalSettings: retrievalSettingsSchema,
	attackerPromptVersion: z.enum(ATTACKER_PROMPT_VERSIONS).default(DEFAULT_ATTACKER_PROMPT_VERSION),
	benignPromptVersion: z.enum(BENIGN_PROMPT_VERSIONS).default(DEFAULT_BENIGN_PROMPT_VERSION),
	judgePromptVersion: z.enum(JUDGE_PROMPT_VERSIONS).default(DEFAULT_JUDGE_PROMPT_VERSION),
	benignTaskHasSafetyClause: z.coerce.boolean().default(true),
	labelRetrievedDocuments: z.coerce.boolean().default(false),
	structuredBenignOutput: z.coerce.boolean().default(true),
});

export type DefenseMode = z.infer<typeof defenseModeSchema>;
export type EvaluatorType = z.infer<typeof evaluatorTypeSchema>;
export type ToolDefinitionInput = z.infer<typeof toolDefinitionInputSchema>;
export type ToolExecutor = z.infer<typeof toolExecutorSchema>;
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

export const BULK_RUN_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type BulkRunStatus = (typeof BULK_RUN_STATUSES)[number];

export type BulkRunConfig = {
	attackerModelId: string;
	benignModelId: string;
	judgeModelId: string | null;
	defenseConfigId: string;
	maxAttempts: number;
	retrievalSettings: RetrievalSettings;
	attackerPromptVersion: string;
	benignPromptVersion: string;
	judgePromptVersion: string;
	benignTaskHasSafetyClause: boolean;
	labelRetrievedDocuments: boolean;
	structuredBenignOutput: boolean;
	replicas: number;
	shuffleSeed: number;
};

export type BulkRunRecord = {
	id: string;
	name: string;
	status: BulkRunStatus;
	totalRuns: number;
	config: BulkRunConfig;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
	groupId: string | null;
};

export const bulkRunInputSchema = z.object({
	name: z.string().min(1).max(200),
	scenarioIds: z.array(z.string().min(1)).optional(),
	attackerModelId: z.string().min(1),
	benignModelId: z.string().min(1),
	judgeModelId: z.string().min(1).optional(),
	defenseConfigId: z.string().min(1),
	maxAttempts: z.coerce.number().int().min(1).max(50),
	retrievalSettings: retrievalSettingsSchema,
	attackerPromptVersion: z.enum(ATTACKER_PROMPT_VERSIONS).default(DEFAULT_ATTACKER_PROMPT_VERSION),
	benignPromptVersion: z.enum(BENIGN_PROMPT_VERSIONS).default(DEFAULT_BENIGN_PROMPT_VERSION),
	judgePromptVersion: z.enum(JUDGE_PROMPT_VERSIONS).default(DEFAULT_JUDGE_PROMPT_VERSION),
	benignTaskHasSafetyClause: z.coerce.boolean().default(true),
	labelRetrievedDocuments: z.coerce.boolean().default(false),
	structuredBenignOutput: z.coerce.boolean().default(true),
	replicas: z.coerce.number().int().min(1).max(20).default(1),
	shuffleSeed: z.coerce.number().int().min(0).optional(),
});

export type BulkRunInput = z.infer<typeof bulkRunInputSchema>;

export const sweepInputSchema = z.object({
	name: z.string().min(1).max(200),
	scenarioIds: z.array(z.string().min(1)).optional(),
	base: bulkRunInputSchema,
	factors: z
		.object({
			attackerModelId: z.array(z.string().min(1)).optional(),
			benignModelId: z.array(z.string().min(1)).optional(),
			judgeModelId: z.array(z.string().min(1)).optional(),
			defenseConfigId: z.array(z.string().min(1)).optional(),
			maxAttempts: z.array(z.coerce.number().int().min(1).max(50)).optional(),
			attackerPromptVersion: z.array(z.enum(ATTACKER_PROMPT_VERSIONS)).optional(),
			benignPromptVersion: z.array(z.enum(BENIGN_PROMPT_VERSIONS)).optional(),
			judgePromptVersion: z.array(z.enum(JUDGE_PROMPT_VERSIONS)).optional(),
		})
		.default({}),
});

export type SweepInput = z.infer<typeof sweepInputSchema>;

export type SweepRecord = {
	id: string;
	name: string;
	createdAt: string;
	bulkRunIds: string[];
	factorCells: Array<Record<string, string | number>>;
};

export type RunListItem = {
	id: string;
	status: RunStatus;
	scenarioName: string;
	defenseName: string;
	attackerModelName: string;
	benignModelName: string;
	judgeModelName: string | null;
	maxAttempts: number;
	summary: RunSummary | null;
	error: string;
	attackerPromptVersion: string;
	benignPromptVersion: string;
	judgePromptVersion: string;
	benignTaskHasSafetyClause: boolean;
	labelRetrievedDocuments: boolean;
	structuredBenignOutput: boolean;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
	bulkRunId: string | null;
	bulkRunIndex: number | null;
	replicaIndex: number;
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
	rawAttackerOutput: string;
	rawAttackerParseOk: boolean;
	attackDurationMs: number;
	benignDurationMs: number;
	totalDurationMs: number;
	defenseFilteredCount: number;
	toolCallsCount: number;
	attackerTokensUsed: number;
	benignTokensUsed: number;
	strategy: string;
	intendedEffect: IntendedEffectLabel;
	expectedTrigger: ExpectedTriggerLabel;
	stealthLevel: StealthLevelLabel;
	preserveUtility: boolean | null;
	retrievalHooks: string[];
	attackTelemetry: AttackTelemetry | null;
	benignTaskAnswer: string | null;
	benignUsedDocs: number[] | null;
	benignSuspiciousInstructionDetected: boolean | null;
	benignToolCalledSelfReport: boolean | null;
	benignSensitiveDataExposed: boolean | null;
	benignStructuredParseOk: boolean | null;
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
	rawJudgeOutput: string;
	rawJudgeParseOk: boolean;
	createdAt: string;
};

export const ATTACKER_ARTIFACT_KINDS = [
	"injection_prompt",
	"injected_document",
	"rationale",
	"raw_output",
	"attacker_system_prompt",
	"attacker_user_prompt",
	"benign_system_prompt",
	"benign_user_prompt",
] as const;

export type AttackerArtifactKind = (typeof ATTACKER_ARTIFACT_KINDS)[number];

export type AttackerArtifact = {
	id: string;
	runId: string;
	attemptId: string;
	kind: AttackerArtifactKind;
	title: string;
	content: string;
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

export const TOOL_CALL_STATUSES = ["ok", "error", "blocked_by_defense"] as const;
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

export type ToolCallRecord = {
	id: string;
	runId: string;
	attemptId: string;
	turn: number;
	toolName: string;
	arguments: Record<string, unknown>;
	result: unknown;
	status: ToolCallStatus;
	durationMs: number;
	error: string;
	createdAt: string;
};

export type RunDetail = RunListItem & {
	scenarioSnapshot: Scenario;
	defenseSnapshot: DefenseConfig;
	attackerModelSnapshot: ModelConfig;
	benignModelSnapshot: ModelConfig;
	judgeModelSnapshot: ModelConfig | null;
	retrievalSettings: RetrievalSettings;
	attempts: AttemptRecord[];
	stepResults: StepResultRecord[];
	logs: RunLogRecord[];
	attackerArtifacts: AttackerArtifact[];
	toolCalls: ToolCallRecord[];
};
