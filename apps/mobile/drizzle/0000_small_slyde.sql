CREATE TABLE `chapter_sources` (
	`title` text NOT NULL,
	`chapter` text NOT NULL,
	`source_id` text NOT NULL,
	`location` text NOT NULL,
	`pages` integer,
	`mtime_ms` integer NOT NULL,
	PRIMARY KEY(`title`, `chapter`, `source_id`)
);
--> statement-breakpoint
CREATE INDEX `chapter_sources_title_idx` ON `chapter_sources` (`title`);--> statement-breakpoint
CREATE TABLE `diag_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`level` text NOT NULL,
	`scope` text NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `downloads` (
	`title` text NOT NULL,
	`chapter` text NOT NULL,
	`dir` text NOT NULL,
	`pages` integer NOT NULL,
	`bytes` integer NOT NULL,
	`saved_at` integer NOT NULL,
	`quality` text NOT NULL,
	PRIMARY KEY(`title`, `chapter`)
);
--> statement-breakpoint
CREATE INDEX `downloads_saved_at_idx` ON `downloads` (`saved_at`);--> statement-breakpoint
CREATE TABLE `history` (
	`title` text NOT NULL,
	`chapter` text NOT NULL,
	`opened_at` integer NOT NULL,
	`pending` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`title`, `chapter`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`chapter` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`pages_done` integer DEFAULT 0 NOT NULL,
	`pages_total` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_state_next_attempt_idx` ON `jobs` (`state`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_kind_title_chapter_uq` ON `jobs` (`kind`,`title`,`chapter`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`root` text DEFAULT '' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`last_scan_at` integer,
	`scan_cursor` text,
	`ignored_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `titles` (
	`name` text PRIMARY KEY NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`categories_json` text DEFAULT '[]' NOT NULL,
	`thumb_version` text,
	`thumb_path` text,
	`server_mtime` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transient_pages` (
	`title` text NOT NULL,
	`chapter` text NOT NULL,
	`page` integer NOT NULL,
	`path` text NOT NULL,
	`bytes` integer NOT NULL,
	`last_access` integer NOT NULL,
	PRIMARY KEY(`title`, `chapter`, `page`)
);
--> statement-breakpoint
CREATE INDEX `transient_pages_last_access_idx` ON `transient_pages` (`last_access`);