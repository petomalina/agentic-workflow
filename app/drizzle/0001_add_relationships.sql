CREATE TABLE `person_relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_a_id` integer NOT NULL,
	`person_b_id` integer NOT NULL,
	`type` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`person_a_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_b_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
