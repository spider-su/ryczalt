#!/usr/bin/env bash
set -uo pipefail

# Investory live API smoke / contract test.
#
# Required:
#   INVESTORY_TEST_USER
#   INVESTORY_TEST_PASSWORD
#
# Optional:
#   INVESTORY_BASE_URL   default: Cloud Run test env
#   INVESTORY_PROFILE_ID default: 1
#   INVESTORY_MONTH      default: current YYYY-MM
#   E2E_REPORT_DIR       default: ./scripts/tmp/e2e-live-api
#
# Example:
#   INVESTORY_TEST_USER='alex.kotik' \
#   INVESTORY_TEST_PASSWORD='...' \
#   ./scripts/e2e-live-api.sh
#
# Requirements: curl, jq
#
# This script is intentionally READ-ONLY.
# Do not add mutations until their live OpenAPI schemas have been inspected.

BASE_URL="${INVESTORY_BASE_URL:-https://investory-61359240267.europe-central2.run.app}"
BASE_URL="${BASE_URL%/}"

USER="${INVESTORY_TEST_USER:-}"
PASSWORD="${INVESTORY_TEST_PASSWORD:-}"
PROFILE_ID="${INVESTORY_PROFILE_ID:-1}"
MONTH="${INVESTORY_MONTH:-$(date +%Y-%m)}"
REPORT_DIR="${E2E_REPORT_DIR:-./scripts/tmp/e2e-live-api}"

PASS=0
FAIL=0
WARN=0

mkdir -p "$REPORT_DIR"

if [[ -z "$USER" || -z "$PASSWORD" ]]; then
  echo "ERROR: INVESTORY_TEST_USER and INVESTORY_TEST_PASSWORD are required."
  exit 2
fi

for command in curl jq; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: '$command' is required."
    exit 2
  fi
done

redact() {
  sed \
    -e "s/${USER}/<REDACTED_USER>/g" \
    -e "s/${PASSWORD}/<REDACTED_PASSWORD>/g"
}

pass() {
  PASS=$((PASS + 1))
  printf 'PASS  %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  printf 'FAIL  %s\n' "$1"
}

warn() {
  WARN=$((WARN + 1))
  printf 'WARN  %s\n' "$1"
}

section() {
  printf '\n============================================================\n'
  printf '%s\n' "$1"
  printf '============================================================\n'
}

# request NAME METHOD PATH [AUTH]
# AUTH = yes/no, defaults yes
request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local auth="${4:-yes}"

  local body="$REPORT_DIR/${name}.json"
  local headers="$REPORT_DIR/${name}.headers"
  local url="${BASE_URL}${path}"
  local status

  local args=(
    --silent
    --show-error
    --location
    --connect-timeout 10
    --max-time 30
    --request "$method"
    --dump-header "$headers"
    --output "$body"
    --write-out "%{http_code}"
    --header "Accept: application/json"
  )

  if [[ "$auth" == "yes" ]]; then
    args+=(--user "${USER}:${PASSWORD}")
  fi

  status="$(curl "${args[@]}" "$url" 2>"$REPORT_DIR/${name}.stderr")"
  local curl_rc=$?

  if [[ $curl_rc -ne 0 ]]; then
    fail "$name — curl failed (rc=$curl_rc)"
    cat "$REPORT_DIR/${name}.stderr" | redact
    return 1
  fi

  printf '%s' "$status" >"$REPORT_DIR/${name}.status"

  echo "$status"
}

expect_status() {
  local name="$1"
  local actual="$2"
  shift 2

  local expected
  for expected in "$@"; do
    if [[ "$actual" == "$expected" ]]; then
      pass "$name — HTTP $actual"
      return 0
    fi
  done

  fail "$name — HTTP $actual, expected: $*"

  local body="$REPORT_DIR/${name}.json"
  if [[ -s "$body" ]]; then
    echo "Response:"
    head -c 2000 "$body" | redact
    echo
  fi

  return 1
}

json_check() {
  local name="$1"
  local expression="$2"
  local description="$3"
  local body="$REPORT_DIR/${name}.json"

  if [[ ! -s "$body" ]]; then
    fail "$description — empty response"
    return
  fi

  if ! jq empty "$body" >/dev/null 2>&1; then
    fail "$description — response is not JSON"
    return
  fi

  if jq -e "$expression" "$body" >/dev/null 2>&1; then
    pass "$description"
  else
    fail "$description"
  fi
}

section "Investory live API E2E smoke test"

echo "Base URL : $BASE_URL"
echo "Profile  : $PROFILE_ID"
echo "Month    : $MONTH"
echo "Reports  : $REPORT_DIR"
echo
echo "No mutation endpoints will be called."

#
# 1. Public deployment
#

section "1. Deployment"

status="$(request root GET / no || true)"

if [[ "$status" == "200" ]]; then
  pass "deployment root reachable"
else
  fail "deployment root — HTTP ${status:-curl failure}"
fi

#
# 2. Authentication boundary
#

section "2. Authentication"

status="$(request openapi_unauth GET /v3/api-docs no || true)"

if [[ "$status" == "401" || "$status" == "403" ]]; then
  pass "OpenAPI rejects unauthenticated request — HTTP $status"
else
  warn "OpenAPI unauthenticated response was HTTP ${status:-unknown}; expected 401/403"
fi

status="$(request openapi GET /v3/api-docs yes || true)"

if expect_status openapi "$status" 200; then
  json_check openapi '.paths | type == "object"' \
    "OpenAPI contains paths"
fi

#
# 3. Inspect live accounting contract
#

section "3. OpenAPI accounting contract"

OPENAPI="$REPORT_DIR/v3/api-docs"

if [[ -s "$OPENAPI" ]] && jq empty "$OPENAPI" >/dev/null 2>&1; then
  jq -r '
    .paths
    | keys[]
    | select(
        contains("accounting")
        or contains("profile")
        or contains("auth")
    )
  ' "$OPENAPI" \
    | sort \
    | tee "$REPORT_DIR/relevant-paths.txt"

  echo
  echo "Accounting operations:"
  jq -r '
    .paths
    | to_entries[]
    | select(.key | contains("accounting"))
    | .key as $path
    | .value
    | to_entries[]
    | select(.key | IN("get","post","put","patch","delete"))
    | "\(.key | ascii_upcase) \($path)"
  ' "$OPENAPI" \
    | sort \
    | tee "$REPORT_DIR/accounting-operations.txt"
else
  warn "Skipping OpenAPI contract inspection"
fi

#
# 4. Current accounting month
#

section "4. Accounting month"

MONTH_PATH="/api/v1/profiles/${PROFILE_ID}/accounting/months/${MONTH}"

status="$(request accounting_month GET "$MONTH_PATH" yes || true)"

if expect_status accounting_month "$status" 200; then
  json_check accounting_month 'type == "object"' \
    "Accounting month returns an object"

  echo
  echo "Month response:"
  jq . "$REPORT_DIR/accounting_month.json" | head -n 120
fi

#
# 5. Documents
#

section "5. Accounting documents"

DOCUMENTS_PATH="/api/v1/profiles/${PROFILE_ID}/accounting/months/${MONTH}/documents"

status="$(request documents GET "$DOCUMENTS_PATH" yes || true)"

if expect_status documents "$status" 200; then
  json_check documents \
    'type == "array" or (.content? | type == "array") or (.items? | type == "array")' \
    "Documents response has a collection shape"

  echo
  echo "Documents summary:"

  jq '
    if type == "array" then
      {count:length, sample:(.[0] // null)}
    elif (.content? | type) == "array" then
      {count:(.content|length), sample:(.content[0] // null)}
    elif (.items? | type) == "array" then
      {count:(.items|length), sample:(.items[0] // null)}
    else
      .
    end
  ' "$REPORT_DIR/documents.json" | head -n 120
fi

#
# 6. Settlement history
#

section "6. Settlement history"

PAYMENTS_PATH="/api/v1/profiles/${PROFILE_ID}/accounting/payments/history"

# Start without inventing filter/query parameters. The live contract tells us
# which parameters are actually supported.
status="$(request payments_history GET "$PAYMENTS_PATH" yes || true)"

if expect_status payments_history "$status" 200; then
  json_check payments_history \
    'type == "array" or (.content? | type == "array") or (.items? | type == "array")' \
    "Payment history returns a collection"

  echo
  echo "Payment history summary:"

  jq '
    if type == "array" then
      {count:length, sample:(.[0] // null)}
    elif (.content? | type) == "array" then
      {count:(.content|length), sample:(.content[0] // null)}
    elif (.items? | type) == "array" then
      {count:(.items|length), sample:(.items[0] // null)}
    else
      .
    end
  ' "$REPORT_DIR/payments_history.json" | head -n 120
fi

#
# 7. Known mobile API routes vs OpenAPI
#

section "7. Mobile/OpenAPI route comparison"

if [[ -s "$OPENAPI" ]] && jq empty "$OPENAPI" >/dev/null 2>&1; then
  check_openapi_path() {
    local path="$1"

    if jq -e --arg p "$path" '.paths[$p] != null' "$OPENAPI" >/dev/null; then
      pass "OpenAPI route exists: $path"
    else
      warn "OpenAPI route not found: $path"
    fi
  }

  check_openapi_path "/api/v1/profiles/{profileId}/accounting/months/{month}"
  check_openapi_path "/api/v1/profiles/{profileId}/accounting/months/{month}/documents"
  check_openapi_path "/api/v1/profiles/{profileId}/accounting/payments/history"
  check_openapi_path "/api/profiles/{profileId}/accounting/documents/recognize"
  check_openapi_path "/api/profiles/{profileId}/accounting/documents"
  check_openapi_path "/api/profiles/{profileId}/accounting/counterparties"

  echo
  echo "NOTE: WARN here may only mean the OpenAPI parameter is named differently."
  echo "      relevant-paths.txt contains the authoritative live paths."
fi

#
# 8. Money / accounting state inventory
#

section "8. Contract inventory"

for file in accounting_month documents payments_history; do
  path="$REPORT_DIR/${file}.json"

  if [[ -s "$path" ]] && jq empty "$path" >/dev/null 2>&1; then
    echo
    echo "--- $file: money-like values ---"

    jq -r '
      paths(scalars) as $p
      | ($p[-1] | tostring) as $key
      | select(
          ($key | ascii_downcase | contains("amount"))
          or ($key | ascii_downcase | contains("total"))
          or ($key | ascii_downcase | contains("revenue"))
          or ($key | ascii_downcase | contains("cost"))
          or ($key | ascii_downcase | contains("tax"))
          or ($key | ascii_downcase | contains("paid"))
          or ($key | ascii_downcase | contains("remaining"))
      )
      | "\($p | map(tostring) | join(".")) = \(getpath($p) | @json)"
    ' "$path" | head -n 100

    echo
    echo "--- $file: status/type/currency values ---"

    jq -r '
      paths(scalars) as $p
      | ($p[-1] | tostring | ascii_downcase) as $key
      | select(
          $key == "status"
          or $key == "type"
          or $key == "currency"
          or $key == "direction"
          or $key == "state"
      )
      | "\($p | map(tostring) | join(".")) = \(getpath($p) | @json)"
    ' "$path" | head -n 100
  fi
done

#
# 9. Mutation contract discovery — NO execution
#

section "9. Add Cost contract discovery"

if [[ -s "$OPENAPI" ]] && jq empty "$OPENAPI" >/dev/null 2>&1; then
  jq '
    .paths
    | to_entries[]
    | select(
        (.key | contains("/accounting/documents"))
        or (.key | contains("recognize"))
    )
  ' "$OPENAPI" >"$REPORT_DIR/add-cost-openapi.json"

  echo "Saved relevant mutation schemas to:"
  echo "  $REPORT_DIR/add-cost-openapi.json"
  echo
  echo "No recognition/save request was executed."
else
  warn "Could not extract Add Cost schemas because OpenAPI was unavailable"
fi

#
# 10. Final result
#

section "RESULT"

echo "PASS : $PASS"
echo "WARN : $WARN"
echo "FAIL : $FAIL"
echo
echo "Artifacts:"
echo "  $REPORT_DIR/v3/api-docs"
echo "  $REPORT_DIR/relevant-paths.txt"
echo "  $REPORT_DIR/accounting-operations.txt"
echo "  $REPORT_DIR/accounting_month.json"
echo "  $REPORT_DIR/documents.json"
echo "  $REPORT_DIR/payments_history.json"
echo "  $REPORT_DIR/add-cost-openapi.json"

# Create a sanitized summary archive/listing. Credentials are never written
# deliberately, but redact text artifacts defensively.
for file in "$REPORT_DIR"/*.stderr "$REPORT_DIR"/*.headers; do
  [[ -f "$file" ]] || continue
  tmp="${file}.tmp"
  redact <"$file" >"$tmp"
  mv "$tmp" "$file"
done

if [[ "$FAIL" -gt 0 ]]; then
  echo
  echo "LIVE API SMOKE TEST FAILED"
  exit 1
fi

echo
echo "LIVE API SMOKE TEST PASSED"
