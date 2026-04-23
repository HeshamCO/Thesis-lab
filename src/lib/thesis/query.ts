export const queryKeys = {
	dashboard: ["dashboard"] as const,
	scenarios: ["scenarios"] as const,
	scenario: (id: string) => ["scenarios", id] as const,
	models: ["models"] as const,
	defenses: ["defenses"] as const,
	runs: ["runs"] as const,
	run: (id: string) => ["runs", id] as const,
	bulkRuns: ["bulk-runs"] as const,
	bulkRun: (id: string) => ["bulk-runs", id] as const,
};
