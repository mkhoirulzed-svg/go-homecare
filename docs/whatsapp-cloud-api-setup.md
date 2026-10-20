# Go-Homecare — WhatsApp Cloud API setup

## Current deployment arrangement

- Frontend: GitHub Pages (static HTML).
- Firebase project detected in `index.html`: `gocare-c94bc`.
- Firebase Authentication and Firestore are already used by the frontend.
- This branch adds a separate Cloud Functions backend scaffold. It does not edit the existing HTML pages.
- Functions are disabled by default. Do not enable them until the Meta templates and booking schema are verified.

## Billing implications

Firebase Cloud Functions deployment requires the Firebase project to be on the Blaze pay-as-you-go plan with a linked Cloud Billing account. Check Firebase Console → Project settings / Usage and billing before deploying. Set a budget alert; alerts are not hard spending caps. Cloud Functions has a no-cost usage tier on Blaze, but other build/storage/network services may still create small charges.

GitHub Pages can continue serving the frontend. Deploy backend functions separately with Firebase CLI using `firebase deploy --only functions`; this does not deploy or replace the GitHub Pages site.

## Meta setup checklist

1. Create/select a Meta app and WhatsApp Business Account in Meta for Developers.
2. Configure a business sender phone number and note the Phone Number ID.
3. Create and get approval for these Indonesian-language message templates. The variable order must match the code:
   - `ghc_booking_request_nurse`: {{1}} patient name, {{2}} service, {{3}} requested time, {{4}} area.
   - `ghc_booking_received_patient`: {{1}} patient name, {{2}} service, {{3}} requested time, {{4}} nurse name.
   - `ghc_booking_status_patient`: {{1}} patient name, {{2}} service, {{3}} status label, {{4}} nurse name.
4. Confirm the currently supported Graph API version in Meta's official docs/dashboard.
5. Ensure recipients have provided their phone number and appropriate consent to receive service-related WhatsApp notifications.

## Configure secrets and parameters

Install Firebase CLI locally, sign in, then run from the repository root:

```bash
npm install -g firebase-tools
firebase login
firebase use gocare-c94bc
cd functions
npm install
cd ..
```

Set secrets using Firebase CLI prompts; do not commit secret values:

```bash
firebase functions:secrets:set WA_ACCESS_TOKEN
firebase functions:secrets:set WA_PHONE_NUMBER_ID
firebase functions:secrets:set WA_GRAPH_API_VERSION
```

Set the boolean parameter to enable notifications only after completing the setup:

```bash
firebase functions:params:set WA_NOTIFICATIONS_ENABLED
```

If the installed Firebase CLI does not support setting a parameter interactively, follow its current parameter configuration prompt during deployment. Keep the value `false` until the test phase is complete.

Then deploy only functions:

```bash
firebase deploy --only functions
```

## Booking data contract required by the scaffold

The current patient page still uses a demo alert when a service is tapped. It does not create a Firestore booking. Before turning on the triggers, implement and test a real booking form that writes to:

`bookingRequests/{requestId}`

Expected fields:

- `patientUid`, `patientName`, `patientPhone`
- `nurseUid`, `nurseName`, `nursePhone`
- `serviceName`, `scheduledAt`, `area`
- `status`: `pending`, then `accepted`, `rejected`, or `cancelled`
- `createdAt`, `updatedAt`

Do not put sensitive clinical details in WhatsApp notifications. Keep clinical and address details in authenticated application views and restrict Firestore access with security rules.

## Important before production

- Review and deploy Firestore security rules. This repository currently does not include a checked-in `firestore.rules` file.
- Confirm phone numbers use international format, e.g. Indonesia country code 62 without a leading plus sign or local leading zero.
- Confirm template names, language codes, and variable order match approved Meta templates exactly.
- The scaffold's notification event marker is a starting point, not a guarantee of exactly-once delivery. Test retry behavior and build a robust outbox/idempotency strategy before real users depend on it.
- Verify status updates can only be made by the authorized patient, assigned nurse, or admin.
- Test API failure, invalid numbers, missing template approval, duplicate Firestore events, and recipients who have not consented.
- Never put WhatsApp access tokens or Meta app secrets in `index.html`, `patient.html`, public environment variables, or Git commits.
