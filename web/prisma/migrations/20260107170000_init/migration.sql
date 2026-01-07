-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "counterparty" TEXT,
    "description" TEXT,
    "category" TEXT,
    "variable_symbol" TEXT,
    "is_internal_transfer" BOOLEAN NOT NULL DEFAULT false,
    "internal_transfer_pair_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'ENABLE_BANKING',
    "status" TEXT NOT NULL DEFAULT 'created',
    "session_id" TEXT NOT NULL,
    "institution_id" TEXT,
    "institution_name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AccountLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_account_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountLink_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountLink_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "BankConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Account_bank_name_idx" ON "Account"("bank_name");

-- CreateIndex
CREATE INDEX "Account_owner_name_idx" ON "Account"("owner_name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_bank_name_account_number_owner_name_key" ON "Account"("bank_name", "account_number", "owner_name");

-- CreateIndex
CREATE INDEX "Transaction_account_id_date_idx" ON "Transaction"("account_id", "date");

-- CreateIndex
CREATE INDEX "Transaction_currency_idx" ON "Transaction"("currency");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");

-- CreateIndex
CREATE INDEX "Transaction_is_internal_transfer_idx" ON "Transaction"("is_internal_transfer");

-- CreateIndex
CREATE INDEX "Transaction_internal_transfer_pair_id_idx" ON "Transaction"("internal_transfer_pair_id");

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_session_id_key" ON "BankConnection"("session_id");

-- CreateIndex
CREATE INDEX "BankConnection_provider_status_idx" ON "BankConnection"("provider", "status");

-- CreateIndex
CREATE INDEX "AccountLink_connection_id_idx" ON "AccountLink"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLink_account_id_connection_id_key" ON "AccountLink"("account_id", "connection_id");
