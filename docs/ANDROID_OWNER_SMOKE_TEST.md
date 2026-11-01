# Owner-reported Android smoke test

**Recorded:** 2026-11-01  
**Evidence type:** Owner report (not a CI or independent device-test result).

The owner confirms that an Android build of **each** of these three independent applications was previously installed successfully on a physical Android device and that its primary end-to-end user flow was completed:

- `spider-su/ryczalt` — private rental income and tax assistant (NOT `ryczalt_it`).
- `spider-su/world-maps` — geography learning and quiz application.
- `spider-su/rescue-team` — rescue puzzle game.

**Status:** historical smoke test PASSED, exact APK SHA/version/device/date not captured. Subsequent commits are **not** covered by this evidence.

## Release candidate verification still required

- [ ] Identify candidate commit SHA, version, package ID, device and Android version.
- [ ] Install signed candidate and verify its primary end-to-end flow.
- [ ] Verify updating an earlier installation preserves user data/progress.
- [ ] Check offline operation, permissions, accessibility and crash-free startup.
- [ ] Verify store AAB and signing configuration, current CI and applicable privacy/terms/store disclosures.
- [ ] Record test date, tester, build artifact and outcomes in release notes.

This record supersedes earlier wording suggesting that **no physical Android test had ever been performed**. It does not supersede later release-specific test gates.
