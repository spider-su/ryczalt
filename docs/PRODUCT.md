# Product — Ryczałt

## Positioning

**Ryczałt — Twój osobisty asystent najmu.** A lightweight, local-first personal assistant for people managing a small number of private rental apartments in Poland.

**Daily promise:** open the app, see what needs attention, act in a few taps and close it. The app helps the landlord remember, check and complete tasks; it does not claim to know whether a bank transfer occurred.

## Product pillars

1. **Personal reminders:** persistent in-app tasks backed by local device notifications for tenant-payment checks, tax, recurring bills, agreement end dates and minimal custom reminders.
2. **Confirmed financial facts:** actual receipt date and amount, partial payments, calculated tax and explicitly confirmed tax/bill payments.
3. **Light statistics:** monthly confirmed income, expected rent still to check, outstanding tax, upcoming tasks and a short income history.
4. **Useful links:** user-configured apartment administrator and utility portals, plus relevant official tax services. Opening a portal never means a payment was made.

## UX principles

- Pulpit is the intended daily landing screen; Przychód, Podatek and Ustawienia retain focused responsibilities.
- Notifications lead to contextual actions; tasks remain visible if OS notifications are dismissed or unavailable.
- Prefer “Sprawdź wpłatę” / “Do potwierdzenia” over asserting an unpaid tenant debt.
- Expected rent is not taxable income; only actual receipts feed the tax calculation.
- A dismissed/snoozed reminder is not a confirmed financial transaction.
- Borrow familiar interaction patterns from competitors, not their screens, copy or complex workflows.
- Polish-first, red/white identity, calm mobile-first layout, short paths to common actions.

## Boundaries

Not Investory (no portfolio analytics, valuations or retirement planning); not `ryczalt_it` (no JDG/VAT/KSeF accounting); not a full property manager (no tenant accounts, messaging, document repository or maintenance tickets). No backend, bank sync, auto payment confirmation or cloud push in the MVP.

PIT-28 annual reporting, backup/import/export and Investory integration are **parked for a later phase**, not implied by the MVP or any unshipped milestone.

## Status

This document describes the **target product**, not the current feature inventory. [MVP](MVP.md) separates existing foundation from intended MVP; [ROADMAP](ROADMAP.md) distinguishes proposed milestones from releases.