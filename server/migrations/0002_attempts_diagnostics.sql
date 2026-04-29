-- Mode-collapse + cache-audit diagnostics on attempts.
-- All defaulted so existing rows remain valid; runtime addColumnIfMissing in db.ts mirrors this.

ALTER TABLE `attempts` ADD `injection_similarity` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `attempts` ADD `attacker_response_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `attempts` ADD `benign_response_id` text NOT NULL DEFAULT '';
