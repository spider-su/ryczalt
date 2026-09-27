# Competitive patterns — what we adopt and what we do not

This document captures product patterns observed in comparable landlord/rental products so implementation can reuse established ideas without copying a competitor's UI, wording or scope. Ryczałt's differentiation is a **Polish private-rental tax/payment assistant for landlords with a few flats**, not breadth as a generic landlord-management app.

## Closest reference patterns

### Rento

Relevant patterns:
- small-landlord focus;
- property + tenant record;
- expected rent and payment day;
- manually recorded rent payments;
- partial-payment/history concepts;
- agreement-date reminders;
- local/offline-oriented usage;
- compact multi-property overview.

**Adopt:** apartment monthly status, expected vs confirmed, payment-day reminders, contract-end reminder.

**Do not automatically adopt:** deposits, handover protocols, broad expense accounting or every tenancy workflow.

### Rentio (Polish platform)

Relevant patterns:
- assistant-style onboarding;
- action plan/checklist;
- payment, bill and agreement reminders;
- dashboard that mixes tasks with summary information;
- task completion when related information is available.

**Adopt:** actionable dashboard, derived tasks and context-sensitive completion. Guided setup is implemented as a lightweight, derived Pulpit flow.

**Do not adopt:** tenant portals, bank import, KSeF/business accounting, maintenance tickets, AI chatbot as a dependency, professional multi-user platform features.

### Rentino

Relevant patterns:
- apartment-centric payment history;
- rent plus additional charges in one monthly context;
- lightweight tenant/rental summary;
- simple sharing of monthly costs.

**Adopt:** apartment-level monthly overview and fixed/variable related charges.

**Optional later:** native sharing of a compact monthly summary.

**Do not adopt now:** tenant communication as a product module.

### Landlord Studio

Relevant patterns:
- property-linked reminders;
- recurring reminders;
- dashboard access to reminders;
- clear paid/partial/outstanding financial state;
- property-level reporting.

**Adopt:** one-time/monthly/yearly personal reminders, optional property association, clear partial vs confirmed state, compact trend chart. All three reminder cadences are implemented; keep them small and subordinate to rent confirmation, tax calculation and deadlines.

**Do not adopt:** payment processing, bank feeds, US-specific tax/accounting workflows or large reporting surface.

## Product decisions derived from those patterns

1. **Pulpit is action-first.** Tasks requiring attention appear before charts.
2. **Most tasks are derived.** Expected rent, tax, bills and agreement dates generate tasks; users should not recreate them manually every month.
3. **Guided setup is temporary.** It configures only essential facts and disappears once required setup is complete.
4. **Expected vs actual are separate.** Expected rent drives a check task; actual manually confirmed receipts drive income and tax.
5. **Partial receipts are first-class.** Remaining amount changes the same task rather than creating unrelated reminders.
6. **Rent expectations need history.** A new rent amount must not alter previous months.
7. **Bills have two useful modes.** Fixed = known expected amount; variable = remind user to verify amount, usually via a portal.
8. **Custom reminders stay deliberately small.** One-time, monthly and yearly reminders with optional apartment are implemented. Avoid expanding into a generic task-management feature set without explicit user demand.
9. **External links are a shortcut, not integration.** Open administration/utility/tax services without scraping credentials or treating navigation as completion.
10. **Statistics stay light.** Confirmed income, remaining amount to check, outstanding tax, attention count, short monthly trend and apartment split.

## Design inspiration boundary

It is acceptable to learn from:
- hierarchy;
- familiar card patterns;
- bottom navigation;
- status labels;
- contextual actions;
- onboarding sequence;
- reminder cadence;
- separation of summary and detail.

Do not copy:
- exact screen compositions;
- proprietary wording;
- iconography/brand assets;
- screenshots or visual trade dress;
- competitor-specific information architecture where it conflicts with our smaller scope.

When there is a choice, prefer the shortest flow that preserves manual confirmation and local-first operation.

## Feature filter for future ideas

Before adding a competitor feature, ask:

1. Does it help the user **remember, check or complete** a private-rental responsibility?
2. Can it remain local-first without introducing a backend?
3. Does it reuse existing apartment/income/tax/task facts rather than creating a parallel system?
4. Can the everyday flow remain simpler after adding it?
5. Is there evidence the pattern is useful, rather than merely available in another product?

If several answers are no, park the feature.
