# Ryczałt

**Twój osobisty asystent najmu.** Ryczałt is a local-first Expo mobile application for Polish private landlords: see what needs attention, record money actually received, review rental tax and open useful property-related services. The product direction is a lightweight personal assistant, **not** a full property-management platform.

> **Implementation status:** The current branch is a rental foundation, not the completed assistant. The existing UI has three tabs (Przychód, Podatek, Ustawienia); Pulpit, the tax engine, local notifications and useful links are planned. See [roadmap](docs/ROADMAP.md) for proposed milestones, not shipped release claims.

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
- [Change history](CHANGELOG.md)

## Current technical baseline

Expo SDK 57, React Native 0.86, React 19, TypeScript, AsyncStorage, Vitest and ESLint. The versioned local document holds apartments, manually confirmed income and tax-payment records, recurring bills, and separately confirmed bill payments. It includes a local ryczałt calculation and settlement flow. Monetary values are PLN decimal strings; avoid floating-point money calculations.

Local storage key: `pl.ryczalt.rental.localDocument.v1`. Schema version 1 migrates to version 2 while retaining legacy `tenantSince`, income and tenant snapshots, and tax-payment history. Invalid/corrupt or unsupported documents produce errors, not silent resets. The app does not detect bank transfers or confirm income, tax, or bill payments automatically.

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

`npm run ci` runs typecheck, lint and tests. Android managed-workflow prebuild check: `npx expo prebuild --no-install --platform android`; generated native directories are not committed.

## Distribution status

EAS builds remain manual until a standalone Expo project, account ownership and signing credentials are configured. Never reuse the `ryczalt_it` EAS project ID. Generated red/white branding is temporary. See [RELEASES.md](docs/RELEASES.md).
