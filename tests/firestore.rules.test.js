const { readFileSync } = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require("@firebase/rules-unit-testing");
const {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} = require("firebase/firestore");

const projectId = "gocare-c94bc";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8")
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "patient-1"), {
      uid: "patient-1",
      role: "pasien",
      profileComplete: true,
      nama: "Pasien Uji"
    });
    await setDoc(doc(db, "users", "patient-incomplete"), {
      uid: "patient-incomplete",
      role: "pasien",
      profileComplete: false
    });
    await setDoc(doc(db, "users", "nurse-1"), {
      uid: "nurse-1",
      role: "praktisi",
      profileComplete: true
    });
    await setDoc(doc(db, "bookingRequests", "existing-patient-1"), {
      patientUid: "patient-1",
      nurseUid: null,
      status: "pending"
    });
    await setDoc(doc(db, "bookingRequests", "existing-other-patient"), {
      patientUid: "patient-2",
      nurseUid: null,
      status: "pending"
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

function validBooking(overrides = {}) {
  return {
    patientUid: "patient-1",
    patientName: "Pasien Uji",
    patientPhone: "628123456789",
    patientAddress: "Alamat Uji, Palangka Raya",
    serviceName: "Rawat Luka",
    scheduledAt: Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)),
    area: "Palangka Raya",
    notes: "",
    nurseUid: null,
    nurseName: null,
    nursePhone: null,
    status: "pending",
    bookingSource: "github-pages",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

test("complete signed-in patient can create a pending booking for own UID", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(setDoc(
    doc(collection(db, "bookingRequests"), "new-valid-booking"),
    validBooking()
  ));
});

test("signed-out visitor cannot create a booking", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "anonymous-booking"),
    validBooking()
  ));
});

test("patient cannot create a booking under another user's UID", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "spoofed-booking"),
    validBooking({ patientUid: "patient-2" })
  ));
});

test("incomplete patient profile cannot create a booking", async () => {
  const db = testEnv.authenticatedContext("patient-incomplete").firestore();
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "incomplete-profile-booking"),
    validBooking({ patientUid: "patient-incomplete" })
  ));
});

test("practitioner cannot create a patient booking", async () => {
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "nurse-created-booking"),
    validBooking({ patientUid: "nurse-1" })
  ));
});

test("client cannot create a booking with nurse pre-assigned or status changed", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "fake-nurse-booking"),
    validBooking({ nurseUid: "nurse-1", nurseName: "Perawat", nursePhone: "628123456789" })
  ));
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "accepted-on-create"),
    validBooking({ status: "accepted" })
  ));
});

test("client cannot add unexpected fields or edit/delete a booking", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(setDoc(
    doc(collection(db, "bookingRequests"), "unexpected-field-booking"),
    validBooking({ isAdmin: true })
  ));
  await assertFails(updateDoc(doc(db, "bookingRequests", "existing-patient-1"), {
    status: "accepted"
  }));
  await assertFails(deleteDoc(doc(db, "bookingRequests", "existing-patient-1")));
});

test("patient cannot read another patient's booking", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(getDoc(doc(db, "bookingRequests", "existing-other-patient")));
});

test("patient booking query must be scoped to that patient's UID", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(getDocs(query(
    collection(db, "bookingRequests"),
    where("patientUid", "==", "patient-1")
  )));
  await assertFails(getDocs(collection(db, "bookingRequests")));
});
