CREATE TABLE `practices` (
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`author_name` text NOT NULL,
	`resource_version` integer NOT NULL,
	`data` text NOT NULL,
	`stage` text DEFAULT 'running' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `resource_id`)
);
--> statement-breakpoint
CREATE INDEX `practices_resource_visibility` ON `practices` (`resource_id`,`visibility`);