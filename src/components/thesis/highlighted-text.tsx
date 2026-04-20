import { Fragment, useMemo } from "react";
import { cn } from "#/lib/utils";
import type { StepResultRecord } from "#/lib/thesis/schemas";

type Range = { start: number; end: number; tone: "match" | "absent" };

type Props = {
	text: string;
	steps: readonly StepResultRecord[];
	className?: string;
	emptyText?: string;
};

const MAX_MATCHES = 50;
const MAX_REGEX_TEXT_LENGTH = 50_000;
const MAX_REGEX_PATTERN_LENGTH = 500;

export function HighlightedText({ text, steps, className, emptyText }: Props) {
	const ranges = useMemo(() => buildRanges(text, steps), [steps, text]);

	if (!text) {
		return <p className={cn("m-0 text-sm text-muted-foreground italic", className)}>{emptyText ?? "(no response)"}</p>;
	}

	if (ranges.length === 0) {
		return (
			<pre className={cn("m-0 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap break-words", className)}>
				{text}
			</pre>
		);
	}

	const segments = splitSegments(text, ranges);

	return (
		<pre className={cn("m-0 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap break-words", className)}>
			{segments.map((segment, index) => {
				const key = `${segment.start}-${segment.end}-${index}`;
				if (!segment.tone) {
					return <Fragment key={key}>{segment.text}</Fragment>;
				}
				const markClassName =
					segment.tone === "match"
						? "rounded bg-[color-mix(in_oklch,var(--success)_30%,transparent)] px-0.5 text-foreground"
						: "rounded bg-[color-mix(in_oklch,var(--destructive)_30%,transparent)] px-0.5 text-foreground";
				return (
					<mark key={key} className={markClassName}>
						{segment.text}
					</mark>
				);
			})}
		</pre>
	);
}

function buildRanges(text: string, steps: readonly StepResultRecord[]): Range[] {
	const ranges: Range[] = [];
	const lower = text.toLowerCase();

	for (const step of steps) {
		const config = step.stepSnapshot.evaluatorConfig as Record<string, unknown>;
		const target = typeof config.target === "string" ? config.target : "";

		if (step.stepSnapshot.evaluatorType === "contains_text" && target) {
			pushAllSubstring(ranges, lower, target.toLowerCase(), step.passed ? "match" : "absent");
		} else if (step.stepSnapshot.evaluatorType === "not_contains_text" && target) {
			pushAllSubstring(ranges, lower, target.toLowerCase(), step.passed ? "absent" : "match");
		} else if (step.stepSnapshot.evaluatorType === "regex") {
			const pattern = typeof config.pattern === "string" ? config.pattern : "";
			const flags = typeof config.flags === "string" ? config.flags : "i";
			pushAllRegex(ranges, text, pattern, flags);
		}
	}

	return mergeRanges(ranges);
}

function pushAllSubstring(ranges: Range[], lowerText: string, needle: string, tone: Range["tone"]) {
	if (!needle) {
		return;
	}
	let cursor = 0;
	let count = 0;
	while (count < MAX_MATCHES) {
		const index = lowerText.indexOf(needle, cursor);
		if (index === -1) {
			break;
		}
		ranges.push({ start: index, end: index + needle.length, tone });
		cursor = index + Math.max(1, needle.length);
		count += 1;
	}
}

function pushAllRegex(ranges: Range[], text: string, pattern: string, flagsInput: string) {
	if (!pattern || pattern.length > MAX_REGEX_PATTERN_LENGTH || text.length > MAX_REGEX_TEXT_LENGTH) {
		return;
	}
	const flags = ensureGlobalFlag(flagsInput);
	let regex: RegExp;
	try {
		regex = new RegExp(pattern, flags);
	} catch {
		return;
	}
	let count = 0;
	let match: RegExpExecArray | null = regex.exec(text);
	while (match && count < MAX_MATCHES) {
		const start = match.index;
		const end = start + match[0].length;
		if (end > start) {
			ranges.push({ start, end, tone: "match" });
		}
		if (regex.lastIndex === match.index) {
			regex.lastIndex += 1;
		}
		match = regex.exec(text);
		count += 1;
	}
}

function ensureGlobalFlag(flags: string) {
	if (!flags) {
		return "g";
	}
	return flags.includes("g") ? flags : `${flags}g`;
}

function mergeRanges(ranges: Range[]): Range[] {
	if (ranges.length === 0) {
		return ranges;
	}
	const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: Range[] = [];
	for (const range of sorted) {
		const last = merged.at(-1);
		if (last && range.start <= last.end && range.tone === last.tone) {
			last.end = Math.max(last.end, range.end);
		} else if (last && range.start < last.end) {
			// Overlap with different tone — clip to avoid double-marking; keep the earlier tone.
			if (range.end > last.end) {
				merged.push({ start: last.end, end: range.end, tone: range.tone });
			}
		} else {
			merged.push({ ...range });
		}
	}
	return merged;
}

function splitSegments(text: string, ranges: Range[]) {
	const segments: Array<{ text: string; start: number; end: number; tone?: Range["tone"] }> = [];
	let cursor = 0;
	for (const range of ranges) {
		if (range.start > cursor) {
			segments.push({ text: text.slice(cursor, range.start), start: cursor, end: range.start });
		}
		segments.push({
			text: text.slice(range.start, range.end),
			start: range.start,
			end: range.end,
			tone: range.tone,
		});
		cursor = range.end;
	}
	if (cursor < text.length) {
		segments.push({ text: text.slice(cursor), start: cursor, end: text.length });
	}
	return segments;
}
