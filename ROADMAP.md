# Ryczałt roadmap

## POC freeze gate

The POC feature set is frozen after the current correctness PR, portable local backup/restore, and Android/iOS build smoke tests.

Before tagging the POC release candidate:

- merge the final correctness fixes;
- run the complete Android landlord happy path on a clean emulator/physical device;
- verify upgrade over existing local data and persistence after restart;
- verify backup round-trip: current state → backup file → clean state/install → restore → equivalent financial screens;
- produce an Android local artifact;
- produce an iOS Simulator artifact locally on macOS with `eas build --platform ios --profile ios-simulator --local` and smoke-test onboarding, apartment setup, rent confirmation, Przychód, Podatek, Ustawienia, backup and restore;
- fix only incorrect financial results, data-loss risks, broken core workflows, or device/platform blockers.

After this gate, do not add speculative POC features. Validate the existing monthly workflow with real landlords first.

## Next after POC validation

Prioritize only when real-user feedback supports the need:

1. **Year-end PIT-28 summary/export** — annual reconciliation and a useful hand-off for filing; keep tax rules sourced and versioned.
2. **Cross-device/shared backup or sync** — evaluate only if file backup is insufficient for users.
3. **iOS distribution** — TestFlight/App Store release work after the local Simulator build proves compatibility.
4. **Pricing/paywall** — validate willingness to pay and the useful free/paid boundary before implementation.
5. **Store release hardening** — privacy/release metadata, production signing, store screenshots and release automation.

## Parked

Do not implement during the POC unless user evidence changes the priority:

- bank account/import integration;
- cloud accounts, backend and automatic synchronization;
- tenant portal / CRM / broad property-management features;
- additional tax regimes beyond the supported private-rental ryczałt scope;
- analytics/engagement machinery;
- speculative dashboard/UI polish after the freeze;
- quarterly settlement dead-code cleanup unless it creates a correctness or maintenance blocker.

## Product boundary

Ryczałt is a small landlord assistant, not a property-management suite. The recurring value proposition remains:

**confirm rent → see what needs attention → know the current tax position → record payment → done.**

Local-first data remains intentional. File backup/restore is the POC safety mechanism; cloud synchronization is not required for validation.


## POC scope simplification

Removed from the product scope before POC freeze:
- recurring household/property bills and their payment tracking,
- user-created personal/custom reminders.

Ryczałt notifications stay domain-native: expected rent, tax deadlines, and rental-agreement dates. Legacy bill/reminder fields may remain readable in local documents/backups for compatibility, but the app no longer creates, edits, schedules, or presents those features.
