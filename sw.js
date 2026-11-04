const CACHE='shliakh-1m-v9';
const ASSETS=['./','./index.html','./styles.css','./planning.css?v=9','./cloud.css?v=9','./planning.js?v=9','./app.js?v=9','./cloud.js?v=9','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const allowed=ASSETS.some(path=>new URL(path,self.registration.scope).href===url.href);
  if(!allowed&&event.request.mode!=='navigate')return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&allowed){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
