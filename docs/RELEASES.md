# Release policy

## Distinguish three things

- **Roadmap milestone:** intended capability; not evidence of shipping.
- **App version:** value in package/app config for a particular build.
- **Git tag / GitHub release:** an explicitly published software revision with notes and artifacts as applicable.

Current inspected branch declares version `0.1.0`; this does **not** prove a public release exists. Proposed milestone numbers in [ROADMAP](ROADMAP.md) are provisional until checked against actual tags/releases. Never silently bump app version as part of a docs-only PR.

## Current readiness

The assistant stabilization (PR #5), native-readiness baseline (PR #6) and guided setup (PR #7) are merged. PR #8 promoted that assistant MVP line to `main`; `develop` also contains the follow-up Pulpit duplicate cleanup from PR #9. The current work repairs `main` CI and bill-payment correctness before the next feature milestone. Standard CI covers typecheck, lint, unit/domain tests, Expo Doctor, Web export and Android prebuild. A separate workflow assembles Android debug builds on demand and for PR changes affecting app/native configuration. EAS builds run on `develop` (preview) and `main` (production profile); neither workflow publishes to stores. Physical-device notification delivery, taps, timezone/DST and reboot behavior remain unverified. Signing and distribution preparation also remain 0.5 work. See [the Android checklist](PRIVATE_BETA_ANDROID_CHECKLIST.md). Guided setup is implemented. Recurring custom reminders (one-time, monthly or yearly) and QR payments are not implemented; PIT-28, backup/import/export and Investory integration remain parked.

On 2026-09-27, `npm audit` and `npm audit --omit=dev` each reported 11 moderate advisories in Expo CLI/config and the `@expo/config-plugins` → `xcode` → `uuid` chain. npm's automatic suggestion is a breaking Expo downgrade; no force fix was applied. These findings are in the Expo build/config dependency tree, not a package imported directly by application features. Re-evaluate with a compatible Expo SDK/toolchain update.

## Verified Android baseline

The app uses Expo SDK 57 / React Native 0.86.3. The successful local Android build used JDK 17; the initial native CMake failure was reproduced with JDK 25 and went away under JDK 17, so it was a local Java/toolchain mismatch rather than a source or native dependency defect. Expo's SDK 57 Android build image uses JDK 17 and NDK r27b. This machine's installed SDK used Android Platform 36, Build Tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1; the generated Gradle wrapper is Gradle 9.3.1. Generated native files are ignored and must be recreated with Expo prebuild. The Android-native workflow pins the same JDK/SDK/NDK/CMake set.

Reproduce locally after installing those SDK packages and setting `JAVA_HOME` to JDK 17 and both `ANDROID_HOME` / `ANDROID_SDK_ROOT` to the Android SDK root:

```sh
npx expo prebuild --clean --platform android
cd android
./gradlew --no-daemon clean assembleDebug
```

The clean debug APK is produced at `android/app/build/outputs/apk/debug/app-debug.apk`. On the inspected Mac these variables pointed at the local JDK 17 and `/opt/homebrew/share/android-commandlinetools`; do not copy that host-specific SDK path into project config.

EAS identity was checked against the authenticated Expo account on 2026-09-27: owner `smart-box`, project `@smart-box/ryczalt`, ID `90116624-70fc-4f49-92f7-e787344dc969`, package and bundle ID `pl.ryczalt.rental`. Expo account access showed this project under `smart-box`; the separate project ID is not the parent `ryczalt_it` ID. The repository's `EXPO_TOKEN` secret exists. App-store credentials and a distribution release have not been verified or created.

The lightweight privacy review found app records stored in AsyncStorage, no analytics SDK or backend/sync client in the app dependency/source tree, and outbound navigation opening the saved/selected URL without appending tenant or financial fields. AsyncStorage is app-local storage and the app does not add encryption at rest. Notification lock-screen text is now generic; notification payloads retain only local navigation context. This source/config review is not a device/network traffic audit.

## Release flow

1. Merge reviewed implementation and documentation changes to the agreed release branch; keep docs-only PRs separate from code.
2. Verify business acceptance against [MVP](MVP.md) and [USER_FLOWS](USER_FLOWS.md).
3. Run `npm ci`, `npm run ci`, `npx expo-doctor`, Web export, clean Android prebuild and `./gradlew clean assembleDebug` using JDK 17 and the toolchain above.
4. Test migration from previous real local-document fixtures, including corruption/unsupported-version handling and concurrent updates.
5. On physical devices, verify permission denied/granted, task persistence, notification scheduling/cancellation/tap navigation, DST/timezone and app restart. Do not claim native verification from mocks alone.
6. Verify exact tax examples, partial/corrected payments, user-visible wording and privacy. Confirm payment details and QR compatibility before advertising QR support.
7. Confirm standalone Expo/EAS identity (already verified above) and separately prepare Android/iOS signing and distribution. Never reuse the `ryczalt_it` project ID or signing credentials.
8. Update `CHANGELOG.md`, release notes, supported platforms and known limitations; only then tag/publish a release.

## Local-data safety

Document every schema change and migration path. No silent reset or loss of confirmed receipts/tax payments. A rollback to an older build may not understand newer data: test compatibility or state the limitation. Backup/import/export remains deferred and must not be implied by release notes.

## Documentation discipline

`PRODUCT` = vision; `MVP` = acceptance scope; `ROADMAP` = planned work; `CHANGELOG` = delivered work; release notes = one published revision. Keep these consistent and mark incomplete features as planned.
