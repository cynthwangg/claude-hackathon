#!/usr/bin/env bash
# The V1 gate. Unit and scenario tests, blocker greps, production build, then Playwright of section 7.1
# in Spanish and English against next start on port 3100 with the test provider and a scratch database.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=3100
export DATABASE_URL="file:./gate.db" MODEL_PROVIDER=mock DEMO_TODAY=2026-11-05
# The gate tests WhatsApp over TwiML on localhost. Blank the Twilio keys so a filled .env cannot switch it to the REST path.
export TWILIO_ACCOUNT_SID="" TWILIO_AUTH_TOKEN="" PUBLIC_WEBHOOK_URL=""

echo "== unit, scenario and blocker tests"
npx vitest run

echo "== typecheck and production build"
npx tsc --noEmit
npx next build >/tmp/earned-gate-build.log 2>&1 || { tail -40 /tmp/earned-gate-build.log; exit 1; }

echo "== scratch database"
rm -f prisma/gate.db prisma/gate.db-journal
npx prisma db push --skip-generate >/dev/null

echo "== start on $PORT"
npx next start -p $PORT >/tmp/earned-gate-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
curl -s --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null "http://localhost:$PORT/"

echo "== Playwright, section 7.1 in es and en"
E2E_BASE_URL="http://localhost:$PORT" npx playwright test
echo "== gate green"
