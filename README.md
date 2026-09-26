# Ryczałt

Ryczałt is a lightweight mobile application for Polish private rental income management. The MVP is intentionally local-first: it helps record confirmed rental income and manually confirmed tax payments without connecting to remote backends, bank feeds, or any production service.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript
- AsyncStorage for local persistence
- Vitest and ESLint for validation

## Product Scope

The current app is a standalone skeleton with three Polish tabs:

- `Przychód` for confirmed rental income.
- `Podatek` for future manually confirmed tax-payment summaries.
- `Ustawienia` for properties, tenants, and JSON import/export in a later stage.

The app stores a versioned JSON document containing:

- `Property`
- `IncomeEntry`
- `TaxPayment`
- `RentalDocument`

Monetary values are decimal strings in PLN. The mobile app must not use floating-point arithmetic for money.

## Local-First Architecture

Data is stored in a separate AsyncStorage namespace for this app:

```text
pl.ryczalt.rental.localDocument.v1
```

Loading validates the JSON document at runtime. Empty storage creates an empty document, but corrupted JSON, malformed documents, and unsupported schema versions are reported as errors rather than silently replaced.

## Manual Confirmation Principle

Only manually confirmed rental payments should become income entries. The app does not confirm bank transfers automatically, infer payments from notifications, or mark tax obligations as paid without an explicit user action.

## Development

Use Node.js 24 for the current CI setup.

```bash
npm ci
npm start
npm run web
```

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run ci
npx expo-doctor
```

The CI workflow installs dependencies with `npm ci` and runs type checking, linting, and tests. Expo Doctor is still part of local release readiness checks.

## Android Prebuild

Android native project generation can be checked locally with:

```bash
npx expo prebuild --no-install --platform android
```

Generated `android/` and `ios/` directories are not committed while the app remains in the managed Expo workflow.

## Branding

The app name is `Ryczałt`, the primary language is Polish, and the primary accent is red. Current icons are temporary generated red-and-white house-style assets. Replace them with approved final source artwork when it is available.

## EAS Setup

EAS builds are intentionally manual until the standalone Expo project, account ownership, signing credentials, and project ID are configured. Do not reuse the `ryczalt_it` Expo project ID.

Before enabling release workflows, configure:

- Expo account access.
- A standalone EAS project for this repository.
- Android and iOS signing credentials.
- Repository secret `EXPO_TOKEN` if CI build workflows are added later.

## Deferred Features

- Verified Polish tax calculation rules.
- Automatic payment confirmation.
- Bank integrations.
- Contract lifecycle management.
- Backend synchronization.
- Push notifications.
- Store submission automation.
