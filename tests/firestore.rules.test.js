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


// Location service and pricing rules tests.
function validPractitionerService(overrides = {}) {
  return {
    name: "Perawatan Luka",
    description: "Perawatan luka dasar",
    price: 150000,
    durationMinutes: 60,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function seedPractitionerService(locationId, serviceId, status = "draft") {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "practitionerLocations", locationId), {
      ownerUid: "nurse-1",
      name: "Lokasi Layanan Uji",
      locationType: "practice",
      address: "Jalan Contoh No. 1",
      area: "Palangka Raya",
      city: "Palangka Raya",
      province: "Kalimantan Tengah",
      status: "published",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(context.firestore(), "practitionerLocations", locationId, "services", serviceId), {
      name: "Perawatan Luka",
      description: "Perawatan luka dasar",
      price: 150000,
      durationMinutes: 60,
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  });
}

test("verified location owner can create a draft service with a valid integer price", async () => {
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await seedPractitionerLocation("service-parent", "nurse-1", "published");
  await assertSucceeds(setDoc(
    doc(db, "practitionerLocations", "service-parent", "services", "service-new"),
    validPractitionerService()
  ));
});

test("service creation rejects invalid price, unexpected fields, and unverified owners", async () => {
  const verifiedDb = testEnv.authenticatedContext("nurse-1").firestore();
  await seedPractitionerLocation("service-parent", "nurse-1", "published");
  await assertFails(setDoc(
    doc(verifiedDb, "practitionerLocations", "service-parent", "services", "negative-price"),
    validPractitionerService({ price: -1 })
  ));
  await assertFails(setDoc(
    doc(verifiedDb, "practitionerLocations", "service-parent", "services", "spoofed-status"),
    validPractitionerService({ status: "published" })
  ));
  const unverifiedDb = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(setDoc(
    doc(unverifiedDb, "practitionerLocations", "service-parent", "services", "unverified"),
    validPractitionerService()
  ));
});

test("practitioner cannot manage services under another practitioner's location", async () => {
  await seedPractitionerLocation("service-parent", "nurse-1", "published");
  const db = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "service-parent", "services", "foreign-service"),
    validPractitionerService()
  ));
});

test("owner can edit a draft service and submit it for review", async () => {
  await seedPractitionerService("service-parent", "service-1", "draft");
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  const ref = doc(db, "practitionerLocations", "service-parent", "services", "service-1");
  await assertSucceeds(updateDoc(ref, {
    price: 175000,
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(ref, {
    status: "pending_review",
    updatedAt: serverTimestamp()
  }));
});

test("patient can read only published services under a published location", async () => {
  await seedPractitionerService("published-parent", "published-service", "published");
  await seedPractitionerService("published-parent-2", "draft-service", "draft");
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(getDoc(doc(db, "practitionerLocations", "published-parent", "services", "published-service")));
  await assertFails(getDoc(doc(db, "practitionerLocations", "published-parent-2", "services", "draft-service")));
});

test("admin can publish a submitted service but cannot publish it under an unpublished location", async () => {
  await seedPractitionerService("published-parent", "pending-service", "pending_review");
  const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertSucceeds(updateDoc(
    doc(db, "practitionerLocations", "published-parent", "services", "pending-service"),
    {
      status: "published",
      reviewedBy: ADMIN_UID,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  ));
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "practitionerLocations", "draft-parent"), {
      ownerUid: "nurse-1", name: "Lokasi Draft", locationType: "practice",
      address: "Jalan Contoh", area: "Palangka Raya", city: "Palangka Raya",
      province: "Kalimantan Tengah", status: "draft",
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
    await setDoc(doc(context.firestore(), "practitionerLocations", "draft-parent", "services", "pending-service"), {
      name: "Perawatan Luka", description: "Perawatan luka dasar", price: 150000,
      durationMinutes: 60, status: "pending_review",
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
  });
  await assertFails(updateDoc(
    doc(db, "practitionerLocations", "draft-parent", "services", "pending-service"),
    {
      status: "published",
      reviewedBy: ADMIN_UID,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  ));
});



// Weekly schedule tests: schedule documents are scoped to the owning location.
function validWeeklySchedule(overrides = {}) {
  return {
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "12:00",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function seedWeeklySchedule(locationId, scheduleId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "practitionerLocations", locationId), {
      ownerUid: "nurse-1",
      name: "Lokasi Jadwal Uji",
      locationType: "practice",
      address: "Jalan Contoh No. 1",
      area: "Palangka Raya",
      city: "Palangka Raya",
      province: "Kalimantan Tengah",
      status: "published",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(context.firestore(), "practitionerLocations", locationId, "weeklySchedule", scheduleId), {
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "12:00",
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...overrides
    });
  });
}

test("verified location owner can create and update a valid weekly schedule", async () => {
  await seedPractitionerLocation("schedule-parent", "nurse-1", "published");
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  const ref = doc(db, "practitionerLocations", "schedule-parent", "weeklySchedule", "slot-1");
  await assertSucceeds(setDoc(ref, validWeeklySchedule()));
  await assertSucceeds(updateDoc(ref, {
    startTime: "09:00",
    endTime: "13:00",
    updatedAt: serverTimestamp()
  }));
});

test("weekly schedule rejects invalid day, time format, and end time before start", async () => {
  await seedPractitionerLocation("schedule-parent", "nurse-1", "published");
  const db = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "schedule-parent", "weeklySchedule", "bad-day"),
    validWeeklySchedule({ dayOfWeek: 7 })
  ));
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "schedule-parent", "weeklySchedule", "bad-format"),
    validWeeklySchedule({ startTime: "8 AM" })
  ));
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "schedule-parent", "weeklySchedule", "bad-range"),
    validWeeklySchedule({ startTime: "15:00", endTime: "12:00" })
  ));
});

test("practitioner cannot create a schedule for another owner's location", async () => {
  await seedPractitionerLocation("schedule-parent", "nurse-1", "published");
  const db = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "schedule-parent", "weeklySchedule", "foreign-slot"),
    validWeeklySchedule()
  ));
});

test("patient can read active schedule for published location but not inactive schedule", async () => {
  await seedWeeklySchedule("published-schedule-parent", "active-slot", { active: true });
  await seedWeeklySchedule("published-schedule-parent", "inactive-slot", { active: false });
  const db = testEnv.authenticatedContext("patient-1").firestore();
  await assertSucceeds(getDoc(doc(db, "practitionerLocations", "published-schedule-parent", "weeklySchedule", "active-slot")));
  await assertFails(getDoc(doc(db, "practitionerLocations", "published-schedule-parent", "weeklySchedule", "inactive-slot")));
});

test("unverified practitioner cannot create a weekly schedule", async () => {
  await seedPractitionerLocation("schedule-parent", "nurse-1", "published");
  const db = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(setDoc(
    doc(db, "practitionerLocations", "schedule-parent", "weeklySchedule", "unverified-slot"),
    validWeeklySchedule()
  ));
});


// Public practitioner profile projection: only non-sensitive professional fields are readable.
function validPublicProfile(overrides = {}) {
  return {
    ownerUid: "nurse-1",
    name: "Praktisi Terverifikasi",
    experienceYears: 8,
    specialization: "Perawatan luka",
    bio: "Berpengalaman memberikan perawatan di rumah.",
    serviceArea: "Palangka Raya",
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

test("verified practitioner can publish a safe public profile and patient can read it", async () => {
  const practitionerDb = testEnv.authenticatedContext("nurse-1").firestore();
  const ref = doc(practitionerDb, "practitionerPublicProfiles", "nurse-1");
  await assertSucceeds(setDoc(ref, validPublicProfile()));
  const patientDb = testEnv.authenticatedContext("patient-1").firestore();
  const profile = await assertSucceeds(getDoc(doc(patientDb, "practitionerPublicProfiles", "nurse-1")));
  assert.equal(profile.data().name, "Praktisi Terverifikasi");
  assert.equal(profile.data().specialization, "Perawatan luka");
});

test("public practitioner profile rejects private fields and unverified writers", async () => {
  const practitionerDb = testEnv.authenticatedContext("nurse-1").firestore();
  await assertFails(setDoc(
    doc(practitionerDb, "practitionerPublicProfiles", "nurse-1"),
    validPublicProfile({ phone: "628111111111" })
  ));
  const unverifiedDb = testEnv.authenticatedContext("nurse-2").firestore();
  await assertFails(setDoc(
    doc(unverifiedDb, "practitionerPublicProfiles", "nurse-2"),
    validPublicProfile({ ownerUid: "nurse-2" })
  ));
});

test("incomplete patient cannot read public practitioner profile and public profiles cannot be listed", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "practitionerPublicProfiles", "nurse-1"), {
      ownerUid: "nurse-1", name: "Praktisi Terverifikasi", experienceYears: 8,
      specialization: "Perawatan luka", bio: "", serviceArea: "Palangka Raya",
      updatedAt: Timestamp.now()
    });
  });
  const incompleteDb = testEnv.authenticatedContext("patient-incomplete").firestore();
  await assertFails(getDoc(doc(incompleteDb, "practitionerPublicProfiles", "nurse-1")));
  await assertFails(getDocs(collection(incompleteDb, "practitionerPublicProfiles")));
});
