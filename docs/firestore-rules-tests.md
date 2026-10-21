# Local Firestore rules tests

These tests run against the local Firestore Emulator, not the live Firebase project. They do not deploy rules or change billing.

## Run locally
1. Install Node.js (LTS).
2. From the repository root run `npm install`.
3. Run `npm run test:rules`. The Firebase CLI starts the Firestore Emulator temporarily and runs the tests.

## Coverage
- Complete patient can create their own pending booking.
- Signed-out, incomplete-profile, practitioner, and UID-spoofing creates are denied.
- Client cannot pre-assign a nurse, create an accepted booking, add extra fields, edit/delete a booking, or read another patient's booking.
- Patient history queries must be constrained by their UID.

## Limitations
- These tests do not prove the live Firebase Console rules match this branch.
- The current `users` rule is preserved for compatibility and still allows a user to edit their own role. That is a known security gap to address before real launch.
- The booking rule intentionally denies client updates until a trusted nurse/admin status workflow exists.
- Review and test these rules before manually publishing them to the live project.
