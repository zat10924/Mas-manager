const SUPABASE_URL = "https://bzhxdikcyxkdojwlswhq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NDJle8iKFHVTezQ_CTjeqg_Usd42lkZ";
/* ===== تخزين البيانات على الجهاز + مزامنة تلقائية =====
   القراءة: بتفتح فورًا من نسخة الجهاز، وفي الخلفية بتتحدث من السيرفر ولو اتغيّرت البيانات الصفحة بتتحدث لوحدها.
   أي كتابة (إضافة/تعديل/حذف) بتمسح النسخة المحفوظة عشان ما تظهرش بيانات قديمة. */
const MASC=(()=>{
  const STORE="r",MAX_AGE=7*864e5,mem=new Map();
  let dbp=null,epoch=0,nt;
  const idb=()=>dbp||(dbp=new Promise(res=>{try{const q=indexedDB.open("mas-cache",1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE);q.onsuccess=()=>res(q.result);q.onerror=q.onblocked=()=>res(null)}catch(e){res(null)}}));
  const tx=async(mode,fn)=>{const d=await idb();if(!d)return null;return new Promise(r=>{try{const t=d.transaction(STORE,mode),q=fn(t.objectStore(STORE));t.oncomplete=()=>r(q&&q.result!==undefined?q.result:null);t.onerror=t.onabort=()=>r(null)}catch(e){r(null)}})};
  const get=async k=>{if(mem.has(k))return mem.get(k);const v=await tx("readonly",s=>s.get(k));if(v)mem.set(k,v);return v};
  const put=(k,v)=>{mem.set(k,v);tx("readwrite",s=>s.put(v,k))};
  const clear=()=>{epoch++;mem.clear();return tx("readwrite",s=>s.clear())};
  const who=h=>{try{const a=(h.get("Authorization")||"").replace(/^Bearer\s+/i,"").split(".");if(a.length<3)return "";const p=JSON.parse(atob(a[1].replace(/-/g,"+").replace(/_/g,"/")));return p.role==="authenticated"?String(p.sub):""}catch(e){return ""}};
  const notify=()=>{clearTimeout(nt);nt=setTimeout(()=>{try{dispatchEvent(new Event("mas-data"))}catch(e){}},300)};
  const RO=/\/rest\/v1\/rpc\/(server_today|login_email|save_push_sub|delete_push_sub)(\?|$)/;
  const mk=(e,m)=>new Response(m==="HEAD"?null:e.b,{status:e.s,headers:Object.assign({"content-type":e.ct},e.cr?{"content-range":e.cr}:{})});
  const ent=(r,b)=>({t:Date.now(),s:r.status,b,ct:r.headers.get("content-type")||"application/json",cr:r.headers.get("content-range")||""});
  async function f(input,init){
    const url=typeof input==="string"?input:((input&&input.url)||"");
    if(url.indexOf("/rest/v1/")<0)return fetch(input,init);
    const method=String((init&&init.method)||(input&&input.method)||"GET").toUpperCase();
    if(method!=="GET"&&method!=="HEAD"){
      const r=await fetch(input,init);
      if(r.ok&&!RO.test(url))await clear();
      return r;
    }
    const h=new Headers((init&&init.headers)||(input&&input.headers)||{});
    let u=who(h);
    if(u){try{localStorage.setItem("masc_uid",u)}catch(e){}}
    else if(typeof navigator!=="undefined"&&!navigator.onLine){try{u=localStorage.getItem("masc_uid")||""}catch(e){}} // أوفلاين والتوكن منتهي: نفس مستخدم آخر جلسة
    if(!u||/\/rest\/v1\/profiles(\?|$)/.test(url))return fetch(input,init); // الصلاحيات دايمًا من السيرفر
    const key=[u,method,url,h.get("accept"),h.get("prefer"),h.get("range")].join("|");
    let hit=await get(key);
    if(hit&&Date.now()-hit.t>MAX_AGE)hit=null;
    const ep=epoch;
    if(hit){
      (async()=>{try{
        const r=await fetch(input,init);
        if(r.status!==200&&r.status!==206)return;
        const b=method==="HEAD"?"":await r.text(),n=ent(r,b);
        if(ep!==epoch)return;
        const changed=hit.b!==b||hit.cr!==n.cr;
        put(key,n);if(changed)notify();
      }catch(e){}})();
      return mk(hit,method);
    }
    const r=await fetch(input,init);
    if(r.status===200||r.status===206){
      r.clone().text().then(b=>{if(ep===epoch)put(key,ent(r,method==="HEAD"?"":b))}).catch(()=>{});
    }
    return r;
  }
  return{fetch:f,clear};
})();
window.masCacheClear=()=>{try{localStorage.removeItem("masc_uid")}catch(e){}return MASC.clear()};
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {global:{fetch:MASC.fetch}});

/* ===== إصدار البرنامج (غيّر الرقم هنا عند كل تحديث) ===== */
const APP_VERSION = "2.6.0";
// مفتاح الإشعارات العام (آمن إنه يبقى ظاهر)
const VAPID_PUBLIC = "BMI1dksSzpLuotH8TRjMLlwd53SaAltxeJkdfGYnb0GNTjQLbqXy-HDXbWZUlA5jtahNrND9TZRV7afcjnDfLhs";
/* مستودع GitHub: منه بتتجاب «ما الجديد» تلقائيًا من رسائل الـ commit العربي */
const GH_REPO = "zat10924/zat10924.github.io";
const APP_BUILD = "2026-11-12";
// آخر التحديثات (الأحدث أولاً) — بتظهر في الإعدادات > البرنامج > «ما الجديد»
const APP_CHANGES = [
  ["2.6.0", "2026-11-12", [
    "الرش: تسجيل «لون الرش» مع كل تسجيل إنتاج (الافتراضي لون الطلبية وتقدر تغيّره) وظهوره في السجلات والتقارير",
    "تقارير أذكى: ملاحظات تلقائية (الاتجاه، توقّع نهاية الشهر، أيام بلا إنتاج، أكتر لون، العمال) وتقدير وقت إنجاز الطلبيات والطلبيات الراكدة",
    "فلاتر جديدة في تقرير القسم: اللون والعامل، وجداول «أداء العمال» و«سجل التفاصيل»",
    "طباعة ذكية: اختيار الأقسام اللي تتطبع (ملخص / تفصيلي / للإدارة)، واتجاه الصفحة تلقائي، وإخفاء الأقسام الفاضية",
    "التقرير اليومي: مقارنة بأمس ومتوسط 7 أيام وملاحظات ذكية وألوان الرش ومعدل العمال",
    "لازم تشغّل ملف setup_spray_color.sql مرة واحدة في Supabase"
  ]],
  ["2.3.9", "2026-11-12", [
    "ستايل أيقونات جديد: خطوط أرفع وأزرار زجاجية متدرجة وإضاءة ذهبية للعنصر النشط",
    "إصلاح تقرير هالك الجليز",
    "القائمة الجانبية منظمة في مجموعات: الإنتاج، الأقسام، التقارير والبحث، البيانات الأساسية، إدارة النظام"
  ]],
  ["2.3.7", "2026-11-12", [
    "قسم جديد: الصب اليدوي (سوف ينشأ قريبًا)",
    "توقّع التأخير: كارت بالطلبيات المعرّضة للتأخير قبل ما تتأخر فعلًا",
    "تحليل الهالك (جليز): أكتر الأصناف والأسباب هالكًا، مع تحذير لو النسبة عالية",
    "أيقونات أحدث وتصميم أنظف لصفحة الإعدادات"
  ]],
  ["2.3.4", "2026-11-11", [
    "تنبيه لما النت يقع ولما يرجع، حتى والبرنامج في الخلفية أو مقفول، ويختفي لوحده",
    "تقدر تقفل أو تفتح التنبيه ده من الإعدادات ← الإشعارات"
  ]],
  ["2.3.1", "2026-11-11", [
    "شغل أفضل لما النت يقطع: البرنامج بيفضل مفتوح ببيانات الجهاز من غير ما يطلّعك لصفحة الدخول"
  ]],
  ["2.3.0", "2026-11-11", [
    "البرنامج بيفتح فورًا من بيانات الجهاز وبعدين بيزامن تلقائيًا مع السيرفر (الصفحة بتتحدث لوحدها لما يحصل تغيير)"
  ]],
  ["2.2.5", "2026-11-11", [
    "أنيميشن تحميل عند فتح الصفحات والتنقل بينها"
  ]],
  ["2.2.4", "2026-11-11", [
    "ربط الإشعارات بدالة السيرفر الجديدة"
  ]],
  ["2.2.3", "2026-11-11", [
    "مفتاح إشعارات جديد وإعداد سيرفر الإشعارات"
  ]],
  ["2.2.2", "2026-11-11", [
    "رسالة خطأ واضحة لما إرسال الإشعار يفشل"
  ]],
  ["2.2.1", "2026-11-11", [
    "تسريع التشغيل: الملفات بتفتح من الجهاز فورًا وتتحدث في الخلفية",
    "إصلاح الإشعارات: التحديث التلقائي كان بيمسح اشتراك الإشعارات، ودلوقتي بيتجدد لوحده"
  ]],
  ["2.2.0", "2026-11-11", [
    "إشعارات بتوصل حتى والبرنامج مقفول: إنتاج جديد، طلبيات، رسائل من المسؤول، ونسخ جديدة من البرنامج",
    "تفعيل الإشعارات وتجربتها من الإعدادات > البرنامج"
  ]],
  ["2.1.4", "2026-11-11", [
    "مشاركة البرنامج بقت بتشارك رابط تحميل التطبيق نفسه بدل رابط المتصفح"
  ]],
  ["2.1.3", "2026-11-11", [
    "تحديث تلقائي: البرنامج بيكتشف النسخة الجديدة ويحدّث نفسه من غير ما تضغط أي زر"
  ]],
  ["2.1.2", "2026-11-11", [
    "تحسين زر التحديث: تحميل الصفحة أسرع ومن غير تعليق لو ضغطت أكتر من مرة"
  ]],
  ["2.1.1", "2026-11-11", [
    "تسريع البرنامج: تخزين المكتبات والخطوط على الجهاز، وتخفيف الحركات والتمويه الثقيل"
  ]],
  ["2.1.0", "2026-11-11", [
    "المعدل المطلوب يوميًا لكل عامل ومتابعة إنتاجه النهارده مقابل المعدل",
    "تسجيل الرسمة (كود أو وصف) واسم العامل عند إنتاج الزخرفة",
    "صفحة «بحث شامل»: إنتاج أي صنف بالتاريخ في الجليز والهالك والزخرفة (بكود الرسمة) والرش والتصليح",
    "تبويب «إنتاج العمال» في الزخرفة: إجمالي كل عامل وتفصيل أصنافه تلقائيًا"
  ]],
  ["2.0.0", "2026-11-11", [
    "تسجيل إنتاج بدون طلبية، وتسجيل هالك من صفحة الإنتاج",
    "قوائم منسدلة (سهم ▾) في كل خانات الصنف واللون والكود والعامل والسبب",
    "إضافة كود وصورة لكل صنف في «الأصناف والألوان»",
    "رقم الهاتف والواتساب في الملف الشخصي مع زر مراسلة واتساب",
    "المسؤول يقدر يتابع أكتر من قسم",
    "حماية حسابات المديرين: مفيش مدير يقدر يعدّل أو يحذف مدير تاني من البرنامج",
    "تحسين وضوح الألوان في الوضع النهاري",
    "أنيميشن جديد لكلمة «أهلاً» واسم المستخدم",
    "رقم إصدار للبرنامج"
  ]],
  ["1.0.0", "2026-01-01", ["النسخة الأولى"]]
];
