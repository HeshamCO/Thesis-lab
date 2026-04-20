CREATE TABLE `attacker_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `defense_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`defensive_prompt` text NOT NULL,
	`blocked_patterns` text NOT NULL,
	`retrieval_filter_enabled` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`model_name` text NOT NULL,
	`api_key_env_var` text NOT NULL,
	`temperature` integer NOT NULL,
	`max_tokens` integer NOT NULL,
	`role_tags` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario_success_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`required` integer NOT NULL,
	`evaluator_type` text NOT NULL,
	`evaluator_config` text NOT NULL,
	`feedback_guidance` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`benign_task` text NOT NULL,
	`attacker_goal` text NOT NULL,
	`retrieval_query` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
