---
name: ryczalt-build-apk
description: Build the Ryczałt Expo project as a standalone Android release APK and replace artifacts/app/ryczalt.apk after validation. Use when asked to build, refresh, or deliver the local Ryczałt APK; this does not publish or install it.
---

# Build standalone Ryczałt APK

Run from the Ryczałt repo root, or pass the repo root as the script's first argument:

```sh
/Users/alex/.codex/skills/ryczalt-build-apk/scripts/build_apk.sh [repo-root]
```

The helper regenerates Android native files from Expo config, builds `assembleRelease` locally, validates the APK and its package/signature, then atomically replaces `artifacts/app/ryczalt.apk`. It leaves the old artifact in place if any build or validation step fails. It never uploads or installs the APK.

Project-specific invariants:

- Expo project is `spider-su/ryczalt`, package/application ID `pl.ryczalt.rental`, Expo owner `smart-box`.
- Use JDK 17. Prefer the active JDK only if its actual version is 17; otherwise resolve a local JDK 17 (on macOS, `/usr/libexec/java_home -v 17`, or the known SDKMAN JDK under `/Users/alex/.sdkman/candidates/java/17.0.16-tem`). Do not try to build with JDK 25.
- Use the configured Android SDK from `ANDROID_SDK_ROOT`, `ANDROID_HOME`, or this machine's `/opt/homebrew/share/android-commandlinetools`; export both SDK variables for Gradle.
- The release build uses the generated local debug signing key and is for sideload/QA only, not Play Store distribution. Never create, overwrite, or reuse a production keystore as part of this task.
- Do not change app identity, Expo project ID, version, or build profiles to make the local build work.
- The APK output is a requested replaceable artifact. Do not add it to Git unless the user separately requests that.

After running, report build result, output path, file size, SHA-256, package ID, signer verification, and any omitted runtime/device verification. Do not describe a successful build as an emulator or device test.
