-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Preparing',
    "data" JSONB NOT NULL DEFAULT '{}',
    "events" JSONB NOT NULL DEFAULT '[]',
    "preparedById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "snapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_people" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "gaps" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_organizationId_idx" ON "applications"("organizationId");

-- CreateIndex
CREATE INDEX "application_people_organizationId_applicationId_idx" ON "application_people"("organizationId", "applicationId");

-- CreateIndex
CREATE INDEX "application_snapshots_organizationId_applicationId_idx" ON "application_snapshots"("organizationId", "applicationId");

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON applications TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON applications TO quayzen_owner USING (true) WITH CHECK (true);
REVOKE ALL ON applications FROM quayzen_app;
GRANT SELECT, INSERT, UPDATE ON applications TO quayzen_app;

ALTER TABLE application_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_people FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON application_people TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON application_people TO quayzen_owner USING (true) WITH CHECK (true);
REVOKE ALL ON application_people FROM quayzen_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON application_people TO quayzen_app;

ALTER TABLE application_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON application_snapshots TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON application_snapshots TO quayzen_owner USING (true) WITH CHECK (true);
REVOKE ALL ON application_snapshots FROM quayzen_app;
GRANT SELECT, INSERT ON application_snapshots TO quayzen_app;
