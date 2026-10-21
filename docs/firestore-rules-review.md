# Firestore rules draft — review before use

This repository did not contain a checked-in Firestore rules file when reviewed. GitHub cannot tell us which rules are currently published in the Firebase Console. Therefore this file is a **draft only** and has not been published to Firebase.

## What this draft aims to protect
- A signed-in user can read their own `users/{uid}` profile.
- A user can create their own initial profile; subsequent profile updates cannot change their UID, role, or verification flag.
- A patient can create a booking only for their own UID, with an allowlisted service, pending status, null nurse assignment, and the expected field set.
- A patient can read their own booking; an assigned nurse can read a booking assigned to their UID.
- Clients cannot update/delete bookings or write WhatsApp notification state.

## Important compatibility warning
The app's other pages and future workflows may use additional collections not represented here. Because unmatched collections are denied, publishing these rules without checking the live database could break existing features. In particular, inspect the current Firebase Console rules and all reads/writes used by existing pages before publishing anything.

The existing profile page currently writes fields including `nama`, `phone`, `profileComplete`, `role`, `updatedAt`, patient profile fields, and practitioner profile fields. This draft permits owner updates to those fields as long as the UID, role, and existing verification flag stay unchanged. Role selection is still client-driven in the existing application; a production onboarding flow should review this separately.

## How to validate safely
1. In Firebase Console, open Firestore Database → Rules and copy/export the **currently published** rules to a safe backup.
2. Do not replace the live rules directly with this draft.
3. Test the draft in the Firebase Emulator Suite or Rules Playground against profile completion, patient booking creation, patient booking reads, cross-user reads, fake nurse assignment, status tampering, and access to existing collections.
4. Confirm every existing collection and user role workflow is covered.
5. Only publish after tests pass and a rollback copy is available.

## Booking contract
The booking form writes a document to `bookingRequests` with `patientUid`, `patientName`, `patientPhone`, `patientAddress`, `serviceName`, `scheduledAt`, `area`, `notes`, null nurse fields, `status: "pending"`, `bookingSource: "github-pages"`, `createdAt`, and `updatedAt`.

Cloud Functions/WhatsApp notifications are not deployed or enabled by this rules draft.
