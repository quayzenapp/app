#!/bin/bash
# Browser tests against the running dev stack. Needs Docker; removes the data it creates.
set -u
cd "$(dirname "$0")"; mkdir -p shots; [ -d node_modules ] || npm i --silent
docker run --rm --network host --user "$(id -u)" -e HOME=/tmp -v "$PWD":/e2e -w /e2e mcr.microsoft.com/playwright:v1.48.2-jammy node run.mjs /e2e/shots
code=$?
export PGPASSWORD=quayzen_dev_owner
psql -h localhost -p 5434 -U quayzen_owner quayzen -Atq <<'SQL'
DELETE FROM records WHERE data->>'title' = 'E2E obligation' OR data->>'description' = 'E2E import';
DELETE FROM return_snapshots WHERE "returnId" IN (SELECT id FROM annual_returns WHERE title LIKE 'E2E%');
DELETE FROM annual_returns WHERE title LIKE 'E2E%';
DELETE FROM audit_logs WHERE summary LIKE '%E2E%' OR summary LIKE '%e2e-%@demo.test%' OR ("entityType"='obligations' AND action='create') OR "entityType" IN ('returns') OR (action='import' AND summary LIKE '%e2e%');
DELETE FROM audit_logs WHERE "organizationId" IN (SELECT id FROM organizations WHERE name LIKE 'E2E Org %');
DELETE FROM organizations WHERE name LIKE 'E2E Org %';
DELETE FROM users WHERE email LIKE 'e2e-%@demo.test';
SQL
T=$(curl -s -d grant_type=client_credentials -d client_id=quayzen-admin -d client_secret=dev-admin-secret-change-me localhost:8180/realms/quayzen/protocol/openid-connect/token | python3 -I -c "import json,sys;print(json.load(sys.stdin)['access_token'])")
for id in $(curl -s -H "Authorization: Bearer $T" "localhost:8180/admin/realms/quayzen/users?email=e2e-&max=50" | python3 -I -c "import json,sys;[print(u['id']) for u in json.load(sys.stdin)]"); do curl -s -X DELETE -H "Authorization: Bearer $T" "localhost:8180/admin/realms/quayzen/users/$id"; done
exit $code
