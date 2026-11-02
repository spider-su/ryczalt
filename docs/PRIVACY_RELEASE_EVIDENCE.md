# Privacy and store evidence — release gate

Do not mark complete until evidence is tied to an exact release SHA and Android/iOS build. This checklist is a working record, not a completed store declaration.

## Current app data map

| Data | Purpose | Storage / transfer | User control |
| --- | --- | --- | --- |
| Apartment address, tenant name/phone/email, lease and rental terms | Local rental register and reminders | Encrypted native app document; no app backend. Browser storage on Web is not encrypted by this change. | Edit/delete apartment; reset local data; JSON export/import |
| Rent receipts, tax amounts/payments and calculation snapshots | Ledger and informational calculations | Same local document; no app backend | Edit/delete records; reset; JSON export/import |
| Reminder settings and task state | Local reminder planning | Same local document; local notifications only | Change settings; disable reminders; reset |
| Notification content | Remind user of due items | OS local notification; generic text without tenant/address/amount | OS permission and notification settings |
| JSON backup | User-directed portability | Plain JSON passed to system document picker/share destination; app does not choose destination | User chooses export/import file and destination |
| Account, precise location, contacts permission, analytics, advertising ID | Not requested/collected by the app code in this release | None identified in app code; re-check exact build and SDK manifests | N/A |

## Required evidence before submission

- [ ] Fill publisher/controller identity, contact, policy URL, version and effective date in `PRIVACY_POLICY.md`; publish the policy at a stable public URL.
- [ ] Review the policy against exact Android and iOS release builds, generated manifests, entitlements, SDK inventory and permission prompts.
- [ ] Confirm whether the applicable store questionnaire treats user-entered tenant data as collected/shared under its definitions; document rationale for each answer instead of assuming “on-device” means “not collected.”
- [ ] Complete Google Play Data safety and Apple App Privacy answers for the same builds; attach dated copies/export and reviewer sign-off.
- [ ] Capture in-app disclosure and user-control screens, and confirm notification lock-screen copy contains no personal details.
- [ ] Record release SHA, version, Android build ID/artifact hash, iOS build ID if applicable, policy revision, completed forms, reviewer and date.
- [ ] Re-run this review whenever dependencies, permissions, SDKs, storage, export/share behavior, notifications, or network calls change.

## Candidate record

| Field | Value |
| --- | --- |
| Commit SHA | [pending] |
| Android artifact / build ID | [pending] |
| iOS artifact / build ID | [pending / not in scope] |
| Public privacy policy URL and revision | [pending] |
| Google Play declaration evidence | [pending] |
| Apple App Privacy evidence | [pending] |
| Reviewer and date | [pending] |

## Storage security behavior

Native Android/iOS local document and recovery copy use AES-256-GCM with a random per-install key held in SecureStore/Keychain/Keystore. Existing valid plaintext documents are encrypted on first successful load. Invalid or unsupported data is not overwritten. The JSON export intentionally remains portable plaintext. Android system backup is disabled because a restored ciphertext without its device-bound key is not recoverable. Web storage remains browser-managed and unencrypted. Key loss or invalid ciphertext requires restore from the user's JSON export; there is no server recovery.

## Publication handoff (2026-11-01)

The existing [Polish privacy policy draft](PRIVACY_POLICY.md) is the **single policy source** for the rental app; do not create a second privacy policy. Resolve its bracketed legal-identity, postal/contact, URL and effective-date fields using verified publisher details. Confirm the actual candidate's dependencies, native manifests and data flows before completing Play Data safety. Review whether public support/contact, informational tax disclaimer and user-facing terms are appropriate. Already present: MIT code license; preserve dependency copyright and third-party notices. Owner-reported historical Android installation/E2E passes the initial smoke milestone, **not** these privacy/store gates.

## Google Play App content — declaration worksheet (2026-11-02, draft)

This section prepares **answers**, not a submitted Google Play declaration. The exact uploaded AAB, merged manifest, transitive SDKs and Play SDK Index must be checked before pressing Save.

| Play Console item | Proposed answer / action | Evidence or unresolved decision |
| --- | --- | --- |
| Privacy policy URL | **Pending:** publish the existing [Polish privacy policy](PRIVACY_POLICY.md) as a public, read-only HTTPS page and link it in the app | Fill publisher legal name, address/contact, effective date; do not use a GitHub edit page or PDF as the store URL |
| Ads declaration | **No** for the documented build | No ad SDK or ad UI in the current dependency/config inventory; confirm production merged manifest and bundled SDKs |
| App access | **All functionality accessible without login** | Local-first rental assistant, demo available; no bank access or account |
| Target audience | **Proposed: 18+ only** | Financial/tax tool for adult private landlords; publisher must confirm intended audience before selecting ages |
| Content rating | **Complete questionnaire in Console** | Finance/utility app; no gameplay, gambling or user-generated public content documented; never infer a certified rating in advance |
| Data safety | **Candidate: no app-developer collection/sharing of entered rental records** | Local encrypted records, local notifications and user-directed plaintext JSON export. Validate SDK and OS/service processing against Google's definitions before selecting 'No data collected' |
| Account deletion | **Not applicable to this build** | No account registration exists; reassess if sync/accounts are added |

### Data Safety review details

- Users enter apartment/tenant contacts, rental amounts, tax payments and dates, stored locally in the encrypted native document. These are sensitive in context but **local processing is not automatically developer collection**; questionnaire answers depend on actual transfer off-device and SDK behavior.
- JSON export is plaintext and sent only to user-selected destinations; review whether any sharing behavior invokes the Play definition of transmission. The publisher does not receive these exports through an app server.
- Notifications require OS notification permissions and use generic texts; check exact final permissions.
- Android backup is disabled by configuration. Verify exact manifest, dependency telemetry, crashes and network endpoints against the signed AAB.
- Deletion: user can clear app storage/uninstall; exports must be deleted at user-selected destination by the user. No hosted user account/data currently exists.

### Console completion record

- [ ] Policy text approved and accessible from public HTTPS URL and inside app
- [ ] Verified publisher and support details entered
- [ ] Ads and access declarations submitted
- [ ] Publisher approved 18+ audience or documented revised selection
- [ ] Google content-rating questionnaire submitted and resulting rating recorded
- [ ] Data safety answers reviewed against exact AAB, submitted and copy retained
- [ ] Record app version, AAB SHA-256, review date and screenshots of saved declarations

References: https://support.google.com/googleplay/android-developer/answer/9859455 and https://support.google.com/googleplay/android-developer/answer/10144311
