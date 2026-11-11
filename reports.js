/* reports.js — محرك التقارير المشترك (يعتمد على common.js و config.js) */
const Reports=(()=>{
const APP="إدارة الأقسام";
const D=x=>x?String(x).slice(0,10):"";

/* ---------- جلب البيانات (مع تجاوز حد 1000 صف في Supabase) ---------- */
async function all(table,cols="*"){
  const out=[];
  for(let f=0;;f+=1000){
    const{data,error}=await db.from(table).select(cols).order("id").range(f,f+999);
    if(error)throw error;
    out.push(...data);
    if(data.length<1000)break;
  }
  return out;
}
// الإنتاج بدون طلبية (جدول free_production) — لو الجدول لسه مش موجود بيرجع فاضي
async function freeRows(sec){
  const out=[];
  try{
    for(let f=0;;f+=1000){
      const{data,error}=await db.from("free_production").select("*").eq("section",sec).order("id").range(f,f+999);
      if(error)return[];
      out.push(...data);if(data.length<1000)break;
    }
  }catch(e){return[]}
  return out.map(x=>({d:D(x.prod_date),item:x.item||"—",sub:x.sub||"",qty:+x.qty||0,w:x.worker||"",n:x.note||"",free:true}));
}
const groupBy=(arr,k)=>{const m=new Map();arr.forEach(x=>{const v=x[k];(m.get(v)||m.set(v,[]).get(v)).push(x)});return m};

function fromLines(orders,lines,prods,subKey,waste){
  const O=new Map(orders.map(o=>[o.id,o])),L=new Map(lines.map(l=>[l.id,l])),byO=groupBy(lines,"order_id");
  const prod=prods.map(p=>{const l=L.get(p.line_id),o=l&&O.get(l.order_id);return{d:D(p.prod_date),item:o?.item||"—",sub:l?String(l[subKey]??""):"",qty:+p.qty||0,w:p.worker||"",n:[p.design,p.note].filter(Boolean).join(" · ")}});
  const ord=orders.map(o=>{
    const ls=byO.get(o.id)||[];
    return{id:o.id,item:o.item,sub:ls.map(l=>l[subKey]).join("، "),date:D(o.order_date),status:o.status,
      req:ls.reduce((a,l)=>a+(+l.total_required||0),0),done:ls.reduce((a,l)=>a+Math.min(+l.produced||0,+l.total_required||0),0)};
  });
  const out={prod,ord};
  if(waste)out.waste=waste.map(w=>({d:D(w.waste_date),item:w.item||w.glaze_orders?.item||"-",good:+w.good_qty||0,qty:+w.qty||0}));
  return out;
}

const SRC={
  glaze:{name:"جليز",page:"glaze.html",icon:"glaze",color:"#2E6F80",noun:"الإنتاج",sub:"اللون",
    async fetch(){
      const[o,p,w]=await Promise.all([
        all("glaze_orders","id,item,order_date,status"),
        all("glaze_production","*"),
        all("glaze_waste","*").catch(()=>[])
      ]);
      // الأسطر: نجرب الـ view أولاً ولو فشل نحسب من الجداول الأصلية
      let l;
      try{l=await all("glaze_lines_status","id,order_id,color,total_required,produced")}
      catch(e){
        const[ln,inc]=await Promise.all([all("glaze_order_lines","id,order_id,color,qty_required"),all("glaze_order_increases","id,line_id,qty").catch(()=>[])]);
        const add=new Map(),made=new Map();
        inc.forEach(x=>add.set(x.line_id,(add.get(x.line_id)||0)+(+x.qty||0)));
        p.forEach(x=>made.set(x.line_id,(made.get(x.line_id)||0)+(+x.qty||0)));
        l=ln.map(x=>({id:x.id,order_id:x.order_id,color:x.color,total_required:(+x.qty_required||0)+(add.get(x.id)||0),produced:made.get(x.id)||0}));
      }
      const names=new Map(o.map(x=>[x.id,x.item]));
      w.forEach(x=>{if(!x.item&&x.order_id)x.item=names.get(x.order_id)});
      const out=fromLines(o,l,p,"color",w);out.prod.push(...await freeRows("glaze"));return out;
    }},
  deco:{name:"زخرفة",page:"decoration.html",icon:"deco",color:"#5E5A8C",noun:"الإنتاج",sub:"الكود",
    async fetch(){
      const[o,l,p]=await Promise.all([all("deco_orders","id,item,order_date,status"),all("deco_lines_status","id,order_id,code,total_required,produced"),all("deco_production","*")]);
      const out=fromLines(o,l,p,"code");out.prod.push(...await freeRows("deco"));return out;
    }},
  spray:{name:"رش",page:"spray.html",icon:"spray",color:"#B8862B",noun:"الإنتاج",sub:"اللون",
    async fetch(){
      const[s,p]=await Promise.all([all("spray_status","*"),all("spray_production","*")]);
      const S=new Map(s.map(x=>[x.id,x])),fr=await freeRows("spray");
      return{
        prod:p.map(x=>{const o=S.get(x.order_id);return{d:D(x.prod_date),item:o?.item||"—",sub:o?String(o.color??""):"",qty:+x.qty||0,w:x.worker||"",n:x.note||""}}).concat(fr),
        ord:s.map(o=>({id:o.id,item:o.item,sub:String(o.color??""),date:D(o.order_date),status:o.status,req:+o.qty_required||0,done:Math.min(+o.produced||0,+o.qty_required||0)}))
      };
    }},
  repair:{name:"تصليح",page:"repair.html",icon:"repair",color:"#5D6B7A",noun:"التصليح",sub:"",
    async fetch(){
      const r=await all("repair_log","id,repair_date,item,qty");
      return{prod:r.map(x=>({d:D(x.repair_date),item:x.item||"بدون صنف",sub:"",qty:+x.qty||0})),ord:null};
    }}
};
const KEYS=Object.keys(SRC);
const cache={};
async function getData(key,force){
  const c=cache[key];
  if(!force&&c&&Date.now()-c.t<30000)return c.data;
  const data=await SRC[key].fetch();
  cache[key]={t:Date.now(),data};
  return data;
}

/* ---------- فترات وتجميع ---------- */
function rangeOf(k,f,t){
  const T=today();
  return k==="today"?[T,T]:k==="7"?[addDays(T,-6),T]:k==="month"?[T.slice(0,8)+"01",T]:k==="all"?["",""]:[f||"",t||""];
}
const inRange=(d,f,t)=>(!f||d>=f)&&(!t||d<=t);
function prevRange(f,t){if(!f||!t)return null;const n=daysBetween(f,t)+1,pt=addDays(f,-1);return[addDays(pt,-(n-1)),pt]}
const weekStart=d=>addDays(d,-((new Date(d+"T00:00:00Z").getUTCDay()+1)%7)); // الأسبوع يبدأ السبت
const plan=(f,t)=>{const n=daysBetween(f,t)+1;return n<=31?"day":n<=150?"week":"month"};
const keyOf=(d,m)=>m==="day"?d:m==="week"?weekStart(d):d.slice(0,7);
function bucketList(f,t,m){
  const out=[];
  if(m==="day"){for(let c=f;c<=t;c=addDays(c,1))out.push(c)}
  else if(m==="week"){for(let c=weekStart(f);c<=t;c=addDays(c,7))out.push(c)}
  else{let y=+f.slice(0,4),mo=+f.slice(5,7);const end=t.slice(0,7);for(;;){const k=y+"-"+String(mo).padStart(2,"0");if(k>end)break;out.push(k);if(++mo>12){mo=1;y++}}}
  return out;
}
const shortL=(k,m)=>m==="day"?String(+k.slice(8)):m==="week"?(+k.slice(8))+"/"+(+k.slice(5,7)):new Date(k+"-01T00:00:00Z").toLocaleDateString("ar-EG",{month:"short",timeZone:"UTC"});
const longL=(k,m)=>m==="day"?new Date(k+"T00:00:00Z").toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"})
  :m==="week"?"أسبوع يبدأ "+new Date(k+"T00:00:00Z").toLocaleDateString("ar-EG",{day:"numeric",month:"long",timeZone:"UTC"})
  :new Date(k+"-01T00:00:00Z").toLocaleDateString("ar-EG",{month:"long",year:"numeric",timeZone:"UTC"});
const fmtP=(f,t)=>f&&t?(f===t?fmtD(f):`من ${fmtD(f)} إلى ${fmtD(t)}`):f?`من ${fmtD(f)}`:t?`حتى ${fmtD(t)}`:"كل الفترات";
const groupSum=(rows,by)=>{const m=new Map();rows.forEach(r=>{const k=by==="sub"?r.item+(r.sub?" — "+r.sub:""):r.item;m.set(k,(m.get(k)||0)+r.qty)});return[...m].sort((a,b)=>b[1]-a[1])};
const sum=rows=>rows.reduce((a,r)=>a+r.qty,0);
const deltaOf=(cur,prev)=>prev==null?null:prev===0?(cur>0?["up","▲ جديد"]:null):(()=>{const p=Math.round((cur-prev)/prev*100);return p===0?["flat","= نفس الفترة السابقة"]:[p>0?"up":"down",(p>0?"▲ ":"▼ ")+Math.abs(p)+"% عن الفترة السابقة"]})();

/* ---------- الرسم البياني (أعمدة متراصة) ---------- */
function drawChart(el,{f,t,series}){
  if(!f||!t){
    const ds=series.flatMap(s=>s.rows.map(r=>r.d)).sort();
    if(!ds.length){el.innerHTML='<div class="empty">مفيش بيانات في الفترة دي</div>';return}
    f=f||ds[0];t=t||ds[ds.length-1];
  }
  const m=plan(f,t),bl=bucketList(f,t,m);
  const sums=series.map(s=>{const o={};s.rows.forEach(r=>{if(r.d>=f&&r.d<=t){const k=keyOf(r.d,m);o[k]=(o[k]||0)+r.qty}});return o});
  const tot=bl.map(k=>sums.reduce((a,o)=>a+(o[k]||0),0));
  if(!tot.some(Boolean)){el.innerHTML='<div class="empty">مفيش بيانات في الفترة دي</div>';return}
  const max=Math.max(...tot),step=Math.ceil(bl.length/10),few=bl.length<=12,mi=tot.indexOf(max);
  const unit=m==="day"?"يوم":m==="week"?"أسبوع":"شهر";
  el.innerHTML=`<div class="chart"><div class="bars">${bl.map((k,i)=>{
      const h=tot[i]/max*100;
      return `<div class="b ${tot[i]?"":"zero"}" data-i="${i}"><div class="st" data-h="${h}" style="height:0">${series.map((s,si)=>sums[si][k]?`<i style="flex:${sums[si][k]};background:${s.color}"></i>`:"").join("")}</div>${tot[i]&&(few||i===mi)?`<span class="bv" style="bottom:calc(${h}% + 2px)">${nf(tot[i])}</span>`:""}</div>`}).join("")}</div>
    <div class="axis">${bl.map((k,i)=>`<span>${i%step===0?shortL(k,m):""}</span>`).join("")}</div>
    <div class="cinfo">كل عمود = ${unit} · اضغط على عمود للتفاصيل</div></div>
    ${series.length>1?`<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${s.name}</span>`).join("")}</div>`:""}`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll(".st").forEach(s=>s.style.height=s.dataset.h+"%")));
  el.querySelector(".bars").onclick=e=>{
    const b=e.target.closest(".b");if(!b)return;const i=+b.dataset.i;
    el.querySelectorAll(".b").forEach(x=>x.classList.toggle("sel",x===b));
    const parts=series.length>1?"<br>"+series.map((s,si)=>`${s.name}: <b>${nf(sums[si][bl[i]]||0)}</b>`).join(" · "):"";
    el.querySelector(".cinfo").innerHTML=`${longL(bl[i],m)} — <b>${nf(tot[i])}</b>${parts}`;
  };
}

/* ---------- أدوات واجهة مشتركة ---------- */
const CHIPS=[["today","اليوم"],["7","7 أيام"],["month","الشهر"],["all","الكل"]];
const chipsHtml=k=>CHIPS.map(c=>`<button type="button" class="chip ${c[0]===k?"on":""}" data-k="${c[0]}">${c[1]}</button>`).join("");
const skelKpis=n=>Array.from({length:n},()=>'<i class="sk" style="height:66px;border-radius:14px"></i>').join("");
function csvDownload(name,header,rows){
  const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';
  const csv="\uFEFF"+[header.join(","),...rows.map(r=>r.map(q).join(","))].join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=name;a.click();
}
async function shareText(text){
  const org=(SET.get("org","")||"").trim();
  if(SET.get("shareorg",false)&&org)text=org+"\n"+text;
  if(SET.get("sharedt",false))text+="\n🕒 "+new Date().toLocaleString("ar-EG");
  const m=SET.get("share","auto");
  if(m==="copy"){
    try{await navigator.clipboard.writeText(text);toast("اتنسخ التقرير");return}catch(e){}
  }
  if(m!=="whatsapp"&&navigator.share){try{await navigator.share({text});return}catch(e){if(e.name==="AbortError")return}}
  window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");
}
const showMore=(list,flag)=>flag?list:list.slice(0,10);

/* ---------- تقرير قسم واحد ---------- */
function mount(rootId,key){
  const root=typeof rootId==="string"?document.getElementById(rootId):rootId,cfg=SRC[key];
  const st={k:"month",f:"",t:"",item:"",by:"item",data:null,moreB:false,moreO:false,last:null};
  const hasOrd=key!=="repair";
  root.innerHTML=`
  <div class="print-head"><h2>${APP} — تقرير ${cfg.name}</h2><div class="nums rpd"></div></div>
  <div class="card noprint">
    <div class="chips rch">${chipsHtml(st.k)}</div>
    <div class="two"><div><label>من</label><input type="date" class="rf"></div><div><label>إلى</label><input type="date" class="rt"></div></div>
    <label>الصنف</label><select class="ri"><option value="">الكل</option></select>
  </div>
  <div class="kpis rk">${skelKpis(4)}</div>
  <div class="card"><div class="sec-head"><h3>${cfg.noun} على مدار الفترة</h3></div><div class="rc"><i class="sk" style="height:170px"></i></div></div>
  <div class="card"><div class="sec-head"><h3>التوزيع</h3>${cfg.sub?`<div class="seg noprint"><button class="on" data-by="item">حسب الصنف</button><button data-by="sub">حسب ${cfg.sub}</button></div>`:""}</div><div class="scroll rb"></div></div>
  ${hasOrd?'<div class="card"><div class="sec-head"><h3>الطلبيات المفتوحة حالياً</h3></div><div class="scroll ro"></div></div>':""}
  <div class="row noprint"><button class="btn rx">تصدير Excel</button><button class="btn ghost rpr">طباعة</button><button class="btn ghost rsh">مشاركة</button></div>`;
  const $=s=>root.querySelector(s),$$=s=>root.querySelectorAll(s);

  function range(){return rangeOf(st.k,st.f,st.t)}
  function draw(){
    const data=st.data;if(!data)return;
    const[f,t]=range();
    const byItem=r=>!st.item||r.item===st.item;
    const rows=data.prod.filter(r=>inRange(r.d,f,t)&&byItem(r));
    const total=sum(rows);
    const days=new Set(rows.map(r=>r.d)).size;
    const perDay=new Map();rows.forEach(r=>perDay.set(r.d,(perDay.get(r.d)||0)+r.qty));
    const best=[...perDay].sort((a,b)=>b[1]-a[1])[0];
    const pr=prevRange(f,t);
    const prevTotal=pr?sum(data.prod.filter(r=>inRange(r.d,pr[0],pr[1])&&byItem(r))):null;
    const K=[[`إجمالي ${cfg.noun}`,total,null,{},deltaOf(total,prevTotal)],
      ["متوسط / يوم عمل",days?total/days:0,null,{}],
      [best?`أفضل يوم (${new Date(best[0]+"T00:00:00Z").toLocaleDateString("ar-EG",{day:"numeric",month:"short",timeZone:"UTC"})})`:"أفضل يوم",best?best[1]:0,null,{}],
      ["عدد الأصناف",new Set(rows.map(r=>r.item)).size,null,{}]];
    let open=[];
    if(data.ord){
      open=data.ord.filter(o=>o.status==="open"&&(!st.item||o.item===st.item));
      const req=open.reduce((a,o)=>a+o.req,0),dn=open.reduce((a,o)=>a+o.done,0),late=open.filter(o=>isLate(o.status,o.date)).length;
      K.push(["طلبيات مفتوحة",open.length,null,{}],["المتبقي للإنجاز",Math.max(req-dn,0),null,{}],["نسبة إنجاز المفتوحة",req?dn/req*100:0,null,{suf:"%"}],[`متأخرة (+${LATE_DAYS} يوم)`,late,late?"var(--warn)":null,{}]);
    }
    if(data.waste){
      const w=data.waste.filter(x=>inRange(x.d,f,t)&&byItem(x)),wq=w.reduce((a,x)=>a+x.qty,0),wg=w.reduce((a,x)=>a+x.good,0);
      K.push(["الهالك",wq,wq?"var(--bad)":null,{}],["نسبة الهالك",wq+wg?wq/(wq+wg)*100:0,null,{suf:"%",dec:1}]);
    }
    kpis($(".rk"),K);
    drawChart($(".rc"),{f,t,series:[{name:cfg.name,color:cfg.color,rows}]});
    // التوزيع
    const g=groupSum(rows,st.by),gl=showMore(g,st.moreB);
    $(".rb").innerHTML=g.length?`<table><thead><tr><th>${st.by==="sub"?"الصنف — "+cfg.sub:"الصنف"}</th><th>الكمية</th><th>النسبة</th></tr></thead><tbody>${gl.map(([k,v])=>{const p=total?Math.round(v/total*100):0;return `<tr><td>${esc(k)}</td><td><b>${nf(v)}</b></td><td><div class="share"><div class="bar"><i style="width:${p}%;background:${cfg.color}"></i></div><span>${p}%</span></div></td></tr>`}).join("")}</tbody><tfoot><tr><th>الإجمالي</th><th>${nf(total)}</th><th></th></tr></tfoot></table>${g.length>10?`<button class="btn ghost sm more noprint" data-m="b">${st.moreB?"عرض أقل":`عرض الكل (${g.length})`}</button>`:""}`:'<div class="empty">مفيش بيانات في الفترة دي</div>';
    // الطلبيات المفتوحة
    if(hasOrd){
      const ol=open.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")),ov=showMore(ol,st.moreO);
      $(".ro").innerHTML=ol.length?`<table><thead><tr><th>الطلبية</th><th>العمر</th><th>الإنجاز</th><th>المتبقي</th></tr></thead><tbody>${ov.map(o=>{const p=o.req?Math.min(100,Math.round(o.done/o.req*100)):0,late=isLate(o.status,o.date);return `<tr><td><b>${esc(o.item)}</b>${o.sub?`<div class="nums" style="font-size:.8rem">${esc(o.sub)}</div>`:""}</td><td>${late?'<span class="tag late">متأخرة</span> ':""}<span class="nums">${ageTxt(o.date)}</span></td><td><div class="share"><div class="bar"><i style="width:${p}%;background:${p>=100?"var(--ok)":cfg.color}"></i></div><span>${p}%</span></div></td><td><b>${nf(Math.max(o.req-o.done,0))}</b></td></tr>`}).join("")}</tbody></table>${ol.length>10?`<button class="btn ghost sm more noprint" data-m="o">${st.moreO?"عرض أقل":`عرض الكل (${ol.length})`}</button>`:""}`:'<div class="empty">مفيش طلبيات مفتوحة 👌</div>';
    }
    $(".rpd").textContent=fmtP(f,t)+(st.item?" · الصنف: "+st.item:"")+" · طُبع في "+fmtD(today());
    st.last={f,t,rows,total,g,open,best};
  }
  async function refresh(force){
    $(".rk").innerHTML=skelKpis(hasOrd?8:4);
    try{st.data=await getData(key,force)}
    catch(e){$(".rk").innerHTML='<div class="empty err-state" style="grid-column:1/-1">تعذر تحميل التقرير<br><button class="btn sm rr">إعادة المحاولة</button></div>';$(".rr").onclick=()=>refresh(true);return}
    const s=$(".ri"),cur=s.value;
    s.innerHTML='<option value="">الكل</option>'+[...new Set(st.data.prod.map(r=>r.item))].sort().map(v=>`<option>${esc(v)}</option>`).join("");
    s.value=[...s.options].some(o=>o.value===cur)?cur:"";st.item=s.value;
    syncDates();draw();
  }
  function syncDates(){if(st.k!=="custom"){[$(".rf").value,$(".rt").value]=rangeOf(st.k)}}
  $(".rch").onclick=e=>{const b=e.target.closest(".chip");if(!b)return;st.k=b.dataset.k;st.moreB=st.moreO=false;$$(".rch .chip").forEach(c=>c.classList.toggle("on",c===b));syncDates();draw()};
  const custom=()=>{st.k="custom";st.f=$(".rf").value;st.t=$(".rt").value;$$(".rch .chip").forEach(c=>c.classList.remove("on"));draw()};
  $(".rf").onchange=custom;$(".rt").onchange=custom;
  $(".ri").onchange=e=>{st.item=e.target.value;draw()};
  root.addEventListener("click",e=>{
    const sg=e.target.closest(".seg button");
    if(sg){st.by=sg.dataset.by;$$(".seg button").forEach(b=>b.classList.toggle("on",b===sg));st.moreB=false;draw();return}
    const mo=e.target.closest(".more");
    if(mo){if(mo.dataset.m==="b")st.moreB=!st.moreB;else st.moreO=!st.moreO;draw()}
  });
  $(".rx").onclick=()=>{
    if(!st.last)return;const{f,t,rows}=st.last;
    csvDownload(`${cfg.name}-تقرير-${f||"الكل"}${t&&t!==f?"-"+t:""}.csv`,["التاريخ","الصنف",cfg.sub||"-","الكمية"],rows.slice().sort((a,b)=>a.d.localeCompare(b.d)).map(r=>[r.d,r.item,r.sub,r.qty]));
  };
  $(".rpr").onclick=()=>window.print();
  $(".rsh").onclick=()=>{
    if(!st.last)return;const{f,t,total,g,open,best}=st.last;
    const L=[`📊 تقرير ${cfg.name}`,`الفترة: ${fmtP(f,t)}`+(st.item?` · ${st.item}`:""),`إجمالي ${cfg.noun}: ${nf(total)}`];
    if(best)L.push(`أفضل يوم: ${fmtD(best[0])} (${nf(best[1])})`);
    if(g.length)L.push("أعلى الأصناف:",...g.slice(0,5).map(([k,v])=>`• ${k}: ${nf(v)}`));
    if(hasOrd)L.push(`طلبيات مفتوحة: ${open.length} · متأخرة: ${open.filter(o=>isLate(o.status,o.date)).length}`);
    shareText(L.join("\n"));
  };
  refresh();
  return{refresh:()=>refresh(true)};
}

/* ---------- لوحة التقارير الشاملة ---------- */
function dashboard(rootId){
  const root=document.getElementById(rootId);
  const st={k:"month",f:"",t:"",data:{},err:{},moreT:false,moreL:false,last:null};
  root.innerHTML=`
  <div class="print-head"><h2>${APP} — ملخص كل الأقسام</h2><div class="nums rpd"></div></div>
  <div class="card noprint">
    <div class="chips rch">${chipsHtml(st.k)}</div>
    <div class="two"><div><label>من</label><input type="date" class="rf"></div><div><label>إلى</label><input type="date" class="rt"></div></div>
  </div>
  <div class="secgrid rs">${Array.from({length:4},()=>'<i class="sk" style="height:96px;border-radius:14px"></i>').join("")}</div>
  <div class="card"><div class="sec-head"><h3>الإنتاج اليومي لكل الأقسام</h3></div><div class="rc"><i class="sk" style="height:170px"></i></div></div>
  <div class="card"><div class="sec-head"><h3>أعلى الأصناف</h3></div><div class="scroll rt2"></div></div>
  <div class="card"><div class="sec-head"><h3>طلبيات متأخرة</h3></div><div class="scroll rl"></div></div>
  <div class="card noprint"><h3>تصدير ونسخة احتياطية</h3>
    <div class="nums" style="margin-bottom:8px">خد نسخة من بياناتك بشكل دوري. ملف JSON فيه كل الجداول ويتحفظ عندك.</div>
    <div class="row"><button class="btn rx">تصدير الإنتاج (Excel)</button><button class="btn ghost rbk">نسخة احتياطية (JSON)</button><button class="btn ghost rpr">طباعة</button><button class="btn ghost rsh">مشاركة</button></div></div>`;
  const $=s=>root.querySelector(s),$$=s=>root.querySelectorAll(s);
  const range=()=>rangeOf(st.k,st.f,st.t);
  const syncDates=()=>{if(st.k!=="custom")[$(".rf").value,$(".rt").value]=rangeOf(st.k)};

  function draw(){
    const[f,t]=range(),pr=prevRange(f,t);
    const per=KEYS.map(k=>{
      const d=st.data[k];if(!d)return{k,err:true};
      const rows=d.prod.filter(r=>inRange(r.d,f,t));
      const prev=pr?sum(d.prod.filter(r=>inRange(r.d,pr[0],pr[1]))):null;
      const open=d.ord?d.ord.filter(o=>o.status==="open"):null;
      return{k,rows,total:sum(rows),delta:deltaOf(sum(rows),prev),open,late:open?open.filter(o=>isLate(o.status,o.date)).length:0};
    });
    $(".rs").innerHTML=per.map(p=>{
      const c=SRC[p.k];
      if(p.err)return `<a class="seccard" href="javascript:void(0)" onclick="location.reload()" style="--c:${c.color}"><div class="h">${ico(c.icon)}${c.name}</div><div class="sm">تعذر التحميل — اضغط للمحاولة</div></a>`;
      return `<a class="seccard" href="${c.page}#reports" style="--c:${c.color}"><div class="h">${ico(c.icon)}${c.name}</div><div class="big kv2">0</div><div class="sm">${c.noun} في الفترة</div>${p.delta?`<div class="kd ${p.delta[0]}">${p.delta[1]}</div>`:""}${p.open?`<div class="sm">${p.open.length} مفتوحة${p.late?` · <b style="color:var(--warn)">${p.late} متأخرة</b>`:""}</div>`:""}</a>`;
    }).join("");
    $$(".rs .kv2").forEach((el,i)=>countUp(el,per.filter(p=>!p.err)[i].total));
    // رسم مجمّع
    const series=per.filter(p=>!p.err).map(p=>({name:SRC[p.k].name,color:SRC[p.k].color,rows:p.rows}));
    drawChart($(".rc"),{f,t,series});
    // أعلى الأصناف (كل الأقسام)
    const top=[];per.filter(p=>!p.err).forEach(p=>{const m=new Map();p.rows.forEach(r=>m.set(r.item,(m.get(r.item)||0)+r.qty));m.forEach((v,k)=>top.push({k,v,s:p.k}))});
    top.sort((a,b)=>b.v-a.v);const tl=showMore(top,st.moreT);
    $(".rt2").innerHTML=top.length?`<table><thead><tr><th>الصنف</th><th>القسم</th><th>الكمية</th></tr></thead><tbody>${tl.map(x=>`<tr><td>${esc(x.k)}</td><td><span class="badge" style="--c:${SRC[x.s].color}">${SRC[x.s].name}</span></td><td><b>${nf(x.v)}</b></td></tr>`).join("")}</tbody></table>${top.length>10?`<button class="btn ghost sm more noprint" data-m="t">${st.moreT?"عرض أقل":`عرض الكل (${top.length})`}</button>`:""}`:'<div class="empty">مفيش بيانات في الفترة دي</div>';
    // متأخرة
    const late=[];per.forEach(p=>{if(p.open)p.open.filter(o=>isLate(o.status,o.date)).forEach(o=>late.push({...o,s:p.k}))});
    late.sort((a,b)=>(a.date||"").localeCompare(b.date||""));const ll=showMore(late,st.moreL);
    $(".rl").innerHTML=late.length?`<table><thead><tr><th>الطلبية</th><th>القسم</th><th>العمر</th><th>المتبقي</th></tr></thead><tbody>${ll.map(o=>`<tr><td><b>${esc(o.item)}</b>${o.sub?`<div class="nums" style="font-size:.8rem">${esc(o.sub)}</div>`:""}</td><td><a href="${SRC[o.s].page}" class="badge" style="--c:${SRC[o.s].color};text-decoration:none">${SRC[o.s].name}</a></td><td><span class="nums">${ageTxt(o.date)}</span></td><td><b>${nf(Math.max(o.req-o.done,0))}</b></td></tr>`).join("")}</tbody></table>${late.length>10?`<button class="btn ghost sm more noprint" data-m="l">${st.moreL?"عرض أقل":`عرض الكل (${late.length})`}</button>`:""}`:`<div class="empty">مفيش طلبيات متأخرة (أكتر من ${LATE_DAYS} يوم) 👌</div>`;
    $(".rpd").textContent=fmtP(f,t)+" · طُبع في "+fmtD(today());
    st.last={f,t,per,top,late};
  }
  async function refresh(force){
    const res=await Promise.allSettled(KEYS.map(k=>getData(k,force)));
    res.forEach((r,i)=>{if(r.status==="fulfilled"){st.data[KEYS[i]]=r.value;delete st.err[KEYS[i]]}else{delete st.data[KEYS[i]];st.err[KEYS[i]]=1}});
    if(Object.keys(st.err).length===KEYS.length){
      $(".rs").innerHTML='<div class="empty err-state" style="grid-column:1/-1">تعذر تحميل التقارير<br><button class="btn sm rr">إعادة المحاولة</button></div>';
      $(".rr").onclick=()=>refresh(true);return;
    }
    syncDates();draw();
  }
  $(".rch").onclick=e=>{const b=e.target.closest(".chip");if(!b)return;st.k=b.dataset.k;$$(".rch .chip").forEach(c=>c.classList.toggle("on",c===b));syncDates();draw()};
  const custom=()=>{st.k="custom";st.f=$(".rf").value;st.t=$(".rt").value;$$(".rch .chip").forEach(c=>c.classList.remove("on"));draw()};
  $(".rf").onchange=custom;$(".rt").onchange=custom;
  root.addEventListener("click",e=>{const mo=e.target.closest(".more");if(!mo)return;const m=mo.dataset.m;if(m==="t")st.moreT=!st.moreT;else st.moreL=!st.moreL;draw()});
  $(".rx").onclick=()=>{
    if(!st.last)return;const{f,t,per}=st.last;
    const rows=per.filter(p=>!p.err).flatMap(p=>p.rows.map(r=>[SRC[p.k].name,r.d,r.item,r.sub,r.qty])).sort((a,b)=>a[1].localeCompare(b[1]));
    csvDownload(`تقرير-الأقسام-${f||"الكل"}${t&&t!==f?"-"+t:""}.csv`,["القسم","التاريخ","الصنف","اللون/الكود","الكمية"],rows);
  };
  $(".rbk").onclick=async e=>{
    const b=e.currentTarget;b.disabled=true;b.classList.add("loading");
    const TABLES=["free_production","glaze_orders","glaze_order_lines","glaze_production","glaze_order_increases","glaze_waste","deco_orders","deco_lines","deco_production","deco_increases","spray_orders","spray_production","repair_log"];
    try{
      const out={exported_at:new Date().toISOString(),tables:{},errors:{}};
      for(const tb of TABLES){try{out.tables[tb]=await all(tb,"*")}catch(er){out.errors[tb]=er.message||String(er)}}
      const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:"application/json"}));a.download=`نسخة-احتياطية-${today()}.json`;a.click();
      toast(Object.keys(out.errors).length?"تم التحميل مع تعذر بعض الجداول":"تم تحميل النسخة الاحتياطية");
    }finally{b.disabled=false;b.classList.remove("loading")}
  };
  $(".rpr").onclick=()=>window.print();
  $(".rsh").onclick=()=>{
    if(!st.last)return;const{f,t,per,late}=st.last;
    shareText([`📊 ملخص الأقسام`,`الفترة: ${fmtP(f,t)}`,...per.filter(p=>!p.err).map(p=>`• ${SRC[p.k].name}: ${nf(p.total)}`),`طلبيات متأخرة: ${late.length}`].join("\n"));
  };
  refresh();
  return{refresh:()=>refresh(true)};
}

return{mount,dashboard,sources:SRC,getData};
})();
