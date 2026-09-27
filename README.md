# Ryczałt

**Twój osobisty asystent najmu.** Ryczałt is a local-first Expo mobile application for Polish private landlords: see what needs attention, record money actually received, review rental tax and open useful property-related services. The product direction is a lightweight personal assistant, **not** a full property-management platform.

> **Implementation status:** PR #5 and its native-readiness follow-up are under review; the four-tab assistant MVP is not yet merged to `develop`. Guided setup and recurring custom reminders remain planned; real-device notification and release checks remain pending. Roadmap milestones do not imply published app versions.

## Documentation

- [Product vision and boundaries](docs/PRODUCT.md)
- [MVP scope and acceptance](docs/MVP.md)
- [Canonical user flows](docs/USER_FLOWS.md)
- [Competitor patterns we intentionally adopt](docs/COMPETITIVE_ANALYSIS.md)
- [Codex implementation context](docs/CODEX_GUIDE.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Data model and migration rules](docs/DATA_MODEL.md)
- [Tasks and local notifications](docs/NOTIFICATIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Release process](docs/RELEASES.md)
- [Private beta Android checklist](docs/PRIVATE_BETA_ANDROID_CHECKLIST.md)
- [Change history](CHANGELOG.md)

## Current technical baseline

Expo SDK 57, React Native 0.86, React 19, TypeScript, AsyncStorage, Vitest and ESLint. The versioned local document holds apartments, manually confirmed income and tax-payment records, recurring bills, and separately confirmed bill payments. It includes a local ryczałt calculation and settlement flow. Monetary values are PLN decimal strings; avoid floating-point money calculations.

Local storage key: `pl.ryczalt.rental.localDocument.v1`; current schema is version 3. Schema versions 1 and 2 migrate directly to version 3 while retaining apartments, tenant snapshots, confirmed income/tax/bill payments, and existing reminder preferences. Version 3 includes effective-month rent rates, property links, one-time personal reminders and persisted task interaction state. Invalid/corrupt or unsupported documents produce errors, not silent resets. The app does not detect bank transfers or confirm income, tax, or bill payments automatically.

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

`npm run ci` runs typecheck, lint and tests. Repeatable platform checks are `npx expo-doctor`, `npx expo export --platform web`, and `npx expo prebuild --no-install --platform android`; generated native directories are ignored. GitHub Actions runs these checks on relevant PRs and pushes to `develop`/`main`.

## Distribution status

This app has its own verified Expo project, `@smart-box/ryczalt`, with project ID `90116624-70fc-4f49-92f7-e787344dc969`; it does not reuse the `ryczalt_it` project ID. GitHub Actions builds Android through EAS on `develop` (preview) and `main` (production profile), and a separate manual/targeted workflow assembles a local debug APK. These builds do not publish to an app store. Real-device and signing readiness are tracked in [RELEASES.md](docs/RELEASES.md). Generated red/white branding is temporary.
