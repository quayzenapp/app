-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "business_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "commissionStatus" TEXT,
    "commissionDate" TEXT,
    "commissionRef" TEXT,
    "year1Start" TEXT,
    "changeSummary" TEXT,
    "sections" JSONB NOT NULL DEFAULT '{}',
    "years" JSONB NOT NULL DEFAULT '[]',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "notes" JSONB NOT NULL DEFAULT '{}',
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "preparedById" TEXT,
    "readyById" TEXT,
    "lockedById" TEXT,
    "lockedByName" TEXT,
    "lockedAt" TIMESTAMP(3),
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fyStart" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "lines" JSONB NOT NULL DEFAULT '{}',
    "preparedById" TEXT,
    "readyById" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "copiedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_plans_organizationId_versionNo_key" ON "business_plans"("organizationId", "versionNo");

-- CreateIndex
CREATE INDEX "budgets_organizationId_idx" ON "budgets"("organizationId");

ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_plans TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON budgets TO quayzen_app USING ("organizationId" = current_setting('app.org_id', true)) WITH CHECK ("organizationId" = current_setting('app.org_id', true));
CREATE POLICY owner_all ON business_plans TO quayzen_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_all ON budgets TO quayzen_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON business_plans TO quayzen_app;
REVOKE DELETE ON business_plans FROM quayzen_app;
GRANT SELECT, INSERT, UPDATE ON budgets TO quayzen_app;
REVOKE DELETE ON budgets FROM quayzen_app;

-- A locked plan's figures can't change, even through a bug. Milestone progress and explanations stay editable:
-- they are checked here by comparing only the planned part of each milestone.
CREATE FUNCTION business_plan_lock_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'Locked' AND (
    NEW.status <> 'Locked' OR NEW.title <> OLD.title OR NEW.years <> OLD.years OR NEW.sections <> OLD.sections
    OR NEW."year1Start" IS DISTINCT FROM OLD."year1Start" OR NEW.hash IS DISTINCT FROM OLD.hash
    OR (SELECT jsonb_agg(jsonb_build_array(m->'milestone', m->'target_date')) FROM jsonb_array_elements(NEW.milestones) m)
       IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(m->'milestone', m->'target_date')) FROM jsonb_array_elements(OLD.milestones) m)
  ) THEN
    RAISE EXCEPTION 'A locked business plan cannot be changed. Record a revised plan instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER business_plan_lock_guard BEFORE UPDATE ON business_plans FOR EACH ROW EXECUTE FUNCTION business_plan_lock_guard();
