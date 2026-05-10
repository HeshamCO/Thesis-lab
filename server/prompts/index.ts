import { attackerV1 } from "./attacker/v1";
import { attackerV2 } from "./attacker/v2";
import { attackerV3 } from "./attacker/v3";
import { attackerV4 } from "./attacker/v4";
import { attackerV5 } from "./attacker/v5";
import { attackerV6 } from "./attacker/v6";
import { attackerV7 } from "./attacker/v7";
import { attackerV8 } from "./attacker/v8";
import { benignV1 } from "./benign/v1";
import { benignV2 } from "./benign/v2";
import { benignV3 } from "./benign/v3";
import { benignV4 } from "./benign/v4";
import { benignV5 } from "./benign/v5";
import { benignV6 } from "./benign/v6";
import { judgeV1 } from "./judge/v1";
import { judgeV2 } from "./judge/v2";
import { judgeV3 } from "./judge/v3";
import { judgeV4 } from "./judge/v4";
import { judgeV5 } from "./judge/v5";
import { judgeV6 } from "./judge/v6";
import { judgeV7 } from "./judge/v7";
import {
	DEFAULT_ATTACKER_PROMPT_VERSION,
	DEFAULT_BENIGN_PROMPT_VERSION,
	DEFAULT_JUDGE_PROMPT_VERSION,
} from "../../src/lib/thesis/schemas";
import type {
	AttackerPromptVersion,
	BatchedJudgePromptVersion,
	BenignPromptVersion,
	JudgePromptVersion,
} from "./types";

export const DEFAULT_ATTACKER_PROMPT_ID = DEFAULT_ATTACKER_PROMPT_VERSION;
export const DEFAULT_BENIGN_PROMPT_ID = DEFAULT_BENIGN_PROMPT_VERSION;
export const DEFAULT_JUDGE_PROMPT_ID = DEFAULT_JUDGE_PROMPT_VERSION;

const attackerPrompts: Record<string, AttackerPromptVersion> = {
	[attackerV1.id]: attackerV1,
	[attackerV2.id]: attackerV2,
	[attackerV3.id]: attackerV3,
	[attackerV4.id]: attackerV4,
	[attackerV5.id]: attackerV5,
	[attackerV6.id]: attackerV6,
	[attackerV7.id]: attackerV7,
	[attackerV8.id]: attackerV8,
};

const benignPrompts: Record<string, BenignPromptVersion> = {
	[benignV1.id]: benignV1,
	[benignV2.id]: benignV2,
	[benignV3.id]: benignV3,
	[benignV4.id]: benignV4,
	[benignV5.id]: benignV5,
	[benignV6.id]: benignV6,
};

const judgePrompts: Record<string, JudgePromptVersion> = {
	[judgeV1.id]: judgeV1,
	[judgeV2.id]: judgeV2,
	[judgeV3.id]: judgeV3,
	[judgeV4.id]: judgeV4,
};

const batchedJudgePrompts: Record<string, BatchedJudgePromptVersion> = {
	[judgeV5.id]: judgeV5,
	[judgeV6.id]: judgeV6,
	[judgeV7.id]: judgeV7,
};

export function getBatchedJudgePrompt(id: string): BatchedJudgePromptVersion | undefined {
	return batchedJudgePrompts[id];
}

export function getAttackerPrompt(id: string): AttackerPromptVersion {
	const prompt = attackerPrompts[id];
	if (!prompt) {
		throw new Error(
			`Unknown attacker prompt version "${id}". Known: ${Object.keys(attackerPrompts).join(", ")}.`,
		);
	}
	return prompt;
}

export function getBenignPrompt(id: string): BenignPromptVersion {
	const prompt = benignPrompts[id];
	if (!prompt) {
		throw new Error(
			`Unknown benign prompt version "${id}". Known: ${Object.keys(benignPrompts).join(", ")}.`,
		);
	}
	return prompt;
}

export function getJudgePrompt(id: string): JudgePromptVersion {
	const prompt = judgePrompts[id];
	if (!prompt) {
		throw new Error(
			`Unknown judge prompt version "${id}". Known: ${Object.keys(judgePrompts).join(", ")}.`,
		);
	}
	return prompt;
}

export function listRegisteredPrompts() {
	return {
		attacker: Object.values(attackerPrompts).map((p) => ({ id: p.id, description: p.description })),
		benign: Object.values(benignPrompts).map((p) => ({ id: p.id, description: p.description })),
		judge: Object.values(judgePrompts).map((p) => ({ id: p.id, description: p.description })),
	};
}

export { attackerPrompts, batchedJudgePrompts, benignPrompts, judgePrompts };

export type {
	AttackerBuildParams,
	AttackerPromptVersion,
	AttemptHistoryEntry,
	BatchedJudgeBuildParams,
	BatchedJudgePromptVersion,
	BenignBuildParams,
	BenignPromptVersion,
	BenignStructuredOutput,
	BuiltPrompt,
	JudgeBuildParams,
	JudgePromptVersion,
} from "./types";
