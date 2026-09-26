# Release policy

## Distinguish three things

- **Roadmap milestone:** intended capability; not evidence of shipping.
- **App version:** value in package/app config for a particular build.
- **Git tag / GitHub release:** an explicitly published software revision with notes and artifacts as applicable.

Current inspected branch declares version `0.1.0`; this does **not** prove a public release exists. Proposed milestone numbers in [ROADMAP](ROADMAP.md) are provisional until checked against actual tags/releases. Never silently bump app version as part of a docs-only PR.

## Release flow

1. Merge reviewed implementation and documentation changes to the agreed release branch; keep docs-only PRs separate from code.
2. Verify business acceptance against [MVP](MVP.md) and [USER_FLOWS](USER_FLOWS.md).
3. Run `npm ci`, `npm run ci`, `npx expo-doctor`; check Expo Web and Android prebuild/build as supported.
4. Test migration from previous real local-document fixtures, including corruption/unsupported-version handling and concurrent updates.
5. On physical devices, verify permission denied/granted, task persistence, notification scheduling/cancellation/tap navigation, DST/timezone and app restart. Do not claim native verification from mocks alone.
6. Verify exact tax examples, partial/corrected payments, user-visible wording and privacy. Confirm payment details and QR compatibility before advertising QR support.
7. Confirm standalone Expo/EAS ownership, project ID and signing; do not reuse `ryczalt_it` credentials or IDs. Prepare Android/iOS distribution separately.
8. Update `CHANGELOG.md`, release notes, supported platforms and known limitations; only then tag/publish a release.

## Local-data safety

Document every schema change and migration path. No silent reset or loss of confirmed receipts/tax payments. A rollback to an older build may not understand newer data: test compatibility or state the limitation. Backup/import/export remains deferred and must not be implied by release notes.

## Documentation discipline

`PRODUCT` = vision; `MVP` = acceptance scope; `ROADMAP` = planned work; `CHANGELOG` = delivered work; release notes = one published revision. Keep these consistent and mark incomplete features as planned.