import{auth,db,F,login,signOut,onAuthStateChanged,$,esc,embed,ensureUser}from"./firebase.js";
let U,cats=[],stack=[],M={},SS={};
const v=h=>$("#v").innerHTML=h;
const col=(...p)=>F.collection(db,...p);
const list=async(n,id)=>(await F.getDocs(F.query(col(n),F.where("category","==",id),F.where("status","==","terbit")))).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));
const path=c=>c?(c.parent?path(cats.find(x=>x.id==c.parent))+" › ":"")+c.name:"";
const bk=(fn,t="Kembali")=>`<button class="back" onclick="${fn}">← ${t}</button>`;
const empty=t=>`<p class="empty">${t}</p>`;
const fmt=s=>Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
const card=(fn,label)=>`<button class="c go" onclick="${fn}"><span>${label}</span><span class="ch">›</span></button>`;

$("#login").onclick=login;
$("#out").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async u=>{
  U=u;$("#auth").hidden=!!u;$("#app").hidden=!u;
  if(!u)return;
  await ensureUser(u);
  cats=(await F.getDocs(col("categories"))).docs.map(d=>({id:d.id,...d.data()}));
  home();
});

window.go=id=>{stack.push(id);home()};
window.back=()=>{stack.pop();home()};
window.home=()=>{
  const cur=stack.at(-1)||"",me=cats.find(c=>c.id==cur);
  const kids=cats.filter(c=>(c.parent||"")==cur).sort((a,b)=>(a.order||0)-(b.order||0)).map(k=>card(`go('${k.id}')`,esc(k.name)));
  if(!cur)return v("<h2>Pilih kelas</h2>"+(kids.length?`<div class="grid">${kids.join("")}</div>`:empty("Belum ada kategori. Admin perlu menambahkannya dulu.")));
  const par=cats.find(c=>c.id==me.parent);
  v(`${bk("back()")}${par?`<small class="crumb">${esc(path(par))}</small>`:""}<h2>${esc(me.name)}</h2>
  <div class="row"><button class="act" onclick="mats('${cur}')"><b>Materi</b><small>Baca dan tonton</small></button><button class="act" onclick="sets('${cur}')"><b>Latihan soal</b><small>Uji pemahamanmu</small></button></div>
  ${kids.length?"<h3>Pilih bagian</h3>"+kids.join(""):""}`);
};

window.mats=async id=>{
  const L=await list("materials",id);M=Object.fromEntries(L.map(m=>[m.id,m]));
  v(`${bk("home()")}<h2>Materi</h2>`+(L.map((m,i)=>`<button class="c go" onclick="mat('${m.id}','${id}')"><span class="t"><b>${i+1}. ${esc(m.title)}</b><small>${{teks:"Bacaan",video:"Video",pdf:"PDF"}[m.type]||""}</small></span><span class="ch">›</span></button>`).join("")||empty("Belum ada materi di bab ini.")));
};
window.mat=(mid,cid)=>{
  const m=M[mid];
  v(`${bk(`mats('${cid}')`,"Daftar materi")}<article><h3>${esc(m.title)}</h3>${m.type=="teks"?`<p>${esc(m.body).replace(/\n/g,"<br>")}</p>`:`<iframe src="${esc(embed(m))}" allowfullscreen></iframe>`}</article>`);
};

window.sets=async id=>{
  const L=await list("sets",id);SS=Object.fromEntries(L.map(s=>[s.id,s]));
  v(`${bk("home()")}<h2>Latihan soal</h2>`+(L.map(s=>card(`quiz('${s.id}','${id}')`,esc(s.name))).join("")||empty("Belum ada set soal di bab ini.")));
};

window.quiz=async(sid,cid)=>{
  const qs=(await F.getDocs(F.query(col("questions"),F.where("set","==",sid),F.where("status","==","aktif")))).docs.map(d=>({id:d.id,...d.data()}));
  const an={};(await F.getDocs(col("users",U.uid,"answers"))).forEach(d=>an[d.id]=d.data());
  // Prioritas: belum dikerjakan → pernah salah → pernah benar, diacak di tiap kelompok
  const rank=q=>!an[q.id]?0:an[q.id].ok?2:1;
  const set=qs.sort((a,b)=>rank(a)-rank(b)||Math.random()-.5),n=set.length;
  if(!n)return v(`${bk(`sets('${cid}')`)}${empty("Set ini belum punya soal.")}`);
  let i=0,ok=0;const t0=Date.now();
  const tick=setInterval(()=>{const e=$("#t");if(e)e.textContent=fmt(Math.floor((Date.now()-t0)/1000))},1000);
  const show=()=>{
    const q=set[i];
    v(`<div class="bar"><i style="width:${i/n*100}%"></i></div><p class="meta"><small>${esc(SS[sid]?.name||"")} · Soal ${i+1} dari ${n}</small><small id="t">${fmt(Math.floor((Date.now()-t0)/1000))}</small></p><h3 class="q">${esc(q.text)}</h3>`
      +q.options.map((o,k)=>`<button class="c opt" data-k="${k}"><b>${"ABCD"[k]}</b><span>${esc(o)}</span></button>`).join("")+`<div id="fb"></div>`);
    document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{
      const good=+b.dataset.k==q.answer;if(good)ok++;
      document.querySelectorAll("[data-k]").forEach(x=>{x.disabled=true;if(+x.dataset.k==q.answer)x.classList.add("right");else if(x==b)x.classList.add("wrong")});
      $("#fb").innerHTML=`<div class="note ${good?"ok":"no"}"><b>${good?"Benar":"Kurang tepat"}</b>${q.explain?`<p>${esc(q.explain)}</p>`:""}</div><button class="p" id="n">${i+1<n?"Soal berikutnya":"Lihat skor"}</button>`;
      $("#n").onclick=()=>++i<n?show():fin();
      F.setDoc(F.doc(db,"users",U.uid,"answers",q.id),{ok:good,at:Date.now()});
    });
  };
  const fin=async()=>{
    clearInterval(tick);
    const score=Math.round(ok/n*100),sec=Math.round((Date.now()-t0)/1000);
    v(`<div class="res"><div class="big">${score}</div><p>${ok} dari ${n} benar · ${fmt(sec)}</p><button class="p" onclick="sets('${cid}')">Selesai</button></div>`);
    await F.addDoc(col("users",U.uid,"attempts"),{cat:cid,set:sid,name:SS[sid]?.name||"",score,ok,total:n,sec,at:Date.now()});
  };
  show();
};

window.hist=async()=>{
  const s=await F.getDocs(F.query(col("users",U.uid,"attempts"),F.orderBy("at","desc"),F.limit(30)));
  v(`${bk("home()")}<h2>Riwayat</h2>`+(s.size?s.docs.map(d=>{const a=d.data(),c=cats.find(x=>x.id==a.cat);
    return`<div class="c hi"><span class="badge ${a.score>=70?"ok":"no"}">${a.score}</span><div class="t"><b>${esc(c?.name||"Bab dihapus")}${a.name?" · "+esc(a.name):""}</b><small>${a.ok}/${a.total} benar · ${fmt(a.sec)} · ${new Date(a.at).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</small></div><button class="d" onclick="delHist('${d.id}')">Hapus</button></div>`}).join("")+`<button class="dg" onclick="delAll()">Hapus semua riwayat</button>`:empty("Belum ada riwayat. Kerjakan latihan pertamamu."))+`<button class="dg" onclick="resetProg()">Reset progres soal</button>`);
};
window.delHist=async id=>{
  if(confirm("Hapus riwayat ini?")){await F.deleteDoc(F.doc(db,"users",U.uid,"attempts",id));hist()}
};
window.delAll=async()=>{
  if(!confirm("Hapus SEMUA riwayat? Tindakan ini tidak bisa dibatalkan."))return;
  const s=await F.getDocs(col("users",U.uid,"attempts"));
  await Promise.all(s.docs.map(d=>F.deleteDoc(d.ref)));
  hist();
};
window.resetProg=async()=>{
  if(!confirm("Reset progres soal? Semua soal akan dianggap belum dikerjakan. Riwayat skor tidak terhapus."))return;
  const s=await F.getDocs(col("users",U.uid,"answers"));
  await Promise.all(s.docs.map(d=>F.deleteDoc(d.ref)));
  alert("Progres soal sudah direset.");
  hist();
};
