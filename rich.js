import{esc}from"./firebase.js";
const K="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/";
let kp;
const loadK=()=>kp||(kp=new Promise(ok=>{
  if(window.katex)return ok();
  const l=document.createElement("link");l.rel="stylesheet";l.href=K+"katex.min.css";document.head.append(l);
  const s=document.createElement("script");s.src=K+"katex.min.js";s.onload=ok;s.onerror=ok;document.head.append(s);
}));
const LANG=/^(python|py|js|javascript|java|cpp|c|html|css|sql|php|bash|json)\n/i;
// Teks kaya: ```blok kode```, `kode`, rumus $LaTeX$, dan baris baru
export function rich(t){
  return String(t??"").split("```").map((p,i)=>i%2
    ?`<pre><code>${esc(p.replace(LANG,"").replace(/^\n+|\n+$/g,""))}</code></pre>`
    :esc(p.replace(/^\n+|\n+$/g,"")).replace(/\$([^$\n]+)\$/g,(_,m)=>`<span class="mx" data-m="${m}"></span>`).replace(/`([^`\n]+)`/g,"<code>$1</code>").replace(/\n/g,"<br>")).join("");
}
export async function typeset(root){
  const e=[...root.querySelectorAll(".mx")];if(!e.length)return;
  await loadK();
  e.forEach(n=>{const m=n.dataset.m;if(window.katex)try{katex.render(m,n,{throwOnError:false});return}catch(_){}n.textContent="$"+m+"$"});
}
