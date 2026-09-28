# Technical architecture

## Current implementation

Expo SDK 57 / React Native 0.86 / React 19 / TypeScript, React Navigation, AsyncStorage and Vitest. `App.tsx` hosts Pulpit, Przychód, Podatek and Ustawienia. The schema-v7 document is validated and migrated by `src/data/localRentalStore.ts`; mutations are serialized and published only after persistence succeeds. `src/domain` owns validation, income operations, tax calculations and task projections. Local notification reconciliation consumes the same task notification plan used by the app; rent notifications group addresses by due date and share a global delay preference. Apartments have lifecycle states and the add flow can idempotently seed historical rent receipts. Guided setup, separately configured tenant-rent and taxable-base rules, and one-time/monthly/yearly custom reminders are implemented.

Demo mode is an in-memory session owned by `RentalDataProvider`. `enterDemoMode()` switches the active document to `createDemoRentalDocument()` without writing it to AsyncStorage; mutations stay in that demo document, and `exitDemoMode()` restores the untouched current real document. The demo flag is not persisted, so app restart returns to normal local data. `ReminderProvider` skips schedule reconciliation and permission prompts in demo mode. The empty Pulpit setup card and the Pulpit quick-actions menu expose the entry point; the app shell provides the persistent demo banner and exit action. A future landing page can invoke the provider's `enterDemoMode()` action after the app is open; no public deep link is currently configured.

## Target logical responsibilities (not a mandated folder rewrite)

- **Presentation:** Pulpit, Przychód, Podatek, Ustawienia; contextual actions and accessible Polish UI.
- **Application orchestration:** task projections, quick-action context, notification reconciliation and navigation intents.
- **Domain:** property expectations, confirmed income, tax calculation/payment, bills, agreement end date, task identity/lifecycle.
- **Infrastructure:** validated versioned local persistence, Expo local notifications and external URL handling.

Screens must not independently calculate tax or schedule notifications. One domain tax engine supplies both Podatek and Pulpit. One task projection supplies Pulpit and native notification reconciliation. Do not introduce a generic workflow engine or unnecessary dependency injection.

## Calculation boundary and regression checks

`src/domain/ryczaltTax.ts` is the sole tax calculator. It accepts manually confirmed income and tax-payment records, groups taxable amounts by actual receipt date, applies the supported year's cumulative threshold, rounds each monthly or quarterly obligation to whole PLN, and calculates the statutory payment deadline. Tax payments change the outstanding balance/status only; they do not alter the obligation. `TAX_RULES.md` defines supported years and user-facing limitations.

Keep calculations deterministic in tests by supplying `today`; do not depend on the machine's current date. The regression suite should cover both rate bands and threshold variants, receipt-period grouping, corrections, payment states, rounding boundaries, supported-year boundaries, and weekends/public holidays. Run `npm run ci` after changing calculation or settlement logic.

## Invariants

Confirmed income and tax payments are authoritative facts; expected rent is a separate planning fact. Derive financial task status from these sources. Persist only interaction state that cannot be derived (snooze, dismissal, custom reminder configuration). Reconcile on launch and data changes. Preserve explicit manual confirmation. Store money as decimal strings, calculate exactly and validate dates and references.

## Platform boundary

Use local notifications on supported native devices with permission handling and contextual navigation. Web and denied-permission mode must retain in-app tasks. Local OS delivery/background behavior is not guaranteed. External portals open in the system browser without credentials or scraping.

On Android, create the reminder channel at startup independently of notification permission; channel setup is idempotent. Permission/support state is separate from schedule reconciliation. A scheduling failure does not mark permission unavailable; reconciliation retries after data/settings changes and when the app returns to the foreground.

See [DATA_MODEL](DATA_MODEL.md), [NOTIFICATIONS](NOTIFICATIONS.md) and [RELEASES](RELEASES.md).
