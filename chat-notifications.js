import { collection, query, where, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const READABLE_STATUSES = new Set(["accepted", "in_progress", "completed"]);

function setBadge(badge, count) {
  if (!badge) return;
  const label = count > 99 ? "99+" : String(count);
  if (badge.textContent !== label) badge.textContent = label;
  if (badge.hidden !== (count <= 0)) badge.hidden = count <= 0;
}

function ensureBadgeStyles() {
  if (document.getElementById("gh-unread-chat-styles")) return;
  const style = document.createElement("style");
  style.id = "gh-unread-chat-styles";
  style.textContent = ".gh-unread-nav-badge{position:absolute;top:1px;left:calc(50% + 10px);min-width:18px;height:18px;padding:0 5px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;line-height:18px;box-shadow:0 0 0 2px #fff}.gh-unread-chat-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-left:7px;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;line-height:18px;vertical-align:middle}.gh-unread-nav-item{position:relative}.gh-unread-nav-badge[hidden],.gh-unread-chat-badge[hidden]{display:none!important}";
  document.head.appendChild(style);
}

function ensureNavigationBadge() {
  const items = Array.from(document.querySelectorAll(".nav-item"));
  const ordersItem = items.find(item => item.querySelector("span")?.textContent?.trim() === "Pesanan");
  if (!ordersItem) return null;
  ordersItem.classList.add("gh-unread-nav-item");
  let badge = document.getElementById("ghUnreadNavBadge");
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "ghUnreadNavBadge";
    badge.className = "gh-unread-nav-badge";
    badge.setAttribute("aria-label", "Pesan belum dibaca");
    badge.hidden = true;
    ordersItem.appendChild(badge);
  }
  return badge;
}

function updateBookingBadge(bookingId, count) {
  document.querySelectorAll("[data-chat-booking]").forEach(button => {
    if (button.dataset.chatBooking !== bookingId) return;
    let badge = button.querySelector(".gh-unread-chat-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "gh-unread-chat-badge";
      badge.setAttribute("aria-label", "Pesan belum dibaca");
      button.appendChild(badge);
    }
    setBadge(badge, count);
  });
}

export function startChatNotifications({ db, user, role }) {
  if (!db || !user?.uid || !["pasien", "praktisi"].includes(role)) return () => {};
  ensureBadgeStyles();
  const navBadge = ensureNavigationBadge();
  const field = role === "pasien" ? "patientUid" : "nurseUid";
  const counts = new Map();
  const listeners = new Map();
  let stopped = false;
  const badgeObserver = new MutationObserver(() => {
    for (const [bookingId, count] of counts.entries()) updateBookingBadge(bookingId, count);
  });
  badgeObserver.observe(document.body, { childList: true, subtree: true });

  function renderTotal() {
    const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
    setBadge(navBadge || document.getElementById("ghUnreadNavBadge"), total);
  }

  function stopBooking(bookingId) {
    const item = listeners.get(bookingId);
    if (item) {
      item.stopMessages?.();
      item.stopRead?.();
      listeners.delete(bookingId);
    }
    counts.delete(bookingId);
    updateBookingBadge(bookingId, 0);
    renderTotal();
  }

  const stopBookings = onSnapshot(
    query(collection(db, "bookingRequests"), where(field, "==", user.uid)),
    snapshot => {
      if (stopped) return;
      const eligible = new Set();
      snapshot.forEach(bookingDoc => {
        const booking = bookingDoc.data();
        if (!READABLE_STATUSES.has(String(booking.status || "").toLowerCase())) return;
        const bookingId = bookingDoc.id;
        eligible.add(bookingId);
        if (listeners.has(bookingId)) return;

        let readAt = 0;
        let messagesSnapshot = null;
        const refresh = () => {
          if (!messagesSnapshot) return;
          let unread = 0;
          messagesSnapshot.forEach(messageDoc => {
            const message = messageDoc.data();
            if (message.senderUid === user.uid) return;
            const sentAt = message.createdAt?.toMillis?.() ?? 0;
            if (sentAt > readAt) unread++;
          });
          counts.set(bookingId, unread);
          updateBookingBadge(bookingId, unread);
          renderTotal();
        };
        const item = { stopMessages: null, stopRead: null };
        listeners.set(bookingId, item);
        item.stopRead = onSnapshot(
          doc(db, "bookingChats", bookingId, "reads", user.uid),
          readDoc => {
            readAt = readDoc.exists() ? (readDoc.data().lastReadAt?.toMillis?.() ?? 0) : 0;
            refresh();
          },
          error => console.warn("Status baca chat tidak dapat dimuat:", error.code || error.message)
        );
        item.stopMessages = onSnapshot(
          collection(db, "bookingChats", bookingId, "messages"),
          messageDocs => {
            messagesSnapshot = messageDocs;
            refresh();
          },
          error => console.warn("Pesan chat tidak dapat dihitung:", error.code || error.message)
        );
      });
      for (const bookingId of Array.from(listeners.keys())) {
        if (!eligible.has(bookingId)) stopBooking(bookingId);
      }
    },
    error => console.warn("Daftar pesanan untuk hitungan pesan gagal dimuat:", error.code || error.message)
  );

  return () => {
    stopped = true;
    badgeObserver.disconnect();
    stopBookings();
    for (const item of listeners.values()) {
      item.stopMessages?.();
      item.stopRead?.();
    }
    listeners.clear();
    counts.clear();
  };
}
