ALTER TABLE `event_attendees` ADD `role` text;--> statement-breakpoint
ALTER TABLE `event_attendees` ADD `note` text;--> statement-breakpoint
ALTER TABLE `events` ADD `occurred_at_text` text;--> statement-breakpoint
ALTER TABLE `events` ADD `occurred_at_precision` text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `due_text` text;