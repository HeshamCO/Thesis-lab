import { Fragment, useMemo } from "react";
import { cn } from "#/lib/utils";
import type { StepResultRecord } from "#/lib/thesis/schemas";

type Tone = "match" | "absent";
type Range = { start: number; end: number; tone: Tone };

type TokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation";
type Token = { start: number; end: number; type: TokenType };

type Segment = { text: string; tone?: Tone; token?: TokenType };

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
	const { displayText, isJson } = useMemo(() => formatDisplay(text), [text]);
	const ranges = useMemo(() => buildRanges(displayText, steps), [displayText, steps]);
	const tokens = useMemo(() => (isJson ? tokenizeJson(displayText) : []), [displayText, isJson]);
	const lines = useMemo(
		() => segmentsToLines(buildSegments(displayText, ranges, tokens)),
		[displayText, ranges, tokens],
	);
	const matchCount = ranges.filter((r) => r.tone === "match").length;
	const absentCount = ranges.filter((r) => r.tone === "absent").length;

	if (!text) {
		return (
			<p className={cn("m-0 text-sm text-muted-foreground italic", className)}>
				{emptyText ?? "(no response)"}
			</p>
		);
	}

	const gutterWidth = String(lines.length).length;

	return (
		<div
			className={cn(
				"group/ht relative rounded-md border border-border/50 bg-muted/30 font-mono text-xs leading-5",
				className,
			)}
		>
			<div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-muted/60 px-3 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
				<div className="flex items-center gap-2">
					<span className={cn("rounded px-1.5 py-0.5", isJson ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-muted text-muted-foreground")}>
						{isJson ? "JSON" : "TEXT"}
					</span>
					<span>{lines.length} line{lines.length === 1 ? "" : "s"}</span>
					<span>·</span>
					<span>{displayText.length.toLocaleString()} chars</span>
				</div>
				<div className="flex items-center gap-2">
					{matchCount > 0 ? (
						<span className="flex items-center gap-1">
							<span className="inline-block h-2 w-2 rounded-sm bg-[color-mix(in_oklch,var(--success)_60%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--success)_70%,transparent)]" />
							{matchCount} match{matchCount === 1 ? "" : "es"}
						</span>
					) : null}
					{absentCount > 0 ? (
						<span className="flex items-center gap-1">
							<span className="inline-block h-2 w-2 rounded-sm bg-[color-mix(in_oklch,var(--destructive)_60%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--destructive)_70%,transparent)]" />
							{absentCount} miss{absentCount === 1 ? "" : "es"}
						</span>
					) : null}
				</div>
			</div>
			<div className="overflow-auto">
				<div className="min-w-full" role="presentation">
					{lines.map((line, i) => (
						<div
							key={i}
							className="flex items-start hover:bg-muted/50 focus-within:bg-muted/50"
						>
							<div
								className="sticky left-0 z-[1] shrink-0 border-r border-border/40 bg-muted/40 px-2 py-0 text-right text-muted-foreground/60 select-none tabular-nums"
								style={{ minWidth: `${gutterWidth + 2}ch` }}
							>
								{i + 1}
							</div>
							<pre
								className="m-0 min-h-5 flex-1 bg-transparent px-3 py-0 whitespace-pre-wrap wrap-anywhere"
							>
								{line.length === 0 ? (
									<span>{" "}</span>
								) : (
									line.map((seg, j) => <SegmentSpan key={j} seg={seg} />)
								)}
							</pre>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function SegmentSpan({ seg }: { seg: Segment }) {
	const tokenClass = seg.token ? tokenClassName(seg.token) : "";
	if (!seg.tone) {
		if (!seg.token) {
			return <Fragment>{seg.text}</Fragment>;
		}
		return <span className={tokenClass}>{seg.text}</span>;
	}
	const toneClass =
		seg.tone === "match"
			? "rounded-sm bg-[color-mix(in_oklch,var(--success)_28%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--success)_55%,transparent)]"
			: "rounded-sm bg-[color-mix(in_oklch,var(--destructive)_28%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--destructive)_55%,transparent)]";
	return <mark className={cn(toneClass, tokenClass, "px-0.5 text-foreground")}>{seg.text}</mark>;
}

function tokenClassName(type: TokenType): string {
	switch (type) {
		case "key":
			return "text-sky-700 dark:text-sky-300 font-medium";
		case "string":
			return "text-emerald-700 dark:text-emerald-300";
		case "number":
			return "text-amber-700 dark:text-amber-300";
		case "boolean":
			return "text-purple-700 dark:text-purple-300";
		case "null":
			return "text-muted-foreground italic";
		case "punctuation":
			return "text-foreground/50";
	}
}

function formatDisplay(text: string): { displayText: string; isJson: boolean } {
	const trimmed = text.trim();
	if (!trimmed) {
		return { displayText: text, isJson: false };
	}
	const first = trimmed[0];
	const last = trimmed[trimmed.length - 1];
	const looksJson = (first === "{" && last === "}") || (first === "[" && last === "]");
	if (!looksJson) {
		return { displayText: text, isJson: false };
	}
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		return { displayText: JSON.stringify(parsed, null, 2), isJson: true };
	} catch {
		return { displayText: text, isJson: false };
	}
}

function tokenizeJson(text: string): Token[] {
	const tokens: Token[] = [];
	const stringRanges: Array<{ start: number; end: number }> = [];

	const strRe = /"(?:\\.|[^"\\])*"/g;
	let m: RegExpExecArray | null = strRe.exec(text);
	while (m) {
		const start = m.index;
		const end = start + m[0].length;
		stringRanges.push({ start, end });
		let i = end;
		while (i < text.length && (text[i] === " " || text[i] === "\t")) {
			i += 1;
		}
		const type: TokenType = text[i] === ":" ? "key" : "string";
		tokens.push({ start, end, type });
		m = strRe.exec(text);
	}

	const insideString = (pos: number) =>
		stringRanges.some((r) => pos >= r.start && pos < r.end);

	const numRe = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
	m = numRe.exec(text);
	while (m) {
		if (!insideString(m.index)) {
			tokens.push({ start: m.index, end: m.index + m[0].length, type: "number" });
		}
		m = numRe.exec(text);
	}

	const boolRe = /\b(?:true|false|null)\b/g;
	m = boolRe.exec(text);
	while (m) {
		if (!insideString(m.index)) {
			tokens.push({
				start: m.index,
				end: m.index + m[0].length,
				type: m[0] === "null" ? "null" : "boolean",
			});
		}
		m = boolRe.exec(text);
	}

	const punctRe = /[{}[\],:]/g;
	m = punctRe.exec(text);
	while (m) {
		if (!insideString(m.index)) {
			tokens.push({ start: m.index, end: m.index + 1, type: "punctuation" });
		}
		m = punctRe.exec(text);
	}

	return tokens.sort((a, b) => a.start - b.start);
}

function buildSegments(text: string, ranges: Range[], tokens: Token[]): Segment[] {
	if (!text) {
		return [];
	}
	const boundaries = new Set<number>([0, text.length]);
	for (const r of ranges) {
		boundaries.add(r.start);
		boundaries.add(r.end);
	}
	for (const t of tokens) {
		boundaries.add(t.start);
		boundaries.add(t.end);
	}
	const sorted = [...boundaries].filter((b) => b >= 0 && b <= text.length).sort((a, b) => a - b);
	const segments: Segment[] = [];
	for (let i = 0; i < sorted.length - 1; i += 1) {
		const s = sorted[i];
		const e = sorted[i + 1];
		if (s === e) continue;
		const tone = ranges.find((r) => r.start <= s && r.end > s)?.tone;
		const token = tokens.find((t) => t.start <= s && t.end > s)?.type;
		segments.push({ text: text.slice(s, e), tone, token });
	}
	return segments;
}

function segmentsToLines(segments: Segment[]): Segment[][] {
	const lines: Segment[][] = [[]];
	for (const seg of segments) {
		const parts = seg.text.split("\n");
		for (let i = 0; i < parts.length; i += 1) {
			if (i > 0) {
				lines.push([]);
			}
			if (parts[i].length > 0) {
				lines[lines.length - 1].push({ ...seg, text: parts[i] });
			}
		}
	}
	return lines;
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

function pushAllSubstring(ranges: Range[], lowerText: string, needle: string, tone: Tone) {
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
			if (range.end > last.end) {
				merged.push({ start: last.end, end: range.end, tone: range.tone });
			}
		} else {
			merged.push({ ...range });
		}
	}
	return merged;
}
