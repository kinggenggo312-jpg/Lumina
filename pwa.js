if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
const bar=document.getElementById("ib"),txt=document.getElementById("ibt"),go=document.getElementById("inst"),no=document.getElementById("ibx");
let ev;
const dismissed=()=>{try{return localStorage.pwaNo}catch(e){}};
const standalone=matchMedia("(display-mode:standalone)").matches||navigator.standalone;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();ev=e;if(!dismissed()&&!standalone){txt.textContent="Pasang Lumina di layar utama HP kamu.";go.hidden=false;bar.hidden=false}});
if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone&&!dismissed()){txt.textContent="Di iPhone: ketuk Bagikan, lalu Tambah ke Layar Utama.";go.hidden=true;bar.hidden=false}
go.onclick=async()=>{if(!ev)return;ev.prompt();await ev.userChoice;ev=null;bar.hidden=true};
no.onclick=()=>{bar.hidden=true;try{localStorage.pwaNo=1}catch(e){}};
addEventListener("appinstalled",()=>bar.hidden=true);
