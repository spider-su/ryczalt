# Codex implementation guide

Use this document as the default context for implementation tasks in this repository.

## Current capability snapshot (`main` and `develop`)

- **Implemented:** Pulpit and three supporting tabs; schema-v4 local persistence/migrations; confirmed income and tax/bill payments; effective-month rents; shared tax engine and task projection; local reminders; apartment links; one-time/monthly/yearly custom reminders and compact statistics; guided setup.
- **Partial/requires verification:** native notification delivery, permissions, deep-link behavior and DST/timezone/restart behavior need physical-device checks.
- **Upcoming priorities:** year-to-date/annual tax and PIT-28 verification summary, and local JSON backup/restore. These are not implemented. Investory integration remains later/optional.

Source code and tests on the checked-out branch are authoritative; these labels should be revisited when code changes.

## 1. Read these documents before coding

In order:

1. `docs/PRODUCT.md`
2. `docs/MVP.md`
3. `docs/USER_FLOWS.md`
4. `docs/COMPETITIVE_ANALYSIS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DATA_MODEL.md`
7. `docs/NOTIFICATIONS.md`
8. `docs/ROADMAP.md`
9. `docs/RELEASES.md`

Then inspect the **current branch**. Documentation describes target behavior and boundaries; source code is authoritative for what is already implemented.

Do not reimplement something that already exists under a different name.

## 2. Product invariant

**Ryczałt helps the user confirm income, calculate tax, meet the deadline and prepare annual figures. The user confirms real-world payments.**

The app may derive what should be checked, calculate what can be calculated and schedule reminders, but it must not claim a real-world financial event occurred without explicit confirmation.

Examples:

- expected rent may create a “Sprawdź wpłatę” task;
- it may not create an `IncomeEntry`;
- a tax obligation may create a payment reminder;
- displaying QR/payment details may not create a `TaxPayment`;
- opening an administration portal may not mark a bill paid.

## 3. Architecture rules

Keep the existing Expo / React Native / TypeScript stack and local-first persistence.

Prefer small domain functions and projections over framework abstractions.

Do not introduce:
- backend/API requirements for core flows;
- Redux or a general state-management framework unless existing architecture objectively cannot support the use case;
- event sourcing;
- generic workflow engines;
- duplicate tax/task/reminder engines;
- a second source of truth for calculated financial status.

Target responsibility split:

- **Domain:** money/date rules, expected-vs-confirmed calculations, tax engine, task derivation.
- **Application/data:** serialized document updates, migration, task interaction state, notification reconciliation.
- **Presentation:** forms/cards/navigation only; do not bury business calculations in screens.
- **Infrastructure:** AsyncStorage, Expo notifications, Linking/share APIs.

## 4. Financial data rules

- Money is PLN decimal-string at persisted boundaries.
- Never use JS floating point for tax/money calculations.
- Actual receipt date controls taxable revenue.
- `rentalMonth` describes the rental period and may differ from receipt month.
- Expected rent is planning data, never actual income.
- Taxable amount defaults to received amount but remains a distinct value.
- Historical tenant snapshots must not change when current tenant changes.
- Historical expected rent must not change when the current default rent changes.

Expected-vs-received views use the implemented effective-month `rentSchedule`. Do not fall back to today's rent for unknown legacy history.

## 5. Task model rules

Most tasks are **projections**, not manually stored financial obligations.

Core task categories:
- tenant payment check;
- tax payment;
- recurring bill;
- agreement end;
- minimal personal reminder.

Stable identity must include source + relevant period/event so restart/reconciliation does not duplicate tasks.

Persist only what cannot be safely derived:
- snooze-until;
- dismissal;
- custom reminder configuration;
- any explicit nonfinancial completion that has no source record.

Financial completion should be derived from confirmed financial records.

If an underlying receipt/payment is edited or deleted, task state must re-evaluate.

## 6. Notifications

Local notifications are a presentation/delivery layer over tasks.

Requirements:
- central scheduling/reconciliation service;
- stable native notification IDs;
- cancel stale notifications;
- no duplicates after restart;
- permission denied and Web must still have in-app tasks;
- notification tap navigates contextually;
- snooze changes reminder time, not due date;
- avoid repeated alerts for resolved tasks.

Do not promise OS delivery guarantees.

## 7. Apartment configuration

Keep apartment setup small but sufficient for derived workflows:

- name/address;
- current tenant name/contact;
- expected rent with history/effective date;
- expected payment day;
- optional agreement end date and reminder offsets;
- administrator portal and optional useful links;
- optional fixed/variable recurring bills.

Do not turn this into full contract lifecycle management.

### Guided setup (implemented)

A lightweight checklist can guide the initial configuration:
1. apartment;
2. expected rent;
3. payment day;
4. optional tenant;
5. reminder preferences;
6. optional administrator portal.

Required vs optional fields must be clear. Completed setup should disappear from the everyday dashboard.

## 8. Bills

Two modes only unless requirements change:

**Fixed**
- expected amount can be shown/prefilled;
- reminder based on due day.

**Variable**
- do not treat last amount as authoritative;
- reminder says to verify the current amount;
- provide relevant portal/link if configured.

Opening a portal is not payment.

## 9. UI priorities

Pulpit priority:
1. requires attention;
2. upcoming;
3. quick actions;
4. compact monthly statistics;
5. apartment summaries/links.

Do not lead with charts.

Suggested language:
- `Sprawdź wpłatę`
- `Do potwierdzenia`
- `Częściowo otrzymano`
- `Potwierdzone`
- `Przypomnij później`
- `Otwórz portal`

Avoid `Zaległość` unless the app has explicit facts proving arrears.

No competitor screen should be copied. Adapt only interaction patterns documented in `COMPETITIVE_ANALYSIS.md`.

## 10. Scope guardrails

Product priority is confirmed income → ryczałt calculation → payment deadline → annual settlement readiness. Apartment setup, expected rent, reminders, tax payment details and local backup/restore support that job. Recurring bills, links, agreement reminders and light statistics are conveniences. Do not let them displace the core workflow.

Do not implement upcoming features unless they are explicitly in scope for the task:
- year-to-date/annual tax summary and PIT-28 verification readiness (upcoming 0.6/0.7; not electronic filing);
- local JSON backup/import/restore (upcoming 0.7; not cloud backup).

Do not expand generic reminders or task management unless explicitly requested and supported by user demand. Keep these lower-priority ideas parked:
- Investory integration;
- bank synchronization;
- OCR;
- tenant messaging/accounts;
- deposit management;
- documents/e-signatures;
- maintenance tickets;
- property valuation/ROI;
- cloud sync/backend;
- home-screen widgets.

If implementation pressure suggests adding one of these to solve another problem, stop and find a smaller local solution first.

## 11. Work sequence for a feature

For every feature:

1. Inspect current branch and related tests.
2. Identify source of truth and migration impact.
3. Add/adjust pure domain operations first.
4. Add persistence/migration changes with backward-compatibility tests.
5. Add UI.
6. Add notification reconciliation only after domain state exists.
7. Cover correction/deletion/failure paths, not only happy path.
8. Run repository-defined validation.
9. Update docs if delivered behavior changes product contracts.
10. Report what is implemented vs what still requires physical-device validation.

Do not claim native notification, store build or tax correctness verification that was not actually performed.

## 12. Expected test scenarios

At minimum consider:
- partial rent;
- corrected/deleted rent;
- rent amount change across months;
- tenant change;
- receipt month != rental month;
- tax threshold/period correction;
- partial tax payment;
- bill fixed vs variable;
- agreement end changed/removed;
- snooze/dismiss/reopen;
- app restart/reconciliation;
- notification permission denied;
- persistence failure/concurrent updates;
- schema migration.

## 13. Release discipline

Roadmap milestones are not releases. Do not bump versions or claim a feature shipped merely because its code exists on a feature branch.

Before release, follow `docs/RELEASES.md`, especially:
- local data migration;
- real-device notification testing;
- tax examples;
- Android/iOS configuration;
- documentation/changelog alignment.

## 14. Definition of a good change

A good change makes Ryczałt easier to use in under a minute, preserves manual confirmation, derives state from existing facts and adds as little new configuration as possible.
