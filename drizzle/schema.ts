import {
  bigint,
  boolean,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    parentOrganizationId: int("parentOrganizationId"),
    linkedToOrganizationId: int("linkedToOrganizationId"),
    type: mysqlEnum("type", ["SPC_BRASIL", "CDL", "DISTRIBUTOR", "CREDITOR"])
      .notNull(),
    legalName: varchar("legalName", { length: 180 }).notNull(),
    tradeName: varchar("tradeName", { length: 180 }).notNull(),
    cnpj: varchar("cnpj", { length: 14 }).notNull(),
    responsibleName: varchar("responsibleName", { length: 160 }).notNull(),
    responsibleEmail: varchar("responsibleEmail", { length: 320 }).notNull(),
    responsiblePhone: varchar("responsiblePhone", { length: 20 }),
    postalCode: varchar("postalCode", { length: 8 }),
    street: varchar("street", { length: 180 }),
    streetNumber: varchar("streetNumber", { length: 30 }),
    addressExtra: varchar("addressExtra", { length: 100 }),
    district: varchar("district", { length: 100 }),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 2 }),
    logoKey: varchar("logoKey", { length: 512 }),
    logoUrl: varchar("logoUrl", { length: 1024 }),
    billingModel: mysqlEnum("billingModel", ["PREPAID", "POSTPAID"])
      .default("PREPAID")
      .notNull(),
    balanceCents: bigint("balanceCents", { mode: "number" }).default(0).notNull(),
    creditLimitCents: bigint("creditLimitCents", { mode: "number" })
      .default(0)
      .notNull(),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE", "SUSPENDED"])
      .default("ACTIVE")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [
    uniqueIndex("organizations_cnpj_uq").on(table.cnpj),
    index("organizations_parent_idx").on(table.parentOrganizationId),
    index("organizations_linked_idx").on(table.linkedToOrganizationId),
    index("organizations_type_status_idx").on(table.type, table.status),
  ],
);

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id),
    openId: varchar("openId", { length: 64 }),
    name: varchar("name", { length: 160 }).notNull(),
    cpf: varchar("cpf", { length: 11 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    loginMethod: varchar("loginMethod", { length: 64 }).default("password").notNull(),
    role: mysqlEnum("role", ["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"])
      .default("REQUESTER")
      .notNull(),
    status: mysqlEnum("status", ["INVITED", "ACTIVE", "INACTIVE", "LOCKED"])
      .default("INVITED")
      .notNull(),
    mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
    failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
    lockedUntil: timestamp("lockedUntil"),
    passwordChangedAt: timestamp("passwordChangedAt"),
    createdByUserId: int("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn"),
    deletedAt: timestamp("deletedAt"),
  },
  table => [
    uniqueIndex("users_email_uq").on(table.email),
    uniqueIndex("users_cpf_uq").on(table.cpf),
    uniqueIndex("users_openid_uq").on(table.openId),
    index("users_org_role_status_idx").on(table.organizationId, table.role, table.status),
  ],
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    assuranceLevel: mysqlEnum("assuranceLevel", ["PASSWORD", "MFA", "PASSWORD_CHANGE"])
      .default("PASSWORD")
      .notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
    ipHash: varchar("ipHash", { length: 64 }),
    userAgentHash: varchar("userAgentHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("auth_sessions_token_hash_uq").on(table.tokenHash),
    index("auth_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
);

export const authChallenges = mysqlTable(
  "auth_challenges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    type: mysqlEnum("type", ["LOGIN_2FA", "PASSWORD_RESET"]).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    attempts: int("attempts").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(5).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    requestIpHash: varchar("requestIpHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("auth_challenges_token_hash_uq").on(table.tokenHash),
    index("auth_challenges_user_type_expiry_idx").on(
      table.userId,
      table.type,
      table.expiresAt,
    ),
  ],
);

export const messageTemplates = mysqlTable(
  "message_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    name: varchar("name", { length: 160 }).notNull(),
    channel: mysqlEnum("channel", ["SMS", "EMAIL", "WHATSAPP", "RCS"]).notNull(),
    subject: varchar("subject", { length: 255 }),
    content: text("content").notNull(),
    variables: json("variables").$type<string[]>().notNull(),
    status: mysqlEnum("status", ["DRAFT", "ACTIVE", "ARCHIVED"])
      .default("DRAFT")
      .notNull(),
    version: int("version").default(1).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("message_templates_org_channel_status_idx").on(
      table.organizationId,
      table.channel,
      table.status,
    ),
  ],
);

export const pricingRules = mysqlTable(
  "pricing_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    creditorOrganizationId: int("creditorOrganizationId").references(() => organizations.id),
    channel: mysqlEnum("channel", ["SMS", "EMAIL", "WHATSAPP", "RCS"]).notNull(),
    priceType: mysqlEnum("priceType", ["SPC_BASE", "CREDITOR_PRICE"]).notNull(),
    unitPriceMicros: bigint("unitPriceMicros", { mode: "number" }).notNull(),
    validFrom: timestamp("validFrom").notNull(),
    validUntil: timestamp("validUntil"),
    active: boolean("active").default(true).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("pricing_scope_channel_validity_idx").on(
      table.organizationId,
      table.creditorOrganizationId,
      table.channel,
      table.validFrom,
    ),
  ],
);

export const brokers = mysqlTable(
  "brokers",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    name: varchar("name", { length: 160 }).notNull(),
    channel: mysqlEnum("channel", ["SMS", "EMAIL", "WHATSAPP", "RCS"]).notNull(),
    baseUrl: varchar("baseUrl", { length: 1024 }).notNull(),
    encryptedCredentials: text("encryptedCredentials").notNull(),
    credentialsKeyVersion: int("credentialsKeyVersion").default(1).notNull(),
    extraConfig: json("extraConfig").$type<Record<string, unknown>>(),
    preferred: boolean("preferred").default(false).notNull(),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE", "ERROR"])
      .default("INACTIVE")
      .notNull(),
    lastHealthCheckAt: timestamp("lastHealthCheckAt"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("brokers_org_channel_status_idx").on(
      table.organizationId,
      table.channel,
      table.status,
    ),
  ],
);

export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    name: varchar("name", { length: 160 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    lastFour: varchar("lastFour", { length: 4 }).notNull(),
    secretHash: varchar("secretHash", { length: 64 }).notNull(),
    scopes: json("scopes").$type<string[]>().notNull(),
    expiresAt: timestamp("expiresAt"),
    lastUsedAt: timestamp("lastUsedAt"),
    revokedAt: timestamp("revokedAt"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("api_keys_secret_hash_uq").on(table.secretHash),
    index("api_keys_org_active_idx").on(table.organizationId, table.revokedAt),
  ],
);

export const uploads = mysqlTable(
  "uploads",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["UPLOADED", "VALIDATING", "VALID", "INVALID", "DELETED"])
      .default("UPLOADED")
      .notNull(),
    validationSummary: json("validationSummary").$type<Record<string, unknown>>(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => [index("uploads_org_status_idx").on(table.organizationId, table.status)],
);

export const campaigns = mysqlTable(
  "campaigns",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    creditorOrganizationId: int("creditorOrganizationId")
      .notNull()
      .references(() => organizations.id),
    templateId: int("templateId").notNull().references(() => messageTemplates.id),
    templateNameSnapshot: varchar("templateNameSnapshot", { length: 160 }),
    templateVersionSnapshot: int("templateVersionSnapshot"),
    templateSubjectSnapshot: varchar("templateSubjectSnapshot", { length: 255 }),
    templateContentSnapshot: text("templateContentSnapshot"),
    templateVariablesSnapshot: json("templateVariablesSnapshot").$type<string[]>(),
    brokerId: int("brokerId").references(() => brokers.id),
    uploadId: varchar("uploadId", { length: 64 }).references(() => uploads.id),
    name: varchar("name", { length: 180 }).notNull(),
    channel: mysqlEnum("channel", ["SMS", "EMAIL", "WHATSAPP", "RCS"]).notNull(),
    status: mysqlEnum("status", [
      "DRAFT",
      "UPLOADING",
      "VALIDATING",
      "READY",
      "SCHEDULED",
      "QUEUED",
      "PROCESSING",
      "COMPLETED",
      "PARTIAL",
      "FAILED",
      "CANCELED",
    ])
      .default("DRAFT")
      .notNull(),
    billingModelSnapshot: mysqlEnum("billingModelSnapshot", ["PREPAID", "POSTPAID"])
      .notNull(),
    unitPriceMicros: bigint("unitPriceMicros", { mode: "number" }).default(0).notNull(),
    recipientCount: int("recipientCount").default(0).notNull(),
    validRecipientCount: int("validRecipientCount").default(0).notNull(),
    invalidRecipientCount: int("invalidRecipientCount").default(0).notNull(),
    totalCostMicros: bigint("totalCostMicros", { mode: "number" }).default(0).notNull(),
    deliveredCount: int("deliveredCount").default(0).notNull(),
    failedCount: int("failedCount").default(0).notNull(),
    scheduledFor: timestamp("scheduledFor"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    confirmedAt: timestamp("confirmedAt"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    idempotencyKey: varchar("idempotencyKey", { length: 64 }).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("campaigns_idempotency_uq").on(table.idempotencyKey),
    uniqueIndex("campaigns_schedule_task_uq").on(table.scheduleCronTaskUid),
    index("campaigns_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("campaigns_creditor_channel_idx").on(
      table.creditorOrganizationId,
      table.channel,
    ),
  ],
);

export const campaignRecipients = mysqlTable(
  "campaign_recipients",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    campaignId: varchar("campaignId", { length: 36 }).notNull().references(() => campaigns.id),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    destinationCiphertext: text("destinationCiphertext").notNull(),
    destinationFingerprint: varchar("destinationFingerprint", { length: 64 }).notNull(),
    variablesCiphertext: text("variablesCiphertext"),
    cpfCiphertext: text("cpfCiphertext"),
    firstNameCiphertext: text("firstNameCiphertext"),
    debtAmountCents: bigint("debtAmountCents", { mode: "number" }),
    debtDueDate: date("debtDueDate", { mode: "string" }),
    contractNumberCiphertext: text("contractNumberCiphertext"),
    creditorPhoneCiphertext: text("creditorPhoneCiphertext"),
    creditorEmailCiphertext: text("creditorEmailCiphertext"),
    status: mysqlEnum("status", [
      "PENDING",
      "QUEUED",
      "SENT",
      "DELIVERED",
      "FAILED",
      "INVALID",
      "OPTED_OUT",
    ])
      .default("PENDING")
      .notNull(),
    brokerMessageId: varchar("brokerMessageId", { length: 255 }),
    errorCode: varchar("errorCode", { length: 100 }),
    sentAt: timestamp("sentAt"),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("campaign_recipients_dedup_uq").on(
      table.campaignId,
      table.destinationFingerprint,
    ),
    index("campaign_recipients_org_status_idx").on(table.organizationId, table.status),
    index("campaign_recipients_broker_message_idx").on(table.brokerMessageId),
  ],
);

export const deliveryEvents = mysqlTable(
  "delivery_events",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    campaignId: varchar("campaignId", { length: 36 }).notNull().references(() => campaigns.id),
    recipientId: bigint("recipientId", { mode: "number" })
      .notNull()
      .references(() => campaignRecipients.id),
    brokerId: int("brokerId").references(() => brokers.id),
    externalEventId: varchar("externalEventId", { length: 255 }).notNull(),
    eventType: mysqlEnum("eventType", [
      "ACCEPTED",
      "SENT",
      "DELIVERED",
      "BOUNCED",
      "FAILED",
      "READ",
      "CLICKED",
      "OPTED_OUT",
    ]).notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    payloadDigest: varchar("payloadDigest", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("delivery_events_external_uq").on(table.brokerId, table.externalEventId),
    index("delivery_events_org_campaign_type_idx").on(
      table.organizationId,
      table.campaignId,
      table.eventType,
    ),
  ],
);

export const webhookReceipts = mysqlTable(
  "webhook_receipts",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    brokerId: int("brokerId").notNull().references(() => brokers.id),
    externalEventId: varchar("externalEventId", { length: 255 }).notNull(),
    requestDigest: varchar("requestDigest", { length: 64 }).notNull(),
    signatureValid: boolean("signatureValid").default(false).notNull(),
    status: mysqlEnum("status", ["RECEIVED", "PROCESSED", "REJECTED", "ERROR"])
      .default("RECEIVED")
      .notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
  },
  table => [
    uniqueIndex("webhook_receipts_event_uq").on(table.brokerId, table.externalEventId),
  ],
);

export const financialLedger = mysqlTable(
  "financial_ledger",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    campaignId: varchar("campaignId", { length: 36 }).references(() => campaigns.id),
    type: mysqlEnum("type", ["CREDIT", "RESERVE", "DEBIT", "RELEASE", "ADJUSTMENT"])
      .notNull(),
    amountMicros: bigint("amountMicros", { mode: "number" }).notNull(),
    balanceAfterMicros: bigint("balanceAfterMicros", { mode: "number" }).notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("financial_ledger_idempotency_uq").on(table.idempotencyKey),
    index("financial_ledger_org_created_idx").on(table.organizationId, table.createdAt),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    organizationId: int("organizationId").references(() => organizations.id),
    actorUserId: int("actorUserId").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resourceType", { length: 80 }).notNull(),
    resourceId: varchar("resourceId", { length: 80 }),
    outcome: mysqlEnum("outcome", ["SUCCESS", "DENIED", "FAILURE"]).notNull(),
    correlationId: varchar("correlationId", { length: 64 }).notNull(),
    ipHash: varchar("ipHash", { length: 64 }),
    userAgentHash: varchar("userAgentHash", { length: 64 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type PricingRule = typeof pricingRules.$inferSelect;
export type Broker = typeof brokers.$inferSelect;
export type ApiKeyRecord = typeof apiKeys.$inferSelect;
