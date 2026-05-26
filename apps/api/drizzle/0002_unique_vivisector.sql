CREATE TABLE `currency_rates` (
	`currency` text PRIMARY KEY NOT NULL,
	`usd_rate` real NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
