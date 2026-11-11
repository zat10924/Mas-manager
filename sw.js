/* sw.js — تسريع التحميل: المكتبات والخطوط من الكاش، وملفات البرنامج من النت أولًا (عشان التحديثات تظهر) */
const V="mas-v2.2.4",LIB="mas-lib";
addEventListener("install",e=>{skipWaiting()});
addEventListener("activate",e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==V&&k!==LIB)await caches.delete(k);
  await clients.claim();
})())});
const timeout=(p,ms)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error("slow")),ms);p.then(v=>{clearTimeout(t);res(v)},e=>{clearTimeout(t);rej(e)})});
addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.hostname.endsWith("supabase.co"))return;
  if(u.searchParams.has("_chk")||u.pathname.endsWith(".apk"))return; // فحص الإصدار دايمًا من النت // البيانات دايمًا مباشرة
  // مكتبات وخطوط خارجية: من الكاش فورًا وتتحدث في الخلفية
  if(u.origin!==location.origin){
    if(!/jsdelivr|googleapis|gstatic/.test(u.hostname))return;
    e.respondWith(caches.open(LIB).then(async c=>{
      const hit=await c.match(r);
      const net=fetch(r).then(x=>{if(x&&(x.ok||x.type==="opaque"))c.put(r,x.clone());return x}).catch(()=>hit);
      return hit||net;
    }));return;
  }
  // ملفات البرنامج: من الكاش فورًا (تشغيل سريع) وتتحدث في الخلفية. النسخ الجديدة بيلقطها فحص الإصدار في common.js
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(r,{ignoreSearch:true});
    const net=fetch(r,{cache:"no-cache"}).then(x=>{if(x&&x.ok)c.put(r,x.clone());return x}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return (await net)||fetch(r);
  }));
});

/* ===== الإشعارات (تشتغل والبرنامج مقفول) ===== */
addEventListener("push",e=>{
  let d={};
  try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():""}}
  e.waitUntil(registration.showNotification(d.title||"إدارة الأقسام",{
    body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",
    tag:d.tag||"mas",renotify:true,dir:"rtl",lang:"ar",
    data:{url:d.url||"index.html"}
  }));
});
addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||"index.html",registration.scope).href;
  e.waitUntil((async()=>{
    const cs=await clients.matchAll({type:"window",includeUncontrolled:true});
    for(const c of cs){
      if(c.url.startsWith(registration.scope)){
        try{await c.focus()}catch(x){}
        try{if("navigate" in c)await c.navigate(url)}catch(x){}
        return;
      }
    }
    await clients.openWindow(url);
  })());
});
