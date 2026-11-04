const VERSION='14';
const PREFIX='shliakh-1m-';
const CACHE=PREFIX+'v'+VERSION;
const ASSETS=['./index.html','./styles.css','./planning.css?v=14','./cloud.css?v=14','./planning.js?v=14','./app.js?v=14','./cloud.js?v=14','./update.js?v=14','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
  // First installations activate normally; updates wait for the safe page signal.
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // Financial API calls, authentication and version checks never enter this cache.
  if(url.pathname.endsWith('/version.txt')||url.pathname.endsWith('/sw.js'))return;
  const asset=ASSETS.find(path=>new URL(path,self.registration.scope).href===url.href);
  if(event.request.mode==='navigate'){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL('./index.html',self.registration.scope))).then(hit=>hit||fetch(event.request,{cache:'no-store'})));
  }else if(asset){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(hit=>hit||fetch(event.request,{cache:'no-store'})));
  }
});
