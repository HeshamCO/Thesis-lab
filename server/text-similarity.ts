// Cheap text-similarity helper for detecting attacker mode-collapse across attempts.
// Character-bigram Jaccard is fast (no deps), language-agnostic, and robust to small
// formatting changes — the failure mode we care about (qwen3-coder reproducing the same
// email template across 9 attempts) lights up at ~0.85+ even with minor word-level edits.
//
// We deliberately use character bigrams rather than token bigrams: the attacker may swap
// one or two words ("interested in"/"could you provide") while keeping the same template,
// and word-level shingling misses that. Char bigrams catch surface-form duplication.

export function bigramJaccard(a: string, b: string): number {
	if (!a || !b) return 0;
	const A = charBigrams(a);
	const B = charBigrams(b);
	if (A.size === 0 || B.size === 0) return 0;
	let intersection = 0;
	for (const bg of A) {
		if (B.has(bg)) intersection += 1;
	}
	const union = A.size + B.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

// Returns 0–100 (rounded). Convenience for storage in INTEGER columns.
export function injectionSimilarityScore(prev: string | null | undefined, current: string): number {
	if (!prev) return 0;
	return Math.round(bigramJaccard(prev.toLowerCase(), current.toLowerCase()) * 100);
}

function charBigrams(s: string): Set<string> {
	// Normalize whitespace so e.g. an extra newline doesn't artificially boost similarity.
	const normalized = s.replace(/\s+/g, " ").trim();
	const out = new Set<string>();
	for (let i = 0; i < normalized.length - 1; i += 1) {
		out.add(normalized.slice(i, i + 2));
	}
	return out;
}
