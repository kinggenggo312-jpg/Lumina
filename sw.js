const C="lumina-v1";
const FILES=["./","index.html","style.css","theme.js","pwa.js","app.js","firebase.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>Promise.allSettled(FILES.map(f=>c.add(f)))));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Utamakan jaringan (selalu versi terbaru); cadangan dari cache saat offline
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!="GET"||new URL(r.url).origin!=location.origin)return;
  e.respondWith(fetch(r,{cache:"no-cache"}).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match("index.html"))));
});
