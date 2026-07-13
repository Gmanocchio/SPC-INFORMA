ALTER TABLE `campaign_recipients` RENAME COLUMN `firstNameCiphertext` TO `customerNameCiphertext`;--> statement-breakpoint
ALTER TABLE `campaign_recipients` RENAME COLUMN `debtAmountCents` TO `amountCents`;--> statement-breakpoint
ALTER TABLE `campaign_recipients` RENAME COLUMN `debtDueDate` TO `dueDate`;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `creditorNameCiphertext` text;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `linkCiphertext` text;