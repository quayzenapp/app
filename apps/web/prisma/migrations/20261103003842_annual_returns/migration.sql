-- CreateTable
CREATE TABLE "annual_returns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'AR-2026',
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "headcountAsAt" TEXT NOT NULL,
    "officeAsAt" TEXT NOT NULL,
    "currencyMethod" TEXT NOT NULL DEFAULT 'split',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "lines" JSONB NOT NULL DEFAULT '{}',
    "preparedById" TEXT,
    "readyById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "snapshotId" TEXT,
    "submittedAt" TEXT,
    "submission" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "annual_returns_organizationId_idx" ON "annual_returns"("organizationId");

-- CreateIndex
CREATE INDEX "return_snapshots_organizationId_returnId_idx" ON "return_snapshots"("organizationId", "returnId");

ALTER TABLE annual_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_returns FORCE ROW LEVEL SECURITY;
ALTER TABLE return_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON annual_returns TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON return_snapshots TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON annual_returns TO quayzen_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_all ON return_snapshots TO quayzen_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON annual_returns TO quayzen_app;
GRANT SELECT, INSERT ON return_snapshots TO quayzen_app;
REVOKE UPDATE, DELETE ON return_snapshots FROM quayzen_app;
