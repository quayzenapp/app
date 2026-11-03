#!/bin/bash
# Browser tests against the running dev stack. Needs Docker; removes the data it creates.
set -u
cd "$(dirname "$0")"; mkdir -p shots; [ -d node_modules ] || npm i --silent
docker run --rm --network host --user "$(id -u)" -e HOME=/tmp -v "$PWD":/e2e -w /e2e mcr.microsoft.com/playwright:v1.48.2-jammy node "${1:-run}.mjs" /e2e/shots
code=$?
export PGPASSWORD=quayzen_dev_owner
for k in $(psql -h localhost -p 5434 -U quayzen_owner quayzen -Atc "SELECT \"storageKey\" FROM document_versions v JOIN documents d ON d.id=v.\"documentId\" WHERE d.title LIKE 'E2E%'"); do rm -f "../../apps/web/data/files/$k"; done
psql -h localhost -p 5434 -U quayzen_owner quayzen -Atq <<'SQL'
DELETE FROM documents WHERE title LIKE 'E2E%';
DELETE FROM application_snapshots WHERE "applicationId" IN (SELECT id FROM applications WHERE title LIKE 'E2E%');
DELETE FROM application_people WHERE "applicationId" IN (SELECT id FROM applications WHERE title LIKE 'E2E%');
DELETE FROM applications WHERE title LIKE 'E2E%';
UPDATE organizations SET stage = 'licensed' WHERE slug = 'demo-company';
DELETE FROM business_plans WHERE "versionNo" > 1 AND "organizationId" IN (SELECT id FROM organizations WHERE slug='demo-company');
UPDATE business_plans SET "isReference" = true WHERE "versionNo" = 1;
DELETE FROM budgets WHERE title LIKE 'E2E%' OR title = 'Budget 2026/27' OR "fyStart" >= '2030-01-01';
UPDATE organizations SET settings = '{}';
DELETE FROM audit_logs WHERE "entityType"='documents' AND (summary LIKE '%E2E%' OR summary LIKE 'Downloaded restricted file%');
DELETE FROM records WHERE data->>'title' LIKE 'Further information on the licence application%' OR data->>'title' = 'E2E obligation' OR data->>'description' = 'E2E import' OR data->>'name' = 'E2E office';
DELETE FROM return_snapshots WHERE "returnId" IN (SELECT id FROM annual_returns WHERE title LIKE 'E2E%');
DELETE FROM annual_returns WHERE title LIKE 'E2E%';
DELETE FROM audit_logs WHERE "entityType" IN ('apps','bplans','budgets','settings') OR "entityType"='reports' OR "entityType"='offices' OR summary LIKE '%E2E%' OR summary LIKE '%e2e-%@demo.test%' OR ("entityType"='obligations' AND action='create') OR "entityType" IN ('returns') OR (action='import' AND summary LIKE '%e2e%');
DELETE FROM audit_logs WHERE "organizationId" IN (SELECT id FROM organizations WHERE name LIKE 'E2E Org %');
DELETE FROM organizations WHERE name LIKE 'E2E Org %';
DELETE FROM users WHERE email LIKE 'e2e-%@demo.test';
SQL
T=$(curl -s -d grant_type=client_credentials -d client_id=quayzen-admin -d client_secret=dev-admin-secret-change-me localhost:8180/realms/quayzen/protocol/openid-connect/token | python3 -I -c "import json,sys;print(json.load(sys.stdin)['access_token'])")
for id in $(curl -s -H "Authorization: Bearer $T" "localhost:8180/admin/realms/quayzen/users?email=e2e-&max=50" | python3 -I -c "import json,sys;[print(u['id']) for u in json.load(sys.stdin)]"); do curl -s -X DELETE -H "Authorization: Bearer $T" "localhost:8180/admin/realms/quayzen/users/$id"; done
exit $code
