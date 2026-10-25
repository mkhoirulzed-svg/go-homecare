import { collection, query, where, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const READABLE_STATUSES = new Set(["accepted", "in_progress", "completed"]);

function ensureToastStyles() {
  if (document.getElementById("gh-chat-toast-styles")) return;
  const style = document.createElement("style");
  style.id = "gh-chat-toast-styles";
  style.textContent = `
    .gh-chat-toast-host{position:fixed;right:16px;bottom:calc(22px + env(safe-area-inset-bottom));z-index:99999;display:flex;flex-direction:column;gap:10px;width:min(360px,calc(100vw - 32px));pointer-events:none}
    .gh-chat-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:11px;width:100%;padding:14px 15px;border:1px solid #99f6e4;border-radius:16px;background:#fff;color:#0f172a;box-shadow:0 14px 40px #0f172a2b;text-align:left;cursor:pointer;animation:ghToastIn .24s ease-out}
    .gh-chat-toast-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:12px;background:#ccfbf1;color:#0f766e;font-size:20px}
    .gh-chat-toast-content{min-width:0;flex:1}.gh-chat-toast-title{font-size:13px;font-weight:800;margin:1px 0 4px}.gh-chat-toast-body{font-size:13px;color:#475569;line-height:1.4;overflow-wrap:anywhere}.gh-chat-toast-close{border:0;background:transparent;color:#64748b;font-size:20px;line-height:1;padding:0 0 4px 4px;cursor:pointer}
    @keyframes ghToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @media(prefers-reduced-motion:reduce){.gh-chat-toast{animation:none}}
  `;
  document.head.appendChild(style);
}

function showToast(host, { title, text, bookingId }) {
  const toast = document.createElement("div");
  toast.className = "gh-chat-toast";
  toast.setAttribute("role", "status");
  const icon = document.createElement("div");
  icon.className = "gh-chat-toast-icon";
  icon.textContent = "✉";
  const content = document.createElement("div");
  content.className = "gh-chat-toast-content";
  const heading = document.createElement("div");
  heading.className = "gh-chat-toast-title";
  heading.textContent = title;
  const body = document.createElement("div");
  body.className = "gh-chat-toast-body";
  body.textContent = text || "Anda menerima pesan baru.";
  content.append(heading, body);
  const close = document.createElement("button");
  close.className = "gh-chat-toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Tutup notifikasi");
  close.textContent = "×";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    toast.remove();
    if (!host.children.length) host.remove();
  });
  toast.append(icon, content, close);
  toast.addEventListener("click", () => {
    window.location.href = "chat.html?bookingId=" + encodeURIComponent(bookingId);
  });
  host.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
    if (!host.children.length) host.remove();
  }, 7000);
}

export function startChatNotifications({ db, user, role }) {
  if (!db || !user?.uid || !["pasien", "praktisi"].includes(role)) return () => {};
  ensureToastStyles();
  let host = document.querySelector(".gh-chat-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "gh-chat-toast-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-relevant", "additions");
    document.body.appendChild(host);
  }

  const field = role === "pasien" ? "patientUid" : "nurseUid";
  const unsubMessages = new Map();
  const stopBookings = onSnapshot(
    query(collection(db, "bookingRequests"), where(field, "==", user.uid)),
    (snapshot) => {
      const currentIds = new Set();
      snapshot.forEach((bookingDoc) => {
        const booking = bookingDoc.data();
        if (!READABLE_STATUSES.has(String(booking.status || "").toLowerCase())) return;
        const bookingId = bookingDoc.id;
        currentIds.add(bookingId);
        if (unsubMessages.has(bookingId)) return;

        let initialized = false;
        let lastMessageId = null;
        const stop = onSnapshot(
          query(collection(db, "bookingChats", bookingId, "messages"), orderBy("createdAt", "desc"), limit(1)),
          (messagesSnapshot) => {
            if (messagesSnapshot.empty) {
              initialized = true;
              lastMessageId = null;
              return;
            }
            const latest = messagesSnapshot.docs[0];
            const data = latest.data();
            if (!initialized) {
              initialized = true;
              lastMessageId = latest.id;
              return;
            }
            if (latest.id === lastMessageId) return;
            lastMessageId = latest.id;
            if (data.senderUid === user.uid) return;
            const currentChatId = new URLSearchParams(window.location.search).get("bookingId");
            if (window.location.pathname.endsWith("/chat.html") && currentChatId === bookingId) return;
            const sender = role === "pasien" ? (booking.nurseName || "Praktisi") : (booking.patientName || "Pasien");
            const preview = String(data.text || "Mengirim pesan").trim().slice(0, 140);
            showToast(host, { title: "Pesan baru dari " + sender, text: preview, bookingId });
          },
          (error) => console.warn("Notifikasi chat tidak dapat dipantau:", error.code || error.message)
        );
        unsubMessages.set(bookingId, stop);
      });

      for (const [bookingId, stop] of unsubMessages.entries()) {
        if (!currentIds.has(bookingId)) {
          stop();
          unsubMessages.delete(bookingId);
        }
      }
    },
    (error) => console.warn("Daftar pesanan untuk notifikasi gagal dimuat:", error.code || error.message)
  );

  return () => {
    stopBookings();
    for (const stop of unsubMessages.values()) stop();
    unsubMessages.clear();
  };
}
