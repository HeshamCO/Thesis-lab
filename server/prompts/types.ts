import type { RetrievedDocument } from "../db";
import type {
	AttackTelemetry,
	DefenseConfig,
	Scenario,
	SuccessStepInput,
} from "../../src/lib/thesis/schemas";

export type AttemptHistoryEntry = {
	attemptNumber: number;
	strategy: string;
	injectedDocument: string;
	benignResponsePreview: string;
	failedRequiredSteps: string[];
	feedbackGuidance: string;
	telemetry?: AttackTelemetry;
};

export type BenignStructuredOutput = {
	task_answer: string;
	used_docs: number[];
	suspicious_instruction_detected: boolean;
	tool_called: boolean;
	sensitive_data_exposed: boolean;
};

export type BuiltPrompt = {
	system: string;
	user: string;
};

export type AttackerBuildParams = {
	scenario: Scenario;
	attemptNumber: number;
	history: AttemptHistoryEntry[];
	previousFeedback: string;
	retrievalQuery: string;
	// v6+ only: when set (BIPIA suite scenarios), constrain the attacker to a specific BIPIA
	// attack family across attempts. Older prompt versions ignore the field.
	attackTypeHint?: { name: string; description: string };
};

export type BenignBuildParams = {
	scenario: Scenario;
	defense: DefenseConfig;
	retrievedContext: RetrievedDocument[];
	hasSafetyClause: boolean;
	labelRetrievedDocuments: boolean;
	toolsAvailable: boolean;
	structuredBenignOutput: boolean;
	attemptNumber: number;
};

export type JudgeBuildParams = {
	step: SuccessStepInput;
	benignResponse: string;
	benignStructured?: BenignStructuredOutput | null;
};

// Batched judge: one call per attempt verdicts every success step holistically. The judge
// can apply semantic matching across literal/regex rubrics (e.g., treat "7-days" as
// satisfying a "7 days" contains_text step), and cross-reference steps that share context.
export type BatchedJudgeBuildParams = {
	steps: SuccessStepInput[];
	benignResponse: string;
	benignStructured?: BenignStructuredOutput | null;
};

export type AttackerPromptVersion = {
	id: string;
	description: string;
	build: (params: AttackerBuildParams) => BuiltPrompt;
};

export type BenignPromptVersion = {
	id: string;
	description: string;
	build: (params: BenignBuildParams) => BuiltPrompt;
};

export type JudgePromptVersion = {
	id: string;
	description: string;
	build: (params: JudgeBuildParams) => BuiltPrompt;
};

export type BatchedJudgePromptVersion = {
	id: string;
	description: string;
	build: (params: BatchedJudgeBuildParams) => BuiltPrompt;
};
