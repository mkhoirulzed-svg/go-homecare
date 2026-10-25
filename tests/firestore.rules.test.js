const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
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
      profileComplete: true,
      isVerified: true,
      nama: "Praktisi Terverifikasi",
      phone: "628111111111"
    });
    await setDoc(doc(db, "users", "nurse-2"), {
      uid: "nurse-2",
      role: "praktisi",
      profileComplete: true,
      isVerified: false,
      nama: "Praktisi Belum Terverifikasi",
      phone: "628122222222"
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
    await setDoc(doc(db, "bookingRequests", "assigned-accepted"), validBooking({
      nurseUid: "nurse-1", nurseName: "Praktisi Terverifikasi",
      nursePhone: "628111111111", status: "accepted"
    }));
    await setDoc(doc(db, "bookingRequests", "assigned-in-progress"), validBooking({
      nurseUid: "nurse-1", nurseName: "Praktisi Terverifikasi",
      nursePhone: "628111111111", status: "in_progress"
    }));
    await setDoc(doc(db, "bookingRequests", "pending-for-operations"), validBooking());
  });
});

after(async () => {
  await testEnv.cleanup();
});

function validBooking(overrides = {}) {
  return {
    patientUid: "patient-1",
    bookerUid: "patient-1",
    bookerName: "Pasien Uji",
    bookingFor: "self",
    relationship: "Diri sendiri",
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

test("new practitioner can create own unverified profile but cannot self-verify", async () => {
  const db = testEnv.authenticatedContext("new-practitioner").firestore();
  await assertSucceeds(setDoc(doc(db, "users", "new-practitioner"), {
    uid: "new-practitioner",
    nama: "Praktisi Baru",
    email: "praktisi@example.test",
    foto: "",
    role: "praktisi",
    isVerified: false,
    profileComplete: false,
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(db, "users", "new-practitioner"), {
    isVerified: true,
    updatedAt: serverTimestamp()
  }));
});

test("user can check own practitioner application before one exists", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(getDoc(doc(db, "practitionerApplications", "patient-1")));
});

test("user cannot create a practitioner application for another UID", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(setDoc(doc(db, "practitionerApplications", "other-user"), {
    uid: "patient-1",
    nama: "Pengajuan palsu",
    email: "patient@example.test",
    phone: "628123456789",
    strNumber: "STR-TEST",
    experience: "1 tahun",
    specialization: "Umum",
    bio: "",
    tarif: 100000,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});

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


const ADMIN_UID = "Vsl0uEluR5TCOdqVY7UPX2wfw6y1";

test("admin can list booking requests for operations", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(getDocs(collection(db, "bookingRequests")));
});

test("admin can assign a verified practitioner and accept a pending booking", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    nurseUid: "nurse-1",
    nurseName: "Praktisi Terverifikasi",
    nursePhone: "628111111111",
    status: "accepted",
    updatedAt: serverTimestamp()
  }));
});

test("admin cannot assign an unverified practitioner", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    nurseUid: "nurse-2",
    nurseName: "Praktisi Belum Terverifikasi",
    nursePhone: "628122222222",
    status: "accepted",
    updatedAt: serverTimestamp()
  }));
});

test("admin can reject a pending booking without assigning a practitioner", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    status: "rejected",
    updatedAt: serverTimestamp()
  }));
});

test("assigned verified practitioner can start and complete a booking", async () => {
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertSucceeds(updateDoc(doc(db, "bookingRequests", "assigned-accepted"), {
    status: "in_progress",
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db, "bookingRequests", "assigned-in-progress"), {
    status: "completed",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});

test("unassigned practitioner cannot read or change another practitioner's booking", async () => {
  const db = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(getDoc(doc(db, "bookingRequests", "assigned-accepted")));
  await assertFails(updateDoc(doc(db, "bookingRequests", "assigned-accepted"), {
    status: "in_progress",
    updatedAt: serverTimestamp()
  }));
});

test("patient cannot assign a practitioner or change operational status", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    nurseUid: "nurse-1",
    nurseName: "Praktisi Terverifikasi",
    nursePhone: "628111111111",
    status: "accepted",
    updatedAt: serverTimestamp()
  }));
});


test("admin cannot alter patient details while accepting a booking", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    patientName: "Nama diubah tanpa prosedur",
    nurseUid: "nurse-1",
    nurseName: "Praktisi Terverifikasi",
    nursePhone: "628111111111",
    status: "accepted",
    updatedAt: serverTimestamp()
  }));
});

test("assigned practitioner cannot skip directly from accepted to completed", async () => {
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "assigned-accepted"), {
    status: "completed",
    updatedAt: serverTimestamp()
  }));
});

test("assigned practitioner cannot alter patient details when starting service", async () => {
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "assigned-accepted"), {
    patientPhone: "628199999999",
    status: "in_progress",
    updatedAt: serverTimestamp()
  }));
});


test("owner can edit allowed request details while booking is pending", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    patientName: "Nama Pasien Diperbarui",
    patientPhone: "628133333333",
    notes: "Catatan diperbarui",
    updatedAt: serverTimestamp()
  }));
});

test("owner can cancel only their own pending booking", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    status: "cancelled",
    updatedAt: serverTimestamp()
  }));
});

test("owner cannot edit or cancel a booking after it is accepted", async () => {
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "assigned-accepted"), {
    notes: "Perubahan setelah diterima",
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(db, "bookingRequests", "assigned-accepted"), {
    status: "cancelled",
    updatedAt: serverTimestamp()
  }));
});

test("admin cannot move a booking to an unsupported status", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    status: "completed",
    updatedAt: serverTimestamp()
  }));
});

test("admin cannot assign a practitioner without accepting the booking", async () => {
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(updateDoc(doc(db, "bookingRequests", "pending-for-operations"), {
    nurseUid: "nurse-1",
    nurseName: "Praktisi Terverifikasi",
    nursePhone: "628111111111",
    updatedAt: serverTimestamp()
  }));
});


// Multi-location foundation tests. These are emulator tests; they do not deploy Rules.
function validPractitionerLocation(ownerUid, overrides = {}) {
  return {
    ownerUid,
    name: "Tempat Praktik Uji",
    locationType: "practice",
    address: "Jalan Contoh No. 1",
    area: "Palangka Raya",
    city: "Palangka Raya",
    province: "Kalimantan Tengah",
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function seedPractitionerLocation(id, ownerUid, status = "draft") {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "practitionerLocations", id), {
      ownerUid,
      name: "Lokasi Uji",
      locationType: "practice",
      address: "Jalan Contoh No. 1",
      area: "Palangka Raya",
      city: "Palangka Raya",
      province: "Kalimantan Tengah",
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  });
}

test("verified practitioner can create a draft location and submit it for review", async () => {
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  const locationRef = doc(db, "practitionerLocations", "location-nurse-1");
  await assertSucceeds(setDoc(
    locationRef,
    validPractitionerLocation("nurse-1")
  ));
  await assertSucceeds(updateDoc(locationRef, {
    status: "pending_review",
    updatedAt: serverTimestamp()
  }));
});

test("unverified practitioner cannot create a location", async () => {
  const db = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "location-nurse-2"),
    validPractitionerLocation("nurse-2")
  ));
});

test("practitioner cannot create or edit a location owned by another practitioner", async () => {
  await seedPractitionerLocation("location-nurse-2", "nurse-2", "draft");
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "forged-owner"),
    validPractitionerLocation("nurse-2")
  ));
  await assertFails(updateDoc(doc(db, "practitionerLocations", "location-nurse-2"), {
    name: "Perubahan tidak sah",
    updatedAt: serverTimestamp()
  }));
});

test("another practitioner and a patient cannot read a draft location", async () => {
  await seedPractitionerLocation("private-location", "nurse-1", "draft");
  const otherPractitioner = testEnv.authenticatedContext("nurse-2").firestore();
  const patient = testEnv.authenticatedContext("patient-1").firestore();
  await assertFails(getDoc(doc(otherPractitioner, "practitionerLocations", "private-location")));
  await assertFails(getDoc(doc(patient, "practitionerLocations", "private-location")));
});

test("complete patient can query published locations but not drafts", async () => {
  await seedPractitionerLocation("published-location", "nurse-1", "published");
  await seedPractitionerLocation("draft-location", "nurse-1", "draft");
  const db = testEnv.authenticatedContext("patient-1").firestore();
  const publishedQuery = query(
    collection(db, "practitionerLocations"),
    where("status", "==", "published")
  );
  const snapshot = await assertSucceeds(getDocs(publishedQuery));
  assert.equal(snapshot.size, 1);
  assert.equal(snapshot.docs[0].id, "published-location");
  await assertFails(getDoc(doc(db, "practitionerLocations", "draft-location")));
});

test("incomplete patient cannot read a published location", async () => {
  await seedPractitionerLocation("published-location", "nurse-1", "published");
  const db = testEnv.authenticatedContext("patient-incomplete").firestore();
  await assertFails(getDoc(doc(db, "practitionerLocations", "published-location")));
});

test("admin can publish a submitted location", async () => {
  await seedPractitionerLocation("review-location", "nurse-1", "pending_review");
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(updateDoc(doc(db, "practitionerLocations", "review-location"), {
    status: "published",
    reviewedBy: ADMIN_UID,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});

test("admin cannot publish a draft that was not submitted for review", async () => {
  await seedPractitionerLocation("draft-location", "nurse-1", "draft");
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(updateDoc(doc(db, "practitionerLocations", "draft-location"), {
    status: "published",
    reviewedBy: ADMIN_UID,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});

test("practitioner cannot publish or edit a location after submission", async () => {
  await seedPractitionerLocation("review-location", "nurse-1", "pending_review");
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(updateDoc(doc(db, "practitionerLocations", "review-location"), {
    status: "published",
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(db, "practitionerLocations", "review-location"), {
    name: "Diubah setelah diajukan",
    updatedAt: serverTimestamp()
  }));
});
