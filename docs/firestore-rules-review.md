# Firestore rules draft — review before use

The currently published rules shared for review are:

```rules
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

This branch preserves that existing `users` rule to reduce compatibility risk and adds a restricted `bookingRequests` rule. The current user rule is still broad: a user can edit their own role and verification-related fields. Review and tighten that separately after the full patient/nurse onboarding flow is designed.

**This file is not published to Firebase.** GitHub cannot change the live Firestore rules unless the user explicitly publishes them in Firebase Console or deploys with Firebase CLI.

## What the booking rule aims to enforce
- Only an authenticated user can create a booking for their own UID.
- Only known service names and a fixed set of fields are accepted.
- New bookings must start with `status: "pending"` and no nurse assigned.
- Clients cannot update/delete bookings; nurse assignment and status transitions need a trusted workflow.
- A patient or assigned nurse can read their own booking. Patient history queries must filter by `patientUid == request.auth.uid`; Firestore rules are not filters.

## Before publishing
1. Keep a copy of the currently published rules for rollback.
2. Test in Firebase Emulator Suite or Rules Playground, including patient create, missing fields, other user's UID, unexpected fields, fake nurse assignment, status tampering, cross-user reads, and profile completion.
3. Check all existing app pages and all Firestore collections. Unmatched collections are denied by default and may affect features not yet reviewed.
4. Confirm that profile creation and completion continue to work with the preserved `users` rule.
5. Publish only after tests pass and a rollback path is available.

## Booking document schema
`bookingRequests/{requestId}` receives `patientUid`, `patientName`, `patientPhone`, `patientAddress`, `serviceName`, `scheduledAt` (timestamp), `area`, `notes`, null nurse fields, `status: "pending"`, `bookingSource: "github-pages"`, `createdAt`, and `updatedAt`.

WhatsApp Cloud API and Cloud Functions are not deployed or enabled by this rules draft.
