CREATE TABLE `discussions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discussions_resource` ON `discussions` (`resource_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text NOT NULL,
	`base_version` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proposals_resource` ON `proposals` (`resource_id`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`forked_from` text
);
--> statement-breakpoint
CREATE INDEX `resources_owner` ON `resources` (`owner_id`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`author_name` text NOT NULL,
	`data` text NOT NULL,
	`version` integer NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revisions_resource_version` ON `revisions` (`resource_id`,`version`);--> statement-breakpoint
CREATE TABLE `stars` (
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `resource_id`)
);
--> statement-breakpoint
CREATE INDEX `stars_resource` ON `stars` (`resource_id`);