CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_issuer_subject_uq` ON `auth_identities` (`issuer`,`subject`);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_user_uq` ON `auth_identities` (`user_id`);
--> statement-breakpoint
CREATE INDEX `auth_identities_email_idx` ON `auth_identities` (`email`);
--> statement-breakpoint
ALTER TABLE `mcp_clients` ADD `auth_method` text;
--> statement-breakpoint
ALTER TABLE `mcp_clients` ADD `auth_issuer` text;
--> statement-breakpoint
ALTER TABLE `mcp_clients` ADD `external_client_id` text;
--> statement-breakpoint
ALTER TABLE `mcp_clients` ADD `user_id` text;
