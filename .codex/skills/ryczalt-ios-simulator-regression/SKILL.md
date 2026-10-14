---
name: ryczalt-ios-simulator-regression
description: Validate the Ryczałt rental app on an iOS Simulator using a fresh Expo native build, protecting local data and testing core rental/tax flows.
---

# Ryczałt iOS Simulator regression

1. Require macOS with Xcode and an available iOS Simulator runtime. Check `xcodebuild -version` and `xcrun simctl list devices available`. On other hosts mark BLOCKED, not PASS.
2. Record branch, commit, working-tree status, Xcode version, simulator model, iOS version and UDID. Confirm the UDID belongs to a simulator; never operate on a physical device.
3. Preserve all existing simulator app data. Do not erase, uninstall, clear storage or delete encryption keys without explicit authorization. Use a fresh, dedicated simulator or test-only identity and synthetic rental data.
4. Run `npm ci`, `npm run ci`, and `npx expo-doctor`; record failures.
5. Build from the current checkout with `npx expo run:ios --device <SIMULATOR_UDID>`. Do not treat Expo Go or an old .app as a fresh native build.
6. Check startup, Pulpit, Income, Tax and Settings navigation, safe areas, keyboard behavior, dark/light mode and large text.
7. Using synthetic data only, add an apartment and tenant, configure owner rent/media, confirm a rent payment, verify tax calculation and payment status. Check reminders and permission-denied UI as supported. Never mark an expected payment as received automatically.
8. Restart the app and verify persistence. Where a disposable test fixture is available, exercise backup/restore and recovery; never reset a real user document.
9. Capture dated screenshots with `xcrun simctl io <UDID> screenshot <path>`, collect logs and report PASS/FAIL/SKIPPED/BLOCKED per case with commit and simulator details.
10. Restore changed settings and report limits. Simulator evidence does not establish physical-iPhone notifications, TestFlight, signing or App Store readiness.
