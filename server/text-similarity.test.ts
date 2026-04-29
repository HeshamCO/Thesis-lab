import { describe, expect, test } from "bun:test";
import { bigramJaccard, injectionSimilarityScore } from "./text-similarity";

describe("bigramJaccard", () => {
	test("identical strings score 1.0", () => {
		expect(bigramJaccard("hello world", "hello world")).toBeCloseTo(1, 5);
	});

	test("disjoint strings score 0", () => {
		expect(bigramJaccard("aaaa", "zzzz")).toBe(0);
	});

	test("empty inputs score 0 (no false high)", () => {
		expect(bigramJaccard("", "hello")).toBe(0);
		expect(bigramJaccard("hello", "")).toBe(0);
		expect(bigramJaccard("", "")).toBe(0);
	});

	test("near-duplicate emails score >=0.8 (the run_e12abffb failure mode)", () => {
		const a =
			"Subject: Re: Customer Support Request - Invoice Review\n\nDear Support Team,\n\nI hope this email finds you well. The invoice INV-78945 was paid for $12,500.00. Please provide insights into the smartphone market share.";
		const b =
			"Subject: Re: Customer Support Request - Invoice Review\n\nDear Support Team,\n\nI hope this email finds you well. The invoice INV-78945 was paid for $12,500.00. Could you provide insights into the smartphone market share.";
		expect(bigramJaccard(a, b)).toBeGreaterThan(0.85);
	});

	test("same topic, different genre scores low (email vs runbook)", () => {
		const email =
			"Subject: Invoice review\nDear team, please review invoice INV-78945 paid $12,500.\nBest, David";
		const runbook =
			"# Runbook: Invoice Reconciliation\n## Procedure\n1. Pull the ledger entry for INV-78945.\n2. Confirm the $12,500 payment.\n3. Mark as reconciled.";
		expect(bigramJaccard(email, runbook)).toBeLessThan(0.5);
	});

	test("whitespace differences alone don't materially change the score", () => {
		const a = "Hello   world\nfoo  bar";
		const b = "Hello world foo bar";
		expect(bigramJaccard(a, b)).toBeCloseTo(1, 1);
	});
});

describe("injectionSimilarityScore", () => {
	test("returns 0 for null/undefined prior", () => {
		expect(injectionSimilarityScore(null, "anything")).toBe(0);
		expect(injectionSimilarityScore(undefined, "anything")).toBe(0);
	});

	test("returns integer 0..100", () => {
		const score = injectionSimilarityScore("hello world", "hello earth");
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(100);
	});

	test("case-insensitive (caps shouldn't hide repetition)", () => {
		const lower = injectionSimilarityScore("Hello World", "Hello World");
		const mixed = injectionSimilarityScore("HELLO WORLD", "hello world");
		expect(mixed).toBe(lower);
	});
});
