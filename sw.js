/* sw.js — تسريع التحميل: المكتبات والخطوط من الكاش، وملفات البرنامج من النت أولًا (عشان التحديثات تظهر) */
const V="mas-v2.1.2",LIB="mas-lib";
addEventListener("install",e=>{skipWaiting()});
addEventListener("activate",e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==V&&k!==LIB)await caches.delete(k);
  await clients.claim();
})())});
const timeout=(p,ms)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error("slow")),ms);p.then(v=>{clearTimeout(t);res(v)},e=>{clearTimeout(t);rej(e)})});
addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.hostname.endsWith("supabase.co"))return; // البيانات دايمًا مباشرة
  // مكتبات وخطوط خارجية: من الكاش فورًا وتتحدث في الخلفية
  if(u.origin!==location.origin){
    if(!/jsdelivr|googleapis|gstatic/.test(u.hostname))return;
    e.respondWith(caches.open(LIB).then(async c=>{
      const hit=await c.match(r);
      const net=fetch(r).then(x=>{if(x&&(x.ok||x.type==="opaque"))c.put(r,x.clone());return x}).catch(()=>hit);
      return hit||net;
    }));return;
  }
  // ملفات البرنامج: النت أولًا (سريع) ولو بطيء أو مفيش نت نرجع للنسخة المحفوظة
  e.respondWith(caches.open(V).then(async c=>{
    try{
      const x=await timeout(fetch(r),3000);
      if(x.ok)c.put(r,x.clone());
      return x;
    }catch(err){
      const hit=await c.match(r,{ignoreSearch:true});
      if(hit)return hit;
      return fetch(r);
    }
  }));
});
