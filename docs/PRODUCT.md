# Product — Ryczałt

## Positioning

**Ryczałt — prosty asystent ryczałtu z najmu prywatnego.** A local-first tax and payment assistant for Polish landlords with a few apartments.

**Core promise:** “Potwierdzasz wpłatę, aplikacja liczy podatek i pilnuje terminu.” The main job is to answer: Did the rent arrive? How much tax do I owe? By when must I pay it? What figures should I verify at year end?

## Product pillars

1. **Confirmed rental income:** actual receipt date and amount, partial receipts and corrections are manually confirmed; expected rent never counts as income.
2. **Correct ryczałt calculation:** calculate from confirmed taxable receipts using supported Polish rules, rates and thresholds.
3. **Payment deadlines and status:** show the obligation, due date, confirmed tax payments and remaining amount.
4. **Year-end readiness:** make annual income/tax figures clear and verifiable before the user compares or enters them in official tax services. Annual/PIT-28 verification is upcoming work; electronic filing is out of scope.

## Priority levels

- **P0 — Core reason to use the app:** confirmed rental income, ryczałt calculation, tax payment deadline and annual/PIT-28 readiness.
- **P1 — Makes the core easier:** apartment and current tenant/contact, expected rent, reminders and tax payment details.
- **P2 — Convenience:** administrator/utility links, agreement reminders and light statistics.
- **P3 — Only with demonstrated user demand:** cloud sync, spouse/shared access, bank feeds, document management, deposits, full expense accounting, tenant communication and maintenance workflows.

Keep this hierarchy in roadmap and implementation decisions: supporting tasks should make the rent-to-tax workflow easier, not displace it.

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
- a dashboard that combines attention items with a small financial summary.

Ryczałt adopts only patterns that support its tax/payment promise: **the landlord confirms what arrived; the app calculates tax and tracks the deadline**.

Competitor layouts and flows are references, not templates. Do not copy proprietary text, branding, screen composition or feature complexity. See [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md).

## UX principles

- The rent → tax → deadline workflow is primary; the Pulpit and reminders support it.
- Do not expand generic task/reminder management unless explicitly requested and supported by user demand.
- Notifications lead to contextual actions; tasks remain visible if OS notifications are dismissed or unavailable.
- Prefer “Sprawdź wpłatę” / “Do potwierdzenia” over asserting an unpaid tenant debt.
- Expected rent is not taxable income; only actual confirmed receipts feed the tax calculation.
- A dismissed/snoozed reminder is not a confirmed financial transaction.
- Setup guidance should disappear when complete and not occupy the daily dashboard permanently.
- Polish-first, red/white identity, calm mobile-first layout, short paths to common actions.

## Boundaries

No backend, bank integration, automatic payment confirmation or cloud sync. User-controlled JSON export/import is implemented and is a POC release gate. Android system backup is enabled but depends on OS/device settings and does not guarantee restore after uninstall. Apartment, income, tax, reminder and tenant/contact data is stored locally in AsyncStorage without app-level encryption. Tax calculations are informational; rates are versioned and verified by year, with visible provisional fallback for future unverified years. The app does not submit electronic PIT-28. Investory integration remains later/optional.

Not Investory (no portfolio analytics, valuations or retirement planning); not `ryczalt_it` (no JDG/VAT/KSeF accounting); not a full property manager (no tenant accounts, messaging, document repository or maintenance tickets).

## Public web companion

The independently hosted [public calculator](https://ryczalt.smart-box.workers.dev/) is a lightweight, informational introduction for landlords who want a quick annual estimate before installing the app. It is a standalone static page, not a Web version of the local rental ledger and not an app backend. It does not receive or synchronize apartment, tenant, payment or tax-payment records. Its calculation and annual tax copy are separate from the app's tax engine and must be reviewed independently when rules change. Technical and calculation boundaries are recorded in [WEB_CALCULATOR](WEB_CALCULATOR.md).

## Status

- **Implemented:** four-tab app, local tax engine/payment records, persistent derived tasks, guided setup, rent history, agreement reminders, owner-rent/media property setup, administration/electricity links, grouped rent/tax/lease notifications and compact statistics. Bills and personal reminders are removed from the POC UI/scheduling; legacy fields remain readable.
- **Implemented:** validated local JSON export/import and last-good local recovery. AsyncStorage is not encrypted by the app.
- **Partial:** notification delivery/deep-link behavior needs physical-device verification; release setup, privacy review and accessibility validation remain incomplete.
- **POC release gate:** see the root [ROADMAP](../ROADMAP.md). Readiness remains unverified until candidate-specific CI, artifact, emulator, backup and physical-device evidence is recorded.
- **Upcoming:** year-to-date/annual tax summaries and annual/PIT-28 verification readiness; see [ROADMAP](ROADMAP.md). These are not implemented yet.
- **Later/optional:** Investory integration and P3 features without demonstrated user demand.

See [MVP](MVP.md) for current acceptance scope and [ROADMAP](ROADMAP.md) for delivery state. Milestones are not published releases.
