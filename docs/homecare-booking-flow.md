# Go-Homecare booking flow

## What this branch adds
- Adds `booking.html`, a mobile-first homecare request form using the existing Firebase project and Firebase Authentication session.
- Changes only the existing service-click handler in `patient.html` so a selected service opens the booking form.
- Keeps existing page markup, styles, and other JavaScript behavior intact.

## Firestore document contract
New requests are written to `bookingRequests/{autoId}` with:
- `patientUid`, `patientName`, `patientPhone`, `patientAddress`
- `serviceName`, `scheduledAt` (Firestore Timestamp), `area`, `notes`
- `nurseUid`, `nurseName`, `nursePhone` initially null because nurse assignment is not implemented yet
- `status: "pending"`, `bookingSource`, `createdAt`, `updatedAt`

This is aligned with the planned WhatsApp scaffold's `bookingRequests` collection and basic fields. WhatsApp notifications remain a separate later step and are not enabled by this branch.

## Before real use
1. Confirm Firestore rules allow only an authenticated patient to create a request for their own UID, validate allowed fields/status, and prevent clients from assigning themselves as nurses or setting notification state.
2. Add nurse assignment, patient booking history, and nurse/admin status workflows in later steps.
3. Test with a non-production account first. Do not enter urgent medical emergencies into this form.
4. Confirm privacy notice, consent wording, data retention, and operational handling before accepting real patient data.

## Manual smoke test
1. Sign in through `index.html` using a test account with `role: "pasien"` and `profileComplete: true`.
2. From `patient.html`, tap each service and verify the correct service is preselected in `booking.html`.
3. Submit a future date/time and test contact/address data.
4. Confirm one `bookingRequests` document appears with status `pending` and the current user's UID.
5. Test a signed-out session and a non-patient role; neither should be able to submit through the page.
6. If Firestore returns `permission-denied`, inspect the project's active Firestore rules before changing them. No rules are deployed or modified by this branch.
