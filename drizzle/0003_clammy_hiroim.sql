ALTER TABLE `campaigns` ADD `templateNameSnapshot` varchar(160);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `templateVersionSnapshot` int;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `templateSubjectSnapshot` varchar(255);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `templateContentSnapshot` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `templateVariablesSnapshot` json;