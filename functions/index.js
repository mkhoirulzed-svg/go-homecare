const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { defineSecret, defineString, defineBoolean } = require("firebase-functions/params");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

// Set these values with Firebase CLI / Meta setup. Never put secrets in frontend files.
const WA_ACCESS_TOKEN = defineSecret("WA_ACCESS_TOKEN");
const WA_PHONE_NUMBER_ID = defineSecret("WA_PHONE_NUMBER_ID");
const WA_GRAPH_API_VERSION = defineString("WA_GRAPH_API_VERSION");
const WA_NOTIFICATIONS_ENABLED = defineBoolean("WA_NOTIFICATIONS_ENABLED", {
  default: false
});

// Template names must match approved WhatsApp message templates in Meta WhatsApp Manager.
const TEMPLATE_NURSE_NEW_BOOKING = "ghc_booking_request_nurse";
const TEMPLATE_PATIENT_RECEIVED = "ghc_booking_received_patient";
const TEMPLATE_PATIENT_STATUS = "ghc_booking_status_patient";

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function safeText(value, fallback = "-") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim();
  return text ? text.slice(0, 120) : fallback;
}

function bookingTime(data) {
  const value = data.scheduledAt;
  if (!value) return "Sesuai kesepakatan";
  if (typeof value === "string") return safeText(value);
  if (value.toDate && typeof value.toDate === "function") {
    return value.toDate().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta"
    });
  }
  return "Sesuai kesepakatan";
}

async function sendTemplate(toValue, templateName, bodyParameters) {
  const to = normalizePhone(toValue);
  if (!to) {
    logger.warn("WhatsApp skipped: missing or invalid recipient phone", { templateName });
    return { sent: false, reason: "invalid_recipient" };
  }

  const version = WA_GRAPH_API_VERSION.value();
  const phoneNumberId = WA_PHONE_NUMBER_ID.value();
  const token = WA_ACCESS_TOKEN.value();

  if (!version || !/^v\d+\.\d+$/.test(version)) {
    throw new Error("WA_GRAPH_API_VERSION must be set to a supported Meta Graph API version, e.g. vXX.X.");
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "id" },
        components: [{
          type: "body",
          parameters: bodyParameters.map((text) => ({
            type: "text",
            text: safeText(text)
          }))
        }]
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error("WhatsApp Cloud API rejected a message", {
      status: response.status,
      templateName,
      errorCode: result && result.error ? result.error.code : undefined
    });
    throw new Error(`WhatsApp API error: HTTP ${response.status}`);
  }

  // Do not log access tokens, full phone numbers, or message contents.
  logger.info("WhatsApp template accepted by Meta", {
    templateName,
    messageId: result && result.messages && result.messages[0]
      ? result.messages[0].id
      : null
  });
  return { sent: true, messageId: result.messages?.[0]?.id || null };
}

async function markNotification(requestRef, key, result) {
  await requestRef.set({
    whatsappNotifications: {
      [key]: {
        attemptedAt: FieldValue.serverTimestamp(),
        sent: Boolean(result && result.sent),
        reason: result && result.reason ? result.reason : null,
        messageId: result && result.messageId ? result.messageId : null
      }
    }
  }, { merge: true });
}

/**
 * Expected collection: bookingRequests/{requestId}
 * Expected fields:
 * patientPhone, nursePhone, patientName, nurseName, serviceName,
 * scheduledAt (string or Firestore Timestamp), area.
 *
 * This trigger is intentionally disabled by default. It will not send messages
 * until WA_NOTIFICATIONS_ENABLED is explicitly set to true.
 */
exports.notifyNewBooking = onDocumentCreated({
  document: "bookingRequests/{requestId}",
  secrets: [WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID]
}, async (event) => {
  if (!WA_NOTIFICATIONS_ENABLED.value()) {
    logger.info("WhatsApp notifications disabled; booking saved without sending messages.", {
      requestId: event.params.requestId
    });
    return;
  }

  const data = event.data?.data();
  if (!data) return;

  const requestRef = event.data.ref;
  const service = safeText(data.serviceName, "Layanan homecare");
  const patientName = safeText(data.patientName, "Pasien");
  const nurseName = safeText(data.nurseName, "Perawat");
  const time = bookingTime(data);
  const area = safeText(data.area, "Palangka Raya");

  const outcomes = await Promise.allSettled([
    sendTemplate(data.nursePhone, TEMPLATE_NURSE_NEW_BOOKING, [
      patientName, service, time, area
    ]),
    sendTemplate(data.patientPhone, TEMPLATE_PATIENT_RECEIVED, [
      patientName, service, time, nurseName
    ])
  ]);

  const notificationState = {};
  ["nurseNewBooking", "patientReceived"].forEach((key, index) => {
    const item = outcomes[index];
    notificationState[key] = {
      attemptedAt: FieldValue.serverTimestamp(),
      sent: item.status === "fulfilled" && Boolean(item.value?.sent),
      messageId: item.status === "fulfilled" ? item.value?.messageId || null : null,
      error: item.status === "rejected" ? "send_failed_check_function_logs" : null
    };
  });

  await requestRef.set({ whatsappNotifications: notificationState }, { merge: true });
});

/**
 * Sends a patient update when status changes to accepted, rejected, or cancelled.
 * Expected status values: pending, accepted, rejected, cancelled.
 */
exports.notifyPatientBookingStatus = onDocumentUpdated({
  document: "bookingRequests/{requestId}",
  secrets: [WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID]
}, async (event) => {
  if (!WA_NOTIFICATIONS_ENABLED.value()) return;

  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  const status = String(after.status || "").toLowerCase();
  const statusLabels = {
    accepted: "diterima",
    rejected: "ditolak",
    cancelled: "dibatalkan"
  };
  if (!statusLabels[status]) return;

  const key = `patientStatus_${status}_${event.id}`;
  const requestRef = event.data.after.ref;

  // Best-effort event idempotency marker. Test duplicate/retry behavior before production.
  const markerRef = requestRef.collection("notificationEvents").doc(key);
  const existing = await markerRef.get();
  if (existing.exists) return;
  await markerRef.create({
    type: "patient_status",
    status,
    createdAt: FieldValue.serverTimestamp(),
    state: "processing"
  });

  try {
    const result = await sendTemplate(after.patientPhone, TEMPLATE_PATIENT_STATUS, [
      safeText(after.patientName, "Pasien"),
      safeText(after.serviceName, "Layanan homecare"),
      statusLabels[status],
      safeText(after.nurseName, "Perawat")
    ]);
    await markerRef.set({
      state: result.sent ? "sent" : "skipped",
      messageId: result.messageId || null,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    await markerRef.set({
      state: "failed",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    throw error;
  }
});
