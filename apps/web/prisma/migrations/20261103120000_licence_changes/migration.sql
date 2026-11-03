CREATE TABLE licence_filings (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "kind" TEXT NOT NULL DEFAULT 'change', "status" TEXT NOT NULL DEFAULT 'Draft',
 "data" JSONB NOT NULL DEFAULT '{}', "events" JSONB NOT NULL DEFAULT '[]',
 "dueDate" TEXT, "updatedById" TEXT, "snapshotId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "licence_filings_organizationId_idx" ON licence_filings("organizationId");
CREATE TABLE filing_snapshots (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "filingId" TEXT NOT NULL,
 "versionNo" INTEGER NOT NULL, "body" JSONB NOT NULL, "hash" TEXT NOT NULL,
 "approvedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "filing_snapshots_organizationId_filingId_versionNo_key" ON filing_snapshots("organizationId", "filingId", "versionNo");

ALTER TABLE licence_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE licence_filings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON licence_filings TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON licence_filings TO quayzen_owner USING (true) WITH CHECK (true);
REVOKE ALL ON licence_filings FROM quayzen_app;
GRANT SELECT, INSERT, UPDATE ON licence_filings TO quayzen_app;

ALTER TABLE filing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE filing_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON filing_snapshots TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON filing_snapshots TO quayzen_owner USING (true) WITH CHECK (true);
REVOKE ALL ON filing_snapshots FROM quayzen_app;
GRANT SELECT, INSERT ON filing_snapshots TO quayzen_app;
