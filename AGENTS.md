# Ryczałt agent instructions

This is the Ryczałt rental-management app, not the generic mobile template.

## Product invariants
- Preserve rental/tax calculations, local-only data ownership, manual payment confirmation and offline behavior.
- Do not change persisted rental document schema, encryption key IDs, encrypted value prefix, backup or recovery behavior without a dedicated migration and regression plan.
- Existing persistence uses AsyncStorage plus AES-GCM and Expo SecureStore on native devices. Never replace it with unencrypted generic template storage.
- Never reset user data, clear storage, or remove encryption keys as part of routine debugging.
- Preserve demo-mode isolation and serialized mutation ordering.
- Keep native and web differences explicit, and retain Polish user-facing copy.

## Workflow
- Read relevant domain tests and docs before editing.
- Prefer focused changes with regression tests and no unrelated UI redesign.
- Run `npm ci`, `npm run ci`, and `npx expo-doctor` where tooling is available.
- Validate changes against existing local-data recovery and emulator test plans.
- Record exact test results and any unverified device/platform behavior.
- Do not claim an APK build is an emulator or physical-device test.
- Do not commit credentials, local paths, private data or signing material.

## Codex
See `.codex/SKILLS.md` for existing project-specific build and emulator skills plus generic quality checks.
