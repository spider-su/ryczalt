# Technical architecture

## Current implementation (`develop`)

Expo SDK 57 / React Native 0.86 / React 19 / TypeScript, React Navigation, AsyncStorage and Vitest. `App.tsx` hosts Pulpit, Przychód, Podatek and Ustawienia. The schema-v3 document is validated and migrated by `src/data/localRentalStore.ts`; mutations are serialized and published only after persistence succeeds. `src/domain` owns validation, income operations, tax calculations and task projections. Local notification reconciliation consumes the same task notification plan used by the app. Guided setup and recurring custom reminders are not implemented.

## Target logical responsibilities (not a mandated folder rewrite)

- **Presentation:** Pulpit, Przychód, Podatek, Ustawienia; contextual actions and accessible Polish UI.
- **Application orchestration:** task projections, quick-action context, notification reconciliation and navigation intents.
- **Domain:** property expectations, confirmed income, tax calculation/payment, bills, agreement end date, task identity/lifecycle.
- **Infrastructure:** validated versioned local persistence, Expo local notifications and external URL handling.

Screens must not independently calculate tax or schedule notifications. One domain tax engine supplies both Podatek and Pulpit. One task projection supplies Pulpit and native notification reconciliation. Do not introduce a generic workflow engine or unnecessary dependency injection.

## Invariants

Confirmed income and tax payments are authoritative facts; expected rent is a separate planning fact. Derive financial task status from these sources. Persist only interaction state that cannot be derived (snooze, dismissal, custom reminder configuration). Reconcile on launch and data changes. Preserve explicit manual confirmation. Store money as decimal strings, calculate exactly and validate dates and references.

## Platform boundary

Use local notifications on supported native devices with permission handling and contextual navigation. Web and denied-permission mode must retain in-app tasks. Local OS delivery/background behavior is not guaranteed. External portals open in the system browser without credentials or scraping.

See [DATA_MODEL](DATA_MODEL.md), [NOTIFICATIONS](NOTIFICATIONS.md) and [RELEASES](RELEASES.md).
