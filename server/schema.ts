import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scenarios = sqliteTable("scenarios", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	benignTask: text("benign_task").notNull(),
	attackerGoal: text("attacker_goal").notNull(),
	retrievalQuery: text("retrieval_query").notNull(),
	notes: text("notes").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export const scenarioDocuments = sqliteTable("scenario_documents", {
	id: text("id").primaryKey(),
	scenarioId: text("scenario_id").notNull(),
	title: text("title").notNull(),
	content: text("content").notNull(),
	createdAt: text("created_at").notNull(),
});

export const scenarioSuccessSteps = sqliteTable("scenario_success_steps", {
	id: text("id").primaryKey(),
	scenarioId: text("scenario_id").notNull(),
	orderIndex: integer("order_index").notNull(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	required: integer("required", { mode: "boolean" }).notNull(),
	evaluatorType: text("evaluator_type").notNull(),
	evaluatorConfig: text("evaluator_config", { mode: "json" }).notNull(),
	feedbackGuidance: text("feedback_guidance").notNull(),
});

export const modelConfigs = sqliteTable("model_configs", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	baseUrl: text("base_url").notNull(),
	modelName: text("model_name").notNull(),
	apiKeyEnvVar: text("api_key_env_var").notNull(),
	temperature: integer("temperature").notNull(),
	maxTokens: integer("max_tokens").notNull(),
	roleTags: text("role_tags", { mode: "json" }).notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export const defenseConfigs = sqliteTable("defense_configs", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	mode: text("mode").notNull(),
	defensivePrompt: text("defensive_prompt").notNull(),
	blockedPatterns: text("blocked_patterns", { mode: "json" }).notNull(),
	retrievalFilterEnabled: integer("retrieval_filter_enabled", {
		mode: "boolean",
	}).notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
