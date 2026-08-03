DROP INDEX IF EXISTS `action_proposals_idempotency_key_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `action_proposals_workspace_idempotency_uq`
  ON `action_proposals` (`workspace_id`, `idempotency_key`);--> statement-breakpoint

CREATE TABLE `__new_action_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`decision` text NOT NULL,
	`decided_by` text NOT NULL,
	`decided_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_action_approvals`
  (`id`, `workspace_id`, `proposal_id`, `decision`, `decided_by`, `decided_at`, `created_at`)
SELECT `id`, `workspace_id`, `proposal_id`, `normalised_decision`, `approver_id`,
       `normalised_decided_at`, `created_at`
FROM (
  SELECT `id`, `workspace_id`, `proposal_id`,
         COALESCE(`decision`, 'pending') AS `normalised_decision`,
         `approver_id`,
         COALESCE(`decided_at`, `created_at`, CURRENT_TIMESTAMP) AS `normalised_decided_at`,
         `created_at`,
         ROW_NUMBER() OVER (
           PARTITION BY `proposal_id`
           ORDER BY CASE WHEN `decision` IS NOT NULL THEN 0 ELSE 1 END,
                    `decided_at` DESC, `created_at` DESC, `id` DESC
         ) AS `proposal_row`
  FROM `action_approvals`
)
WHERE `proposal_row` = 1;--> statement-breakpoint
DROP TABLE `action_approvals`;--> statement-breakpoint
ALTER TABLE `__new_action_approvals` RENAME TO `action_approvals`;--> statement-breakpoint
CREATE UNIQUE INDEX `action_approvals_proposal_uq`
  ON `action_approvals` (`proposal_id`);--> statement-breakpoint

CREATE TABLE `__new_action_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_response_id` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_action_executions`
  (`id`, `workspace_id`, `proposal_id`, `status`, `provider_response_id`, `error`, `created_at`, `updated_at`)
SELECT `id`, `workspace_id`, `proposal_id`, `status`, `provider_response_id`, NULL,
       `created_at`, `updated_at`
FROM (
  SELECT `id`, `workspace_id`, `proposal_id`, `status`, `provider_response_id`,
         `created_at`, `updated_at`,
         ROW_NUMBER() OVER (
           PARTITION BY `proposal_id`
           ORDER BY CASE
                      WHEN `status` = 'succeeded' THEN 0
                      WHEN `provider_response_id` IS NOT NULL THEN 1
                      WHEN `status` = 'pending' THEN 2
                      ELSE 3
                    END,
                    `updated_at` DESC, `created_at` DESC, `id` DESC
         ) AS `proposal_row`
  FROM `action_executions`
)
WHERE `proposal_row` = 1;--> statement-breakpoint
DROP TABLE `action_executions`;--> statement-breakpoint
ALTER TABLE `__new_action_executions` RENAME TO `action_executions`;--> statement-breakpoint
CREATE UNIQUE INDEX `action_executions_proposal_uq`
  ON `action_executions` (`proposal_id`);
