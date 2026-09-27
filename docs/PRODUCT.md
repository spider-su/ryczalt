# Product — Ryczałt

## Positioning

**Ryczałt — Twój osobisty asystent najmu.** A lightweight, local-first personal assistant for people managing a small number of private rental apartments in Poland.

**Daily promise:** open the app, see what needs attention, act in a few taps and close it. The app helps the landlord remember, check and complete tasks; it does not claim to know whether a bank transfer occurred.

## Product pillars

1. **Personal reminders:** persistent in-app tasks backed by local device notifications for tenant-payment checks, tax, recurring bills, agreement end dates and small personal reminders.
2. **Confirmed financial facts:** actual receipt date and amount, partial payments, calculated tax and explicitly confirmed tax/bill payments.
3. **Light statistics:** monthly confirmed income, expected rent still to check, outstanding tax, upcoming tasks and a short income history.
4. **Useful links:** user-configured apartment administrator and utility portals, plus relevant official tax services. Opening a portal never means a payment was made.
5. **Guided simplicity:** one-time setup should configure enough information for the app to derive recurring responsibilities automatically.

## Product strategy: proven patterns, adapted

Do not invent a new rental-management paradigm when an interaction has already been proven in landlord products.

Patterns we intentionally adopt and adapt:

- apartment-level monthly overview;
- expected vs confirmed rent;
- partial-payment handling;
- contract/agreement end reminders;
- recurring reminders associated with a property;
- a dashboard that combines attention items with a small financial summary;
- guided setup/checklist;
- recurring fixed and variable apartment charges.

Ryczałt should combine these patterns around a narrower promise: **remember what matters, show what needs attention, and let the landlord confirm reality manually**.

Competitor layouts and flows are references, not templates. Do not copy proprietary text, branding, screen composition or feature complexity. See [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md).

## UX principles

- Pulpit is the intended daily landing screen; Przychód, Podatek and Ustawienia retain focused responsibilities.
- Pulpit is an assistant, not a generic to-do app: most tasks are derived from apartment/tax/bill facts rather than manually created.
- Notifications lead to contextual actions; tasks remain visible if OS notifications are dismissed or unavailable.
- Prefer “Sprawdź wpłatę” / “Do potwierdzenia” over asserting an unpaid tenant debt.
- Expected rent is not taxable income; only actual confirmed receipts feed the tax calculation.
- A dismissed/snoozed reminder is not a confirmed financial transaction.
- Fixed bills may have an expected amount; variable bills should prompt the user to verify the current amount.
- Setup guidance should disappear when complete and not occupy the daily dashboard permanently.
- Polish-first, red/white identity, calm mobile-first layout, short paths to common actions.

## Boundaries

Not Investory (no portfolio analytics, valuations or retirement planning); not `ryczalt_it` (no JDG/VAT/KSeF accounting); not a full property manager (no tenant accounts, messaging, document repository or maintenance tickets). No backend, bank sync, auto payment confirmation or cloud push in the MVP.

PIT-28 annual reporting, backup/import/export and Investory integration are **parked for a later phase**, not implied by the MVP or any unshipped milestone.

## Status

- **Implemented:** four-tab app, local tax engine/payment records, persistent derived tasks, rent history, recurring bills, agreement reminders, apartment links, local notification scheduling, one-time custom reminders and compact statistics.
- **Partial:** notification delivery/deep-link behavior needs physical-device verification; release setup, privacy review and accessibility validation remain incomplete.
- **Planned:** guided setup and recurring custom reminders.
- **Parked:** PIT-28, JSON backup/import/export and Investory integration.

See [MVP](MVP.md) for current acceptance scope and [ROADMAP](ROADMAP.md) for delivery state. Milestones are not published releases.
