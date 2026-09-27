# Changelog

This file records delivered code on the current branch. Physical-device behavior and public releases are tracked separately.

## Unreleased

- Use generic local-notification display text to avoid exposing personal or financial details on the lock screen; reject malformed notification routes safely.
- Cover global notification switches, lock-screen wording and invalid deep-link payloads with regression tests.
- Add dedicated Android debug-assemble and EAS Android build workflows; document verified Expo identity and Android beta checklist.

### Stabilization and regression coverage

- Honored per-apartment rent and bill notification switches while retaining the underlying in-app tasks.
- Added populated v1/v2 migration fixtures, a v3 round-trip fixture, assistant workflow regressions, and testable notification-intent mapping.
- Added Expo Doctor, Web export and Android prebuild checks to CI for relevant PRs and pushes to `develop` and `main`.
- Split property editing/listing, recurring-bill listing, income history rows, Pulpit task rows and shared payment details into focused components.

### Previously delivered assistant MVP

- Added the four-tab app, tax calculation/payment tracking, effective-dated rent expectations, recurring bills, property links and one-time custom reminders.
- Added the task projection, snooze/dismiss/completion state, native local-notification reconciliation and compact Pulpit statistics.
- Migrated the persisted rental document to schema version 3 without dropping confirmed histories.

### Documentation

- Reframed the target product as a local-first personal landlord assistant.
- Defined canonical user flows, technical/data/task architecture, proposed roadmap and release gates.
- Clarified implemented capabilities, planned setup/recurrent-reminder work and parked product scope.
- Added competitive-pattern guidance so proven landlord workflows can be adapted without copying competitor UI or expanding into full property management.
- Added a Codex implementation guide covering product invariants, source-of-truth rules, task/notification architecture, scope guardrails and expected validation.

The merged implementation is on `develop`; this does not establish that a public binary or app release exists.
