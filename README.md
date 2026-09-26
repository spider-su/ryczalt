# Investory Accounting Mobile

Expo + React Native + TypeScript client for the Investory Accounting mobile app.

## Scope

The app presents authoritative monthly accounting data from the Investory API and an explicit mock mode.

Implemented mobile surface:

- Home / monthly Accounting dashboard
- total amount to pay
- Ryczałt / VAT / ZUS breakdown
- income preview
- cost preview
- payment preview
- "needs attention" card
- Invoices filtered by sales/purchases, approval and payment state
- shared month selection across Home, Faktury and Rozliczenia
- backend-driven month status and actionable issue summaries
- authoritative PPE, VAT, ZUS and total outstanding values
- settlement detail sheets with paid, unpaid and overdue states
- genuine multi-month invoice filtering (repository fetches invoices only for each requested month)
- Add Cost native invoice recognition and save flow using backend-provided required inputs
- typed mutation/duplicate/error mapping and refresh invalidation after confirmed mutations
- counterparty list/detail foundation with alias and rule-count presentation
- Polish and English UI with persisted language selection under More → Settings
- replaceable repository boundary with REST and explicit mock modes

The mobile client does not calculate tax, obligations, classification, payment matching or approval state. It does not initiate payments. It renders canonical period, settlement, reconciliation and completeness facts. Add Cost renders backend-defined required inputs and sends selected facts to the native invoice workflow.

## Design direction

The UI is inspired by the interaction principles visible in mObywatel:

- large, clear page headings
- card-based information hierarchy
- restrained blue accent
- generous spacing
- strong touch targets
- simple bottom navigation
- important status information surfaced before details

It does **not** copy mObywatel branding, logos or proprietary assets.

## Run

Use Node.js 22.13+ for Expo SDK 57.

```bash
npm install
npx expo install --fix
npm start
```

Then open the app using Expo Go or an Android/iOS development build.

On the sign-in screen, choose **Try the demo** to browse local sample accounting data without contacting the backend. The demo session remains active across app restarts until you sign out; demo changes are stored only in memory and are discarded when the app process restarts.

## Release validation

The managed Expo project has Android and iOS prebuild support and three EAS profiles:

```bash
npx expo-doctor
npx expo prebuild --no-install --platform android
npx expo prebuild --no-install --platform ios
npx eas-cli build --profile production --platform all
npx eas-cli submit --profile production --platform all
```

The repository contains the Expo owner (`smart-box`), project slug (`smart-box`) and EAS project ID. `EXPO_TOKEN`, Expo account authentication and signing credentials remain external CI/account configuration. Do not commit generated `android/` or `ios/` directories unless the project moves to a bare workflow. A successful cloud EAS build is independent of launching a local Android emulator; missing local SDK executables are local environment issues.

## Structure

Release operations and review materials are documented in
[`docs/store-metadata.md`](docs/store-metadata.md),
[`docs/crash-monitoring.md`](docs/crash-monitoring.md), and
[`docs/mobile-dependency-security.md`](docs/mobile-dependency-security.md).

```text
src/
  components/
    AccountingListCard.tsx
    PaymentCard.tsx
    SectionHeader.tsx
    SummaryCard.tsx

  data/
    accountingRepository.ts
    mockAccountingRepository.ts
    mocks/
      july2026.ts

  model/
    accounting.ts

  navigation/
    AppNavigator.tsx

  actions/
    cost/
      AddCostScreen.tsx
  screens/
    HomeScreen.tsx
    DocumentsScreen.tsx
    MoreScreen.tsx

  theme/
    theme.ts

  utils/
    money.ts
```

## Investory API configuration

The UI does not know where Accounting data comes from.

API mode requires an explicit `EXPO_PUBLIC_API_URL`; the app never silently falls back to a deployed production backend. Demo/mock mode does not require an API URL.

```bash
EXPO_PUBLIC_APP_ENV=development \
EXPO_PUBLIC_API_URL=https://your-development-api.example \
EXPO_PUBLIC_ACCOUNTING_DATA_SOURCE=api \
EXPO_PUBLIC_ACCOUNTING_MONTH=2025-01 \
npx expo start --web
```

To run Expo Web against the local Investory backend instead:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080 \
EXPO_PUBLIC_ACCOUNTING_DATA_SOURCE=api \
EXPO_PUBLIC_ACCOUNTING_MONTH=2025-01 \
npx expo start --web
```

Expo reads `EXPO_PUBLIC_*` variables when the development server starts, so restart
Expo after changing one.

EAS preview and production profiles set `EXPO_PUBLIC_APP_ENV` explicitly. Configure
the matching `EXPO_PUBLIC_API_URL` in the EAS environment before building; a missing
URL is a configuration error rather than a production fallback.

`EXPO_PUBLIC_ACCOUNTING_MONTH` selects the `YYYY-MM` month used by Home. The default data source is `api`; use `EXPO_PUBLIC_ACCOUNTING_DATA_SOURCE=mock` for the bundled July 2026 fixture.

The canonical accounting API calls are:

- `GET /api/profiles/{profileId}/accounting/periods`
- `GET /api/profiles/{profileId}/accounting/periods/{month}`
- `GET /api/profiles/{profileId}/accounting/periods/{month}/invoices`
- `GET /api/profiles/{profileId}/accounting/periods/{month}/transactions`
- `GET /api/profiles/{profileId}/accounting/periods/{month}/obligations`
- `GET /api/profiles/{profileId}/accounting/periods/{month}/issues`
- `GET /api/profiles/{profileId}/accounting/payments?from={month}&to={month}&type={type}`
- `GET /api/profiles/{profileId}/accounting/counterparties`

Invoice range filters request only invoices for each explicitly selected month. There is no unbounded global invoice-history endpoint or pagination contract.

Add Cost uses:

- `POST /api/profiles/{profileId}/accounting/invoices/recognize`
- `POST /api/profiles/{profileId}/accounting/invoices`

Recognition may return `requiredInputs: []`; this is a valid fully-resolved candidate, not a malformed response. Recognition and save transport are isolated behind the API/repository boundary until the native backend contract is finalized.

The backend must allow the Expo Web origin (`http://localhost:8081`) through its canonical `/api/**` CORS configuration. The mobile app does not add a browser CORS workaround.

### Text ownership and localization boundary

Known product state follows `backend code → mobile semantic presentation state → UI translation`. Backend human-readable fields remain optional detail and are not machine-translated. Canonical issue kinds and approval/payment enums are retained as codes; unknown values remain visible as unknown/attention states.

The UI keeps canonical accounting calculations on Investory. `settlement.totalOutstanding` and summary values are displayed as authoritative backend values; the mobile app never adds tax components to derive settlement totals. Accounting API monetary responses must be decimal strings; the mapper rejects numeric, scientific, malformed, `NaN`, and `Infinity` values. Currency is preserved from the canonical response and is not injected globally.

The UI supports exactly `pl` and `en`. English uses `en-GB` formatting for a European financial presentation; tax jurisdiction remains Poland. Saved locale preference takes precedence over supported device English, with Polish as fallback. Locale changes affect presentation strings and formatting only: accounting month IDs, backend enums, tax periods, amounts, currencies, profile and mutation payload semantics remain unchanged. Backend human-readable display fields are not machine-translated; stable backend codes are required for complete future localization.

Authentication uses the current token at request time. A confirmed HTTP 401 invalidates the central session and returns the app to sign-in. The accounting profile is resolved from the authenticated `/api/v1/auth/me` response; multi-profile switching is not yet available and remains a pre-production limitation.

The repository remains replaceable:

```ts
createAccountingRepository();
```

Keep all canonical accounting calculations on the Investory backend. The mobile project should display server results and perform only presentation-level formatting.

## Validation

```bash
npm ci
npm run typecheck
npm test
npm run ci
npx expo-doctor
```

The authoritative validation workflow is `.github/workflows/mobile.yml`. It runs Expo Doctor plus typechecking and tests for pull requests and pushes to `develop`/`main`, including changes to workflow files. Validation is allowed on non-main branches; EAS builds are restricted to `main`.

EAS workflows use the same repository-level `EXPO_TOKEN` secret. `mobile-production.yml` automatically builds Android and iOS production apps on pushes to `main`. `mobile-preview.yml` and `mobile-release.yml` are manually dispatched and fail immediately unless dispatched from `main`. Each workflow validates the token before dependency installation. The token is never stored in the repository or printed in logs. These workflows run EAS builds; they do not submit builds to app stores or publish OTA updates. Configure the Expo project/account and repository secret outside Git.

## Suggested next increment

1. Run the web POC journey in Chrome device emulation against a safe test account.
2. Validate the current native Android/iOS builds and the EAS release flow.
3. Add backend device registration and server-push support when the user-facing contract exists.
