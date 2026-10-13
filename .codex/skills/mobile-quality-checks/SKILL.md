---
name: mobile-quality-checks
description: Run the Ryczałt mobile typecheck, lint, unit tests and Expo Doctor before proposing or merging changes.
---

# Ryczałt quality checks

1. Record branch, commit and working-tree status. Preserve uncommitted work.
2. Run `npm ci`, `npm run ci`, and `npx expo-doctor` from the repository root.
3. Review relevant domain and local persistence regression tests when changing data or UI state.
4. Report commands, failures and skipped checks explicitly; do not claim native runtime coverage from source checks.
5. For Android emulator testing use the existing `ryczalt-emulator-regression` skill, not a generic smoke test.
