# Owner-confirmed Android APK smoke test — 2026-11-02

## Result

**PASS — owner-reported:** The owner confirmed on 2026-11-02 that they were able to install an APK of **Ryczałt** on Android and successfully complete happy-path scenarios.

This is an actual manual-use report, **not** an automated CI test or a verification performed by the maintainer of this document. The report does not identify the APK checksum, Git commit, version code, Android device model/version, exact original execution time, or individual screens tested.

| Gate | Status | Evidence / limitation |
| --- | --- | --- |
| Android APK installation | **PASS (owner report)** | Installed successfully on Android |
| Launch and happy-path usage | **PASS (owner report)** | Main user scenarios completed successfully; exact scenarios not enumerated |
| Full feature/regression testing | **NOT VERIFIED** | No comprehensive scenario-by-scenario report provided |
| Signed release AAB generated and verified | **COMPLETE (owner report, 2026-11-02)** | Owner confirms generation and validation; exact bundle checksum/CI evidence not supplied in this report |
| AAB uploaded to Google Play closed-testing track | **COMPLETE (owner report, 2026-11-02)** | Owner confirms upload to the app's Play Console closed-testing track; release review/availability not independently verified |
| Installation and happy-path test of Play-distributed AAB | **NOT VERIFIED** | Earlier APK smoke test does not prove the Google Play-distributed build has been tested |
| Store listing and visual assets | **COMPLETE (owner report, 2026-11-02)** | Owner confirms all mandatory Play Console store listing / assets finished; no independent Console audit performed |
| Closed testing / minimum tester enrollment | **PENDING** | Closed-test AAB uploaded, but opt-in count and continuous 14-day enrollment not yet confirmed |
| Store approval / production release | **NOT VERIFIED** | Separate Google Play review and authorization |

## Follow-up before release

- Record the exact release candidate Git SHA, APK/AAB hash, version code, Android model/version and test date in the normal release checklist; signed AAB generation/verification and closed-track upload are owner-confirmed complete.
- Invite testers; confirm the release is available through the closed-test opt-in link, then verify installation/update-over-install and core functionality using the **exact candidate** distributed by Google Play.
- Verify app-specific data, privacy, signing and closed-testing gates. The Google Play store listing and visual assets are owner-confirmed complete; confirm there are no remaining Play Console warnings when submitting.


This note updates the project status without treating smoke-test success as proof that release approval is complete.
