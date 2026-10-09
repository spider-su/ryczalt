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
