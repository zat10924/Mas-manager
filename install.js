// زر تثبيت التطبيق (أندرويد/كروم/إيدج مباشرة، وآيفون بتعليمات الإضافة للشاشة الرئيسية)
(()=>{
  const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
  if(standalone)return;
  let ev=null,btn=null;
  const dismissed=()=>{try{return Date.now()-(+localStorage.getItem("pwa_x")||0)<6048e5}catch(e){return false}};
  function show(txt,fn){
    if(btn||dismissed())return;
    btn=document.createElement("div");btn.id="pwa-install";
    btn.innerHTML='<button type="button" class="go"></button><button type="button" class="x" aria-label="إغلاق">×</button>';
    btn.querySelector(".go").textContent=txt;
    btn.querySelector(".go").onclick=fn;
    btn.querySelector(".x").onclick=()=>{try{localStorage.setItem("pwa_x",Date.now())}catch(e){}btn.remove()};
    document.body.appendChild(btn);
  }
  addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();ev=e;
    show("⬇ تثبيت التطبيق",async()=>{ev.prompt();await ev.userChoice.catch(()=>{});ev=null;btn&&btn.remove()});
  });
  addEventListener("appinstalled",()=>btn&&btn.remove());
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!/crios|fxios/i.test(navigator.userAgent);
  if(ios)addEventListener("load",()=>show("⬇ تثبيت التطبيق",()=>alert("في سفاري: اضغط زر المشاركة (المربع والسهم) ثم «إضافة إلى الشاشة الرئيسية».")));
})();
