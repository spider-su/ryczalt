# Owner-confirmed Android APK smoke test — 2026-11-02

## Result

**PASS — owner-reported:** The owner confirmed on 2026-11-02 that they were able to install an APK of **Ryczałt** on Android and successfully complete happy-path scenarios.

This is an actual manual-use report, **not** an automated CI test or a verification performed by the maintainer of this document. The report does not identify the APK checksum, Git commit, version code, Android device model/version, exact original execution time, or individual screens tested.

| Gate | Status | Evidence / limitation |
| --- | --- | --- |
| Android APK installation | **PASS (owner report)** | Installed successfully on Android |
| Launch and happy-path usage | **PASS (owner report)** | Main user scenarios completed successfully; exact scenarios not enumerated |
| Full feature/regression testing | **NOT VERIFIED** | No comprehensive scenario-by-scenario report provided |
| Exact signed Google Play AAB tested | **NOT VERIFIED** | APK test does not establish release AAB compatibility |
| Closed testing / minimum tester enrollment | **NOT VERIFIED** | Separate Play Console track and tester evidence required |
| Store approval / production release | **NOT VERIFIED** | Separate Google Play review and authorization |

## Follow-up before release

- Record the exact release candidate Git SHA, APK/AAB hash, version code, Android model/version and test date in the normal release checklist.
- Verify installation/update-over-install and core functionality using the **exact candidate** uploaded to Google Play.
- Complete app-specific data, privacy, signing, Google Play listing and closed-testing gates.


This note updates the project status without treating smoke-test success as proof that release approval is complete.
