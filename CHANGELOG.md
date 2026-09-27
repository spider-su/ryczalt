# Changelog

This file records **delivered and verified changes**, not roadmap promises.

## Unreleased

### Added

- Added lightweight Pulpit setup guidance derived from real apartment configuration. It reuses the existing Settings editor, keeps tenant/agreement/portal data optional, and never creates financial records or enables reminders without the user's choice.

### Fixed

- Removed duplicate Pulpit declarations while preserving guided setup, dashboard sections and notification-permission messaging.
- Kept recurring-bill task periods through Pulpit and notification navigation and recorded that period separately from the actual payment date.
- Derived fixed recurring-bill completion from the exact sum of confirmed payments for that bill and month; variable bills still resolve on one explicit payment without an inferred expected amount.

### Documentation

- Reframed the target product as a local-first personal landlord assistant.
- Defined canonical user flows, technical/data/task architecture, proposed roadmap and release gates.
- Clarified current foundation versus planned tax, Pulpit and local-notification features.
- Added competitive-pattern guidance so proven landlord workflows can be adapted without copying competitor UI or expanding into full property management.
- Added a Codex implementation guide covering product invariants, source-of-truth rules, task/notification architecture, scope guardrails and expected validation.

PRs #5, #6, #7 and #8 delivered the assistant stabilization, native-readiness baseline, guided setup and promotion to `main`; PR #9 cleaned up duplicate guided-setup declarations on `develop`. No public app release is implied. Do not interpret proposed roadmap milestones as published versions.
