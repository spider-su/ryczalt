# Changelog

This file records **delivered and verified changes**, not roadmap promises.

## Unreleased

### Personal landlord assistant MVP

- Added the Pulpit, unified persistent task projection, snooze/dismiss/complete states, and contextual quick actions.
- Added effective-month rent expectations, apartment links, custom reminders, monthly KPIs and a six-month confirmed-income chart.
- Reconciled native local notifications from the shared task projection; Web retains the in-app task list.
- Migrated the local document to schema version 3 while preserving prior rental and tax records.

### Documentation

- Reframed the target product as a local-first personal landlord assistant.
- Defined canonical user flows, technical/data/task architecture, proposed roadmap and release gates.
- Updated MVP, data-model, architecture and notification documentation to match the delivered application.
- Added competitive-pattern guidance so proven landlord workflows can be adapted without copying competitor UI or expanding into full property management.
- Added a Codex implementation guide covering product invariants, source-of-truth rules, task/notification architecture, scope guardrails and expected validation.

The MVP implementation is merged in PR #1. PR #3 aligns product documentation. No app version or release artifact is published by those merges.
