import { attackerV1 } from "./attacker/v1";
import { attackerV2 } from "./attacker/v2";
import { benignV1 } from "./benign/v1";
import { benignV2 } from "./benign/v2";
import { judgeV1 } from "./judge/v1";
import { judgeV2 } from "./judge/v2";
import {
	DEFAULT_ATTACKER_PROMPT_VERSION,
	DEFAULT_BENIGN_PROMPT_VERSION,
	DEFAULT_JUDGE_PROMPT_VERSION,
} from "../../src/lib/thesis/schemas";
import type {
	AttackerPromptVersion,
	BenignPromptVersion,
	JudgePromptVersion,
} from "./types";

export const DEFAULT_ATTACKER_PROMPT_ID = DEFAULT_ATTACKER_PROMPT_VERSION;
export const DEFAULT_BENIGN_PROMPT_ID = DEFAULT_BENIGN_PROMPT_VERSION;
export const DEFAULT_JUDGE_PROMPT_ID = DEFAULT_JUDGE_PROMPT_VERSION;

const attackerPrompts: Record<string, AttackerPromptVersion> = {
	[attackerV1.id]: attackerV1,
	[attackerV2.id]: attackerV2,
};

const benignPrompts: Record<string, BenignPromptVersion> = {
	[benignV1.id]: benignV1,
	[benignV2.id]: benignV2,
};

const judgePrompts: Record<string, JudgePromptVersion> = {
	[judgeV1.id]: judgeV1,
	[judgeV2.id]: judgeV2,
};

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

export type {
	AttackerBuildParams,
	AttackerPromptVersion,
	AttemptHistoryEntry,
	BenignBuildParams,
	BenignPromptVersion,
	BuiltPrompt,
	JudgeBuildParams,
	JudgePromptVersion,
} from "./types";
