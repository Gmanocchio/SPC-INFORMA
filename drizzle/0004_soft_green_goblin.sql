ALTER TABLE `organizations` ADD `linkedToOrganizationId` int;--> statement-breakpoint
CREATE INDEX `organizations_linked_idx` ON `organizations` (`linkedToOrganizationId`);