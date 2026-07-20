ALTER TABLE `campaign_recipients` ADD `cpfCiphertext` text;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `firstNameCiphertext` text;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `debtAmountCents` bigint;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `debtDueDate` date;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `contractNumberCiphertext` text;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `creditorPhoneCiphertext` text;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `creditorEmailCiphertext` text;