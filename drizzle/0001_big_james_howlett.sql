CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`lastFour` varchar(4) NOT NULL,
	`secretHash` varchar(64) NOT NULL,
	`scopes` json NOT NULL,
	`expiresAt` timestamp,
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_secret_hash_uq` UNIQUE(`secretHash`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`resourceType` varchar(80) NOT NULL,
	`resourceId` varchar(80),
	`outcome` enum('SUCCESS','DENIED','FAILURE') NOT NULL,
	`correlationId` varchar(64) NOT NULL,
	`ipHash` varchar(64),
	`userAgentHash` varchar(64),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_challenges` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`type` enum('LOGIN_2FA','PASSWORD_RESET') NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 5,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`requestIpHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_challenges_token_hash_uq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`assuranceLevel` enum('PASSWORD','MFA','PASSWORD_CHANGE') NOT NULL DEFAULT 'PASSWORD',
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`ipHash` varchar(64),
	`userAgentHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_hash_uq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `brokers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`channel` enum('SMS','EMAIL','WHATSAPP','RCS') NOT NULL,
	`baseUrl` varchar(1024) NOT NULL,
	`encryptedCredentials` text NOT NULL,
	`credentialsKeyVersion` int NOT NULL DEFAULT 1,
	`extraConfig` json,
	`preferred` boolean NOT NULL DEFAULT false,
	`status` enum('ACTIVE','INACTIVE','ERROR') NOT NULL DEFAULT 'INACTIVE',
	`lastHealthCheckAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brokers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_recipients` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`campaignId` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`destinationCiphertext` text NOT NULL,
	`destinationFingerprint` varchar(64) NOT NULL,
	`variablesCiphertext` text,
	`status` enum('PENDING','QUEUED','SENT','DELIVERED','FAILED','INVALID','OPTED_OUT') NOT NULL DEFAULT 'PENDING',
	`brokerMessageId` varchar(255),
	`errorCode` varchar(100),
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaign_recipients_dedup_uq` UNIQUE(`campaignId`,`destinationFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` varchar(36) NOT NULL,
	`organizationId` int NOT NULL,
	`creditorOrganizationId` int NOT NULL,
	`templateId` int NOT NULL,
	`brokerId` int,
	`uploadId` varchar(64),
	`name` varchar(180) NOT NULL,
	`channel` enum('SMS','EMAIL','WHATSAPP','RCS') NOT NULL,
	`status` enum('DRAFT','UPLOADING','VALIDATING','READY','SCHEDULED','QUEUED','PROCESSING','COMPLETED','PARTIAL','FAILED','CANCELED') NOT NULL DEFAULT 'DRAFT',
	`billingModelSnapshot` enum('PREPAID','POSTPAID') NOT NULL,
	`unitPriceMicros` bigint NOT NULL DEFAULT 0,
	`recipientCount` int NOT NULL DEFAULT 0,
	`validRecipientCount` int NOT NULL DEFAULT 0,
	`invalidRecipientCount` int NOT NULL DEFAULT 0,
	`totalCostMicros` bigint NOT NULL DEFAULT 0,
	`deliveredCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`scheduledFor` timestamp,
	`scheduleCronTaskUid` varchar(65),
	`confirmedAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`idempotencyKey` varchar(64) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaigns_idempotency_uq` UNIQUE(`idempotencyKey`),
	CONSTRAINT `campaigns_schedule_task_uq` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `delivery_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`campaignId` varchar(36) NOT NULL,
	`recipientId` bigint NOT NULL,
	`brokerId` int,
	`externalEventId` varchar(255) NOT NULL,
	`eventType` enum('ACCEPTED','SENT','DELIVERED','BOUNCED','FAILED','READ','CLICKED','OPTED_OUT') NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`payloadDigest` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_events_external_uq` UNIQUE(`brokerId`,`externalEventId`)
);
--> statement-breakpoint
CREATE TABLE `financial_ledger` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`campaignId` varchar(36),
	`type` enum('CREDIT','RESERVE','DEBIT','RELEASE','ADJUSTMENT') NOT NULL,
	`amountMicros` bigint NOT NULL,
	`balanceAfterMicros` bigint NOT NULL,
	`description` varchar(255) NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_ledger_idempotency_uq` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`channel` enum('SMS','EMAIL','WHATSAPP','RCS') NOT NULL,
	`subject` varchar(255),
	`content` text NOT NULL,
	`variables` json NOT NULL,
	`status` enum('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`version` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentOrganizationId` int,
	`type` enum('SPC_BRASIL','CDL','DISTRIBUTOR','CREDITOR') NOT NULL,
	`legalName` varchar(180) NOT NULL,
	`tradeName` varchar(180) NOT NULL,
	`cnpj` varchar(14) NOT NULL,
	`responsibleName` varchar(160) NOT NULL,
	`responsibleEmail` varchar(320) NOT NULL,
	`responsiblePhone` varchar(20),
	`postalCode` varchar(8),
	`street` varchar(180),
	`streetNumber` varchar(30),
	`addressExtra` varchar(100),
	`district` varchar(100),
	`city` varchar(120),
	`state` varchar(2),
	`logoKey` varchar(512),
	`logoUrl` varchar(1024),
	`billingModel` enum('PREPAID','POSTPAID') NOT NULL DEFAULT 'PREPAID',
	`balanceCents` bigint NOT NULL DEFAULT 0,
	`creditLimitCents` bigint NOT NULL DEFAULT 0,
	`status` enum('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_cnpj_uq` UNIQUE(`cnpj`)
);
--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`creditorOrganizationId` int,
	`channel` enum('SMS','EMAIL','WHATSAPP','RCS') NOT NULL,
	`priceType` enum('SPC_BASE','CREDITOR_PRICE') NOT NULL,
	`unitPriceMicros` bigint NOT NULL,
	`validFrom` timestamp NOT NULL,
	`validUntil` timestamp,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` varchar(64) NOT NULL,
	`organizationId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` bigint NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`status` enum('UPLOADED','VALIDATING','VALID','INVALID','DELETED') NOT NULL DEFAULT 'UPLOADED',
	`validationSummary` json,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deletedAt` timestamp,
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_receipts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`brokerId` int NOT NULL,
	`externalEventId` varchar(255) NOT NULL,
	`requestDigest` varchar(64) NOT NULL,
	`signatureValid` boolean NOT NULL DEFAULT false,
	`status` enum('RECEIVED','PROCESSED','REJECTED','ERROR') NOT NULL DEFAULT 'RECEIVED',
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `webhook_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_receipts_event_uq` UNIQUE(`brokerId`,`externalEventId`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(160) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` varchar(64) NOT NULL DEFAULT 'password';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('SPC_ADMIN','ORG_ADMIN','REQUESTER') NOT NULL DEFAULT 'REQUESTER';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `cpf` varchar(11) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('INVITED','ACTIVE','INACTIVE','LOCKED') DEFAULT 'INVITED' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordChangedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `createdByUserId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_uq` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_cpf_uq` UNIQUE(`cpf`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openid_uq` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_challenges` ADD CONSTRAINT `auth_challenges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brokers` ADD CONSTRAINT `brokers_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brokers` ADD CONSTRAINT `brokers_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD CONSTRAINT `campaign_recipients_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD CONSTRAINT `campaign_recipients_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_creditorOrganizationId_organizations_id_fk` FOREIGN KEY (`creditorOrganizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_templateId_message_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `message_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_brokerId_brokers_id_fk` FOREIGN KEY (`brokerId`) REFERENCES `brokers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_uploadId_uploads_id_fk` FOREIGN KEY (`uploadId`) REFERENCES `uploads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_events` ADD CONSTRAINT `delivery_events_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_events` ADD CONSTRAINT `delivery_events_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_events` ADD CONSTRAINT `delivery_events_recipientId_campaign_recipients_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `campaign_recipients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_events` ADD CONSTRAINT `delivery_events_brokerId_brokers_id_fk` FOREIGN KEY (`brokerId`) REFERENCES `brokers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_ledger` ADD CONSTRAINT `financial_ledger_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_ledger` ADD CONSTRAINT `financial_ledger_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_ledger` ADD CONSTRAINT `financial_ledger_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_creditorOrganizationId_organizations_id_fk` FOREIGN KEY (`creditorOrganizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricing_rules` ADD CONSTRAINT `pricing_rules_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_receipts` ADD CONSTRAINT `webhook_receipts_brokerId_brokers_id_fk` FOREIGN KEY (`brokerId`) REFERENCES `brokers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `api_keys_org_active_idx` ON `api_keys` (`organizationId`,`revokedAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_org_created_idx` ON `audit_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_created_idx` ON `audit_logs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resourceType`,`resourceId`);--> statement-breakpoint
CREATE INDEX `auth_challenges_user_type_expiry_idx` ON `auth_challenges` (`userId`,`type`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_expiry_idx` ON `auth_sessions` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `brokers_org_channel_status_idx` ON `brokers` (`organizationId`,`channel`,`status`);--> statement-breakpoint
CREATE INDEX `campaign_recipients_org_status_idx` ON `campaign_recipients` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `campaign_recipients_broker_message_idx` ON `campaign_recipients` (`brokerMessageId`);--> statement-breakpoint
CREATE INDEX `campaigns_org_status_created_idx` ON `campaigns` (`organizationId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `campaigns_creditor_channel_idx` ON `campaigns` (`creditorOrganizationId`,`channel`);--> statement-breakpoint
CREATE INDEX `delivery_events_org_campaign_type_idx` ON `delivery_events` (`organizationId`,`campaignId`,`eventType`);--> statement-breakpoint
CREATE INDEX `financial_ledger_org_created_idx` ON `financial_ledger` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `message_templates_org_channel_status_idx` ON `message_templates` (`organizationId`,`channel`,`status`);--> statement-breakpoint
CREATE INDEX `organizations_parent_idx` ON `organizations` (`parentOrganizationId`);--> statement-breakpoint
CREATE INDEX `organizations_type_status_idx` ON `organizations` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `pricing_scope_channel_validity_idx` ON `pricing_rules` (`organizationId`,`creditorOrganizationId`,`channel`,`validFrom`);--> statement-breakpoint
CREATE INDEX `uploads_org_status_idx` ON `uploads` (`organizationId`,`status`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_org_role_status_idx` ON `users` (`organizationId`,`role`,`status`);