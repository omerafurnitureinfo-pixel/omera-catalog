PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'مشروع جديد' NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`client_number` integer,
	`data` text NOT NULL,
	`status` text DEFAULT 'review' NOT NULL,
	`status_updated_at` text,
	`start_date` text,
	`due_date` text,
	`completion_percent` integer DEFAULT 0 NOT NULL,
	`completion_updated_at` text,
	`created_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "name", "client_name", "client_number", "data", "status", "status_updated_at", "start_date", "due_date", "completion_percent", "completion_updated_at", "created_by", "created_at", "updated_at") SELECT "id", "name", "client_name", "client_number", "data", "status", "status_updated_at", "start_date", "due_date", "completion_percent", "completion_updated_at", "created_by", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;