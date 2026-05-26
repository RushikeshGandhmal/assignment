CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`job_title` text NOT NULL,
	`department` text NOT NULL,
	`country` text NOT NULL,
	`salary` integer NOT NULL,
	`currency` text NOT NULL,
	`employment_type` text NOT NULL,
	`hire_date` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE INDEX `employees_country_idx` ON `employees` (`country`);--> statement-breakpoint
CREATE INDEX `employees_job_title_idx` ON `employees` (`job_title`);--> statement-breakpoint
CREATE INDEX `employees_status_idx` ON `employees` (`status`);--> statement-breakpoint
CREATE INDEX `employees_country_job_title_idx` ON `employees` (`country`,`job_title`);