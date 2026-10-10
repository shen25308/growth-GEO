CREATE TABLE `replies` (
	`id` text PRIMARY KEY NOT NULL,
	`discussion_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `replies_discussion` ON `replies` (`discussion_id`);