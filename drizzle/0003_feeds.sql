CREATE TABLE `feed_items` (
	`id` text PRIMARY KEY NOT NULL,
	`feed_id` text NOT NULL,
	`guid` text NOT NULL,
	`url` text,
	`title` text NOT NULL,
	`summary` text,
	`content` text,
	`author` text,
	`image_url` text,
	`published_at` integer,
	`read_at` integer,
	`bookmark_id` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `feed_items_feed_idx` ON `feed_items` (`feed_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `feed_items_published_idx` ON `feed_items` (`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `feed_items_guid_idx` ON `feed_items` (`feed_id`,`guid`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`site_url` text,
	`description` text,
	`icon_url` text,
	`etag` text,
	`last_modified` text,
	`last_fetched_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_url_unique` ON `feeds` (`url`);