# Ryczałt

**Prosty asystent ryczałtu z najmu prywatnego.** Potwierdź otrzymany czynsz, sprawdź należny podatek i pilnuj terminu płatności — bez arkusza i bez dostępu do banku. Ryczałt is a local-first Expo app for Polish landlords with a few apartments. The user confirms receipts and tax payments manually; the app calculates from those confirmed records.

From the empty setup screen, choose **Zobacz demo** to explore two sample apartments and their payment/tax states. Demo changes stay in memory for that session, do not touch saved local data, and do not schedule OS reminders. **Wyjdź z demo** returns to the current local data.

> **Implementation status:** confirmed rental income, tax calculations and payment status, guided setup, and one-time/monthly/yearly reminders are implemented. The tax screen already shows cumulative revenue and the applicable threshold; the fuller annual/PIT-28 verification summary and JSON backup/restore are upcoming, not implemented. The app does not connect to a bank or file PIT-28 electronically. See [the roadmap](docs/ROADMAP.md) and [release readiness](docs/RELEASES.md). Roadmap milestones do not imply published app versions.

## Documentation

- [Product vision and boundaries](docs/PRODUCT.md)
- [MVP scope and acceptance](docs/MVP.md)
- [Canonical user flows](docs/USER_FLOWS.md)
- [Competitor patterns we intentionally adopt](docs/COMPETITIVE_ANALYSIS.md)
- [Codex implementation context](docs/CODEX_GUIDE.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Local data contract](docs/DATA_MODEL.md)
- [Tasks and local notifications](docs/NOTIFICATIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Release process](docs/RELEASES.md)
- [Private beta Android checklist](docs/PRIVATE_BETA_ANDROID_CHECKLIST.md)
- [Change history](CHANGELOG.md)

## Current technical baseline

Expo SDK 57, React Native 0.86, React 19, TypeScript, AsyncStorage, Vitest and ESLint. The versioned local document holds apartments, manually confirmed income and tax-payment records, recurring bills, and separately confirmed bill payments. It includes a local ryczałt calculation and settlement flow. Monetary values are PLN decimal strings; avoid floating-point money calculations.

Local storage key: `pl.ryczalt.rental.localDocument.v1`; current schema is version 1 and is intended for fresh installs. No previous schema is converted. Apartment terms are effective-dated; closed months persist apartment and account-tax snapshots. Pause marks vacancy and archive preserves history as a terminal soft delete. New apartments can seed individual historical monthly receipts with `INITIAL_IMPORT` provenance; existing months are not duplicated. Opening tax balances are aggregate prior-to-tracking context; any difference remains explicitly unassigned rather than creating a dated monthly obligation. Rent reminders are derived, grouped by due date/address, and use one global delay preference. Invalid/corrupt or unsupported documents open a recovery screen with raw-data copy and an explicitly confirmed reset. The app does not detect bank transfers or confirm payments automatically.

Native reminders are opt-in, categorized, reconciled from current local data, and scheduled for 09:00 in device-local time. Web keeps in-app reminders/status but does not schedule OS notifications. Payment details support copy actions; a Polish-bank-compatible QR format is deliberately deferred pending reliable compatibility verification. See [notification behavior](docs/NOTIFICATIONS.md), [data model](docs/DATA_MODEL.md), and [tax rules](docs/TAX_RULES.md).

## Development

Node.js 24 is used in CI.

```bash
npm ci
npm start
npm run web
npm run ci
npx expo-doctor
```

`npm run ci` runs typecheck, lint and Vitest tests. Tax calculation rules and examples are documented in [TAX_RULES.md](docs/TAX_RULES.md); the calculation regression suite is `src/domain/ryczaltTax.test.ts`. Repeatable platform checks are `npx expo-doctor`, `npx expo export --platform web`, and `npx expo prebuild --no-install --platform android`; generated native directories are ignored. GitHub Actions runs these checks on relevant PRs and pushes to `develop`/`main`.

## Distribution status

This app has its own verified Expo project, `@smart-box/ryczalt`, with project ID `90116624-70fc-4f49-92f7-e787344dc969`; it does not reuse the `ryczalt_it` project ID. GitHub Actions builds Android through EAS on `develop` (preview) and `main` (production profile), and a separate manual/targeted workflow assembles a local debug APK. These builds do not publish to an app store. Real-device and signing readiness are tracked in [RELEASES.md](docs/RELEASES.md). Generated red/white branding is temporary.
