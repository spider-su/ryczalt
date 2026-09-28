# Ryczałt project skills

Reusable Codex workflows for this repository live under `.codex/skills/`. Each skill has its own `SKILL.md` manifest and optional scripts/references; Codex discovers the skill directories directly. This file is a human-readable index, not a replacement for those manifests.

## Available workflows

- [Build standalone APK](skills/ryczalt-build-apk/SKILL.md): build the local Android release APK and replace `artifacts/app/ryczalt.apk` only after validation.
- [Android emulator regression](skills/ryczalt-emulator-regression/SKILL.md): build/install a fresh APK and run the fixed API 35 regression plan, with repeatable test data and evidence capture.

Keep project-specific commands and the detailed regression cases in each skill's supporting files so this index stays short and easy to scan.
