import type { RetrievedDocument } from "../db";
import type {
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
};

export type JudgeBuildParams = {
	step: SuccessStepInput;
	benignResponse: string;
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
