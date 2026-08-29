CREATE TABLE `project_images` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
