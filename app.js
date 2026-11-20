import{auth,db,F,login,signOut,onAuthStateChanged,$,esc,embed,ensureUser}from"./firebase.js";
let U,cats=[],stack=[];
const v=h=>$("#v").innerHTML=h;
const col=(...p)=>F.collection(db,...p);

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
  const kids=cats.filter(c=>(c.parent||"")==cur).sort((a,b)=>(a.order||0)-(b.order||0));
  v((cur?`<button onclick="back()">← Kembali</button><h2>${esc(me.name)}</h2>
    <div class="row"><button class="p" onclick="mats('${cur}')">Materi</button><button class="p" onclick="quiz('${cur}')">Latihan soal</button></div>`
    :"<h2>Pilih kelas</h2>")
    +kids.map(k=>`<button class="c" onclick="go('${k.id}')">${esc(k.name)}</button>`).join("")
    +(!kids.length&&!cur?"<p>Belum ada kategori. Admin perlu menambahkannya dulu.</p>":""));
};

window.mats=async id=>{
  const s=await F.getDocs(F.query(col("materials"),F.where("category","==",id),F.where("status","==","terbit")));
  v(`<button onclick="home()">← Kembali</button>`+(s.docs.map(d=>{const m=d.data();
    return`<article><h3>${esc(m.title)}</h3>${m.type=="teks"?`<p>${esc(m.body).replace(/\n/g,"<br>")}</p>`:`<iframe src="${esc(embed(m))}" allowfullscreen></iframe>`}</article>`}).join("")||"<p>Belum ada materi di bab ini.</p>"));
};

window.quiz=async id=>{
  const qs=(await F.getDocs(F.query(col("questions"),F.where("category","==",id),F.where("status","==","aktif")))).docs.map(d=>({id:d.id,...d.data()}));
  const an={};(await F.getDocs(col("users",U.uid,"answers"))).forEach(d=>an[d.id]=d.data());
  // Prioritas: belum dikerjakan (0) → pernah salah (1) → pernah benar (2), diacak di tiap kelompok
  const rank=q=>!an[q.id]?0:an[q.id].ok?2:1;
  qs.sort((a,b)=>rank(a)-rank(b)||Math.random()-.5);
  const set=qs.slice(0,10);
  if(!set.length)return v(`<button onclick="home()">← Kembali</button><p>Belum ada soal di bab ini.</p>`);
  let i=0,ok=0;const t0=Date.now();
  const tick=setInterval(()=>{const e=$("#t");if(e)e.textContent=Math.floor((Date.now()-t0)/1000)+" detik"},1000);
  const show=()=>{
    const q=set[i];
    v(`<p><small>Soal ${i+1} dari ${set.length} · waktu <span id="t"></span></small></p><h3>${esc(q.text)}</h3>`
      +q.options.map((o,k)=>`<button class="c" data-k="${k}">${esc(o)}</button>`).join(""));
    document.querySelectorAll("[data-k]").forEach(b=>b.onclick=async()=>{
      const good=+b.dataset.k==q.answer;if(good)ok++;
      await F.setDoc(F.doc(db,"users",U.uid,"answers",q.id),{ok:good,at:Date.now()});
      v(`<h3 class="${good?"ok":"no"}">${good?"Benar":"Salah"}</h3>${good?"":`<p>Jawaban benar: ${esc(q.options[q.answer])}</p>`}<p>${esc(q.explain||"")}</p><button class="p" id="n">${i+1<set.length?"Soal berikutnya":"Lihat skor"}</button>`);
      $("#n").onclick=()=>++i<set.length?show():fin();
    });
  };
  const fin=async()=>{
    clearInterval(tick);
    const score=Math.round(ok/set.length*100),sec=Math.round((Date.now()-t0)/1000);
    await F.addDoc(col("users",U.uid,"attempts"),{cat:id,score,ok,total:set.length,sec,at:Date.now()});
    v(`<h2>Skor ${score}</h2><p>${ok} dari ${set.length} benar dalam ${sec} detik.</p><button class="p" onclick="home()">Selesai</button>`);
  };
  show();
};

window.hist=async()=>{
  const s=await F.getDocs(F.query(col("users",U.uid,"attempts"),F.orderBy("at","desc"),F.limit(30)));
  v(`<button onclick="home()">← Kembali</button><h2>Riwayat</h2>`+(s.docs.map(d=>{const a=d.data(),c=cats.find(x=>x.id==a.cat);
    return`<div class="c"><b>${esc(c?.name||"Bab dihapus")}</b><br>Skor ${a.score}, ${a.ok} dari ${a.total} benar, ${a.sec} detik<br><small>${new Date(a.at).toLocaleString("id-ID")}</small></div>`}).join("")||"<p>Belum ada riwayat. Kerjakan latihan pertamamu.</p>"));
};
