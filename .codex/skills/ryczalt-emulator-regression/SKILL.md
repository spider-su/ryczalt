---
name: ryczalt-emulator-regression
description: Run the repeatable Android emulator smoke/regression plan for Ryczałt, covering safe areas, rent reconciliation, tax, settings, and persistence. Use when asked to run or repeat Ryczałt Android emulator testing; this is not a physical-device or notification-delivery test.
---

# Ryczałt Android emulator regression

Use the test plan in [references/regression-plan.md](references/regression-plan.md). It fixes the emulator profile, test data, verification points, and evidence layout to make runs comparable.

Workflow:

1. Confirm the repo root, requested branch/working tree, and current commit. Do not discard user changes.
2. Build a fresh standalone APK from that checkout using `./.codex/skills/ryczalt-build-apk/scripts/build_apk.sh "$PWD"`; this ensures the tested binary contains the current source. If the helper is missing, do not silently substitute a stale APK or debug/Metro build.
3. Confirm `ryczalt-api35` is booted and is an Android emulator (`ro.kernel.qemu=1`), at 320×640 / 160 dpi, API 35. Use its current ADB serial; do not hardcode `emulator-5554` if it differs.
4. Only after verifying the target is an emulator, install the artifact and clear this app's local app data to reset the fixture. Launch with explicit `adb shell am start -W -n pl.ryczalt.rental/.MainActivity` rather than relying on launcher timing. Never run `pm clear`, reset app data, or change device time on a physical device.
5. Execute every required step in the reference plan, capture evidence, and report pass/fail per case with commit, APK SHA-256, Android/API, serial/model, and date. Record skips explicitly.
6. Preserve the emulator's system clock and OS-wide settings. Do not change notifications permission, animation settings, or navigation mode unless specifically testing them; restore any state changed for an explicitly requested optional test.

The run is a visual/manual emulator regression: inspect screenshots and UI hierarchy where useful, not just successful installation or process launch. On failure, keep the evidence and stop before destructive recovery/reset steps. Do not change app code during test execution unless the user asked to fix failures.
