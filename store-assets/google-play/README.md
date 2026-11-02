# Google Play listing assets

This package contains existing product branding and genuine Android Emulator screenshots. No application screen was generated or reconstructed. This is a listing package, not proof of production release readiness.

## Files and validation

- `icon-512.png`: 512 × 512, RGBA PNG, ≤1 MiB.
- `feature-graphic-1024x500.png`: 1024 × 500, opaque RGB PNG, ≤15 MiB.
- `phone/phone-*.png`: 1080 × 1920, opaque RGB PNG, ≤8 MiB each, ordered for upload.
- `screenshots.json`: per-screen source SHA, APK hash/version/build, capture time, emulator, transformations and review.
- `validation.json`: exact image dimensions, byte sizes, hashes and copy character counts.
- `store-listing.md`: publication copy. `listing.json` is its editable generation source.

Run from the repository root with Python 3.9+ and Pillow 11.3.0:

```sh
python3 scripts/store_assets.py render
python3 scripts/store_assets.py validate
```

Render reuses the configured source icon/artwork. macOS Arial or Linux DejaVu fonts are supported; set `STORE_FONT` and `STORE_FONT_BOLD` for reproducible custom font paths. Existing artwork provenance and license notices remain in the source asset directories. Rendering is local; no image-generation service is used.

## Recapture

Use a dedicated API 35+ ARM64 emulator. Do not erase existing profiles or clear user data. Install the source-matched standalone APK, navigate the real app, dismiss transient messages, wait for loading/animations and check the foreground. Configure a native 1080 × 1920 display for the Expo apps. Rescue Team uses a documented crop of its 1080 × 2400 framebuffer to remove system bars and empty margins while retaining the complete 1080 × 1920 game surface.

```sh
python3 scripts/store_assets.py capture --serial EMULATOR_SERIAL \
  --apk /path/to/source.apk --source-sha FULL_APK_SOURCE_SHA \
  --build-url BUILD_EVIDENCE_URL --name 'Screen description'
```

Put ADB and aapt on PATH, or supply `--adb` and `--aapt`. The script refuses physical devices and a mismatching APK package, preserves raw captures under ignored `raw/`, and appends to the manifest. For a fresh capture set, archive the previous `phone/` and manifest together; do not mix screenshots from different sessions accidentally. Review each new image and set its `visual_review` to `pass` only after checking actual content. Raw files, APKs, emulator state and credentials are intentionally excluded from Git.

Automated validation checks image decoding, format, dimensions, size limits, near-blank images, duplicate screens, hashes, review status and copy limits. Human review additionally checks personal information, debug overlays, current branding and source-feature correspondence. Those semantic checks cannot be proven by Pillow statistics. All phone screenshots remain subject to final publisher inspection in Play Console.

## Manual upload

1. Open Play Console and select the app by its exact package ID (in `listing.json`).
2. Open **Grow users → Store presence → Main store listing** (some Console versions show **Store listings → Edit default listing**).
3. Select Polish (Poland) for Ryczałt or English (United States) for the games. Paste Title, Short description and Full description from `store-listing.md`.
4. In Graphics, upload `icon-512.png` as the app icon and `feature-graphic-1024x500.png` as the feature graphic.
5. Upload the files in `phone/` in numeric order under Phone screenshots. Use each manifest screen description as concise alt text; inspect previews and ordering.
6. Save the listing. Review Publishing overview and any Console validation messages. Submit changes for review only when the publisher has completed the separate release gates.

Do not upload the JSON, README, raw captures or GitHub artifact ZIP as listing images. Privacy policy URL, Data Safety, audience/content rating, app access, support details and the signed AAB/test track are separate Console tasks. Existing policy drafts must be completed against the actual release; listing assets do not resolve those gates.

Specifications checked against [Google Play preview asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) on 2026-11-02. This package uses 9:16 images to satisfy both the maximum 2:1 edge ratio and the recommended portrait format.

## Capture and checks

- Source: `a8646bc69bbfebc77a8700f0843fe6658355d798`; built locally with the existing `.codex/skills/ryczalt-build-apk/scripts/build_apk.sh` workflow. Output is the ignored `artifacts/app/ryczalt.apk`; do not upload the APK as an image or commit it.
- Standalone development-signed APK: version 0.1.0 / code 1, package `pl.ryczalt.rental`, target SDK 36, embedded JS bundle; build PASS, `apksigner` verification PASS, SHA-256 `51af5ecf03035f0e67caabd883f23940082a4864876e1b35127923cb520ee84f`. The initial build overlapped dependency installation and failed resolving Node packages; the subsequent completed build succeeded with no application changes.
- Emulator: dedicated `play-store-assets-api35`, serial `emulator-5560`, Pixel 7-equivalent ARM64, Android 15 / API 35, 1080 × 1920 override / 320 dpi, Polish system locale `pl-PL`, SwiftShader, no audible output. Capture date: 2026-11-02. System UI demo broadcasts clean the status bar.
- Five screenshots cover dashboard (including deadlines/pending actions), apartments, expanded confirmed-payment history, calculated tax/status and local-data information. All use the app's existing isolated demo; the demo banner remains visible. Names/addresses/amounts are built-in fictional fixtures from `src/data/demoRentalDocument.ts`, not user records. Local backup controls are intentionally disabled in demo.
- A separate reminders configuration screenshot is omitted: demo's notification settings expose a developer/test-notification panel, which must not appear in promotional assets. Reminder deadlines and pending actions are shown truthfully on the actual dashboard. No test notification was sent and no developer panel is included.
- Local `npm ci` and `npm run ci` PASS (35 files / 258 tests, typecheck, lint). `npx expo-doctor`: 19/21 PASS, 2 FAIL: locked Expo CLI 57.0.28 versus expected ^57.0.29; Expo 57.0.28 versus ~57.0.31 and expo-notifications 57.0.22 versus ~57.0.24. These pre-existing dependency compatibility checks are outside the image-only scope. No dependency or lockfile changes were made.
- Asset preparation does not complete the existing private-beta/production release gate. Privacy-policy completion, current release compatibility, real-device reminders, signing/release and store approval remain separate. The listing includes an informational tax disclaimer and does not claim bank integration, electronic filing or affiliation with tax authorities.

### Verified image inventory

| File | Dimensions | Bytes |
| --- | --- | ---: |
| `icon-512.png` | 512 × 512 | 258892 |
| `feature-graphic-1024x500.png` | 1024 × 500 | 127963 |
| `phone/phone-01.png` | 1080 × 1920 | 144983 |
| `phone/phone-02.png` | 1080 × 1920 | 95360 |
| `phone/phone-03.png` | 1080 × 1920 | 129387 |
| `phone/phone-04.png` | 1080 × 1920 | 114068 |
| `phone/phone-05.png` | 1080 × 1920 | 146228 |

Copy character counts: title: 25, short_description: 71, full_description: 1386.
