import type { RetrievedDocument } from "../db";
import type {
	DefenseConfig,
	Scenario,
	SuccessStepInput,
} from "../../src/lib/thesis/schemas";

export type AttackEffect = "none" | "partial" | "full";

export type WhyItFailed =
	| "retrieval_miss"
	| "ignored_as_untrusted"
	| "partial_instruction_following"
	| "tool_policy_blocked"
	| "defense_filter_dropped"
	| "succeeded"
	| "other";

export type AttackTelemetry = {
	retrieved: boolean;
	citedMaliciousDoc: boolean;
	attackEffect: AttackEffect;
	utilityPreserved: boolean;
	toolCallAttempted: boolean;
	secretLeakageAttempted: boolean;
	whyItFailed: WhyItFailed;
};

export type AttemptHistoryEntry = {
	attemptNumber: number;
	strategy: string;
	injectedDocument: string;
	benignResponsePreview: string;
	failedRequiredSteps: string[];
	feedbackGuidance: string;
	retrieved?: boolean;
	citedMaliciousDoc?: boolean;
	attackEffect?: AttackEffect;
	utilityPreserved?: boolean;
	toolCallAttempted?: boolean;
	secretLeakageAttempted?: boolean;
	whyItFailed?: WhyItFailed;
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
};

export type BenignBuildParams = {
	scenario: Scenario;
	defense: DefenseConfig;
	retrievedContext: RetrievedDocument[];
	hasSafetyClause: boolean;
	labelRetrievedDocuments: boolean;
	toolsAvailable: boolean;
	structuredBenignOutput: boolean;
};

export type JudgeBuildParams = {
	step: SuccessStepInput;
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
