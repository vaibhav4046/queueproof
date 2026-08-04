CREATE TABLE `query_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`query_run_id` text NOT NULL,
	`schema_version` text DEFAULT 'live-proof-v1' NOT NULL,
	`receipt_json` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `query_receipts_query_run_uq` ON `query_receipts` (`query_run_id`);--> statement-breakpoint
CREATE INDEX `query_receipts_workspace_created_idx` ON `query_receipts` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `query_steps_run_sequence_uq` ON `query_steps` (`query_run_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `query_steps_workspace_run_idx` ON `query_steps` (`workspace_id`,`query_run_id`);