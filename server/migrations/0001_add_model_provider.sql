-- Adds optional `provider` column to model_configs and backfills legacy rows.
-- Mirrors the runtime migration in server/db.ts (addColumnIfMissing + backfillModelProviders).

ALTER TABLE `model_configs` ADD `provider` text;
--> statement-breakpoint
UPDATE `model_configs` SET `provider` = 'cliproxy'
	WHERE `provider` IS NULL AND `base_url` LIKE 'http://localhost:8317%';
--> statement-breakpoint
UPDATE `model_configs` SET `provider` = 'openrouter'
	WHERE `provider` IS NULL AND `base_url` LIKE 'https://openrouter.ai/%';
--> statement-breakpoint
UPDATE `model_configs` SET `provider` = 'ollama'
	WHERE `provider` IS NULL AND (
		`base_url` LIKE 'https://model.ssa.sa/%'
		OR `base_url` LIKE 'http://localhost:11434%'
	);
--> statement-breakpoint
UPDATE `model_configs` SET `provider` = 'openai-compat' WHERE `provider` IS NULL;
