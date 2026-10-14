# Agent architecture and reuse map

This document supplements `docs/CODEX_GUIDE.md`, `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md`. Source code and current tests are authoritative.

| Need | Existing location | Reuse rule |
|---|---|---|
| Rental document types | `src/model/rental.ts` | Preserve persisted schema; plan migrations explicitly |
| Rental calculations, rent allocation and tax | `src/domain/` | Extend pure domain functions and focused tests; no calculations hidden in screens |
| Local encrypted persistence and recovery | `src/data/localRentalStore.ts`, `secureLocalStorage.ts`, `rentalBackupFile.ts` | Preserve encryption, backup compatibility and serialized updates |
| Document context and mutations | `src/data/RentalDataProvider.tsx`, `persistRentalMutation.ts` | Use existing mutation ordering; no second state source |
| Dashboard and user tasks | `src/screens/PulpitScreen.tsx`, `src/components/pulpit/TaskRow.tsx`, `src/domain/tasks.ts` | Reuse derived tasks; never infer actual payment |
| Income | `src/screens/IncomeScreen.tsx`, `src/components/income/` | Use existing income records and domain rules |
| Tax | `src/screens/TaxScreen.tsx`, `src/domain/ryczaltTax.ts` | Keep tax logic centralized |
| UI and appearance | `src/theme/theme.tsx`, `src/theme/ui.ts`, `src/components/` | Reuse existing visual language; avoid copying generic template UI wholesale |
| Navigation and safe areas | `src/navigation/`, `src/navigation/safeAreaLayout.ts` | Respect existing inset and intent contracts |
| Reminders | `src/notifications/` | Preserve scheduling, permissions and deduplication |
| Resilience | `src/components/AppErrorBoundary.tsx`, `LoadingState.tsx` | Reuse UI patterns; handle async errors separately |
| Quality and device workflows | `.codex/skills/` | Run project-specific Android regression; iOS Simulator skill when macOS available |

## Agent task procedure

1. Read `AGENTS.md`, `docs/ENGINEERING_LEVEL.md`, `docs/CODEX_GUIDE.md` and only the domain documents relevant to the request.
2. Inspect the branch, current source and tests before planning. Avoid reimplementing existing features.
3. Find an existing component/domain function; prefer extending it over creating another abstraction.
4. Implement the smallest complete change with Polish user-facing copy and useful failure states.
5. Run `npm ci` as needed, `npm run ci`, and `npx expo-doctor` where available. Use Android/iOS skills for native behavior; report skipped checks.
6. Open a focused PR, document actual evidence and do not merge without approval.

## Scope of template propagation

Adopt **documentation conventions and optional testing skills** from the generic mobile template. Do not overwrite Ryczałt navigation, screens, styles, app identity, storage, encryption, notifications, tax logic, dependency versions or build scripts merely to match the template. Evaluate reusable code separately with regression evidence.
