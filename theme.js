(()=>{
const root=document.documentElement,bs=document.querySelectorAll(".theme");
const label=()=>bs.forEach(b=>b.textContent=root.dataset.theme=="dark"?"Terang":"Gelap");
bs.forEach(b=>{b.setAttribute("aria-label","Ganti mode tampilan");b.onclick=()=>{const t=root.dataset.theme=="dark"?"light":"dark";root.dataset.theme=t;try{localStorage.theme=t}catch(e){}label()}});
label();
})();
