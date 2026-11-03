const CACHE_VERSION="go-homecare-v1";
const APP_SCOPE=new URL("./",self.location).pathname;
const APP_FILES=["./","./index.html","./patient.html","./nurse.html","./admin.html","./booking.html","./chat.html","./complete-profile.html","./detail-praktisi.html","./edit-profil-praktisi.html","./jadwal-lokasi-praktisi.html","./katalog-praktisi.html","./layanan-praktisi.html","./layanan.html","./lokasi-praktisi.html","./praktisi-layanan.html","./profile.html","./apply-practitioner.html","./test.html","./test2.html","./chat-notifications.js","./manifest.webmanifest","./icons/icon-192.svg","./icons/icon-512.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("go-homecare-")&&key!==CACHE_VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const request=event.request;if(request.method!=="GET")return;
 const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith(APP_SCOPE))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy));}return response;}).catch(async()=>await caches.match(request)||await caches.match(new URL("./index.html",self.location).toString())));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy));}return response;}).catch(()=>cached)));
});