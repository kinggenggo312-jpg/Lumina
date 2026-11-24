import{auth,db,F,login,signOut,onAuthStateChanged,$,esc,ensureUser}from"./firebase.js";
import{renderImport}from"./import.js";
import{questionForm}from"./qform.js";
let cats=[],SETS=[],D={},cur="categories",eid=null,qsave,qsel="";

const dt=t=>t?new Date(t).toLocaleString("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";
$("#login").onclick=login;
$("#out").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async u=>{
  $("#auth").hidden=!!u;$("#panel").hidden=true;
  if(!u)return;
  if(await ensureUser(u)!="admin"){$("#msg").textContent="Akun ini bukan admin.";return signOut(auth)}
  $("#msg").textContent="";$("#panel").hidden=false;tab("categories");
});

// Definisi form: [nama field, label, tipe, pilihan]
const S={
  categories:[["name","Nama (mis. Kelas 7, Matematika, Bab 1)","text"],["parent","Induk (kosong = tingkat teratas)","cat"],["order","Urutan tampil","num"]],
  materials:[["category","Kategori","cat"],["title","Judul bagian materi","text"],["order","Urutan","num"],["type","Jenis","sel",["teks","video","pdf"]],["body","Isi teks, atau link YouTube / Google Drive","area"],["status","Status","sel",["terbit","draf"]]],
  sets:[["category","Kategori","cat"],["name","Nama set (mis. Latihan 1)","text"],["order","Urutan","num"],["limit","Batas waktu (menit, kosong = tanpa batas)","num"],["status","Status","sel",["terbit","draf"]]],
  questions:[["set","Set soal","set"],["text","Pertanyaan","area"],["o0","Pilihan A","text"],["o1","Pilihan B","text"],["o2","Pilihan C","text"],["o3","Pilihan D","text"],["answer","Jawaban benar","sel",["A","B","C","D"]],["explain","Pembahasan","area"],["status","Status","sel",["aktif","disembunyikan"]]]
};

const path=c=>c?(c.parent?path(cats.find(x=>x.id==c.parent))+" › ":"")+c.name:"";
const sn=id=>{const s=SETS.find(z=>z.id==id);return s?path(cats.find(c=>c.id==s.category))+" › "+s.name:"(set belum dipilih)"};
const fld=([n,l,t,o])=>`<label>${l}</label>`+(
  t=="area"?`<textarea name="${n}"></textarea>`
  :t=="cat"?`<select name="${n}"><option value="">(tidak ada)</option>${cats.map(c=>`<option value="${c.id}">${esc(path(c))}</option>`).join("")}</select>`
  :t=="set"?`<select name="${n}">${SETS.map(s=>`<option value="${s.id}">${esc(sn(s.id))}</option>`).join("")}</select>`
  :t=="sel"?`<select name="${n}">${o.map(x=>`<option>${x}</option>`).join("")}</select>`
  :`<input name="${n}" type="${t=="num"?"number":"text"}">`);

window.tab=async k=>{
  const prev=cur;cur=k;eid=null;if(k=="questions"&&prev!="questions")qsel="";if(k=="materials"&&prev!="materials")msel="";
  cats=(await F.getDocs(F.collection(db,"categories"))).docs.map(d=>({id:d.id,...d.data()}));
  SETS=(await F.getDocs(F.collection(db,"sets"))).docs.map(d=>({id:d.id,...d.data()}));
  if(k=="import")return renderImport($("#c"),SETS,sn);
  const s=await F.getDocs(F.collection(db,k));
  D=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));
  const TL={pg:"PG",pgk:"PG kompleks",bs:"Benar/Salah",essay:"Essay"};
  const row=d=>{const x=d.data();
    const title=k=="categories"?path(cats.find(c=>c.id==d.id)):(x.title||x.name||x.text||"(soal berupa gambar)");
    const sub=k=="categories"?"":k=="questions"?TL[x.type||"pg"]+(x.img?" · ada gambar":"")+" · "+x.status:path(cats.find(c=>c.id==x.category))+" · "+(k=="materials"&&x.type?x.type+" · ":"")+x.status;
    return`<div class="c">${(k=="questions"&&qsel)||(k=="materials"&&msel)?`<input type="checkbox" class="sel" data-id="${d.id}" aria-label="Pilih">`:""}<button class="d" onclick="del('${d.id}')">Hapus</button><button class="d" onclick="edit('${d.id}')">Edit</button><b>${esc(String(title).slice(0,160))}</b><br><small>${esc(sub)}</small>${x.createdAt?`<br><small>Diunggah ${dt(x.createdAt)}</small>`:""}</div>`};
  const all=s.docs.sort((a,b)=>(b.data().createdAt||0)-(a.data().createdAt||0));
  let list;
  if(k=="questions"){
    const known=new Set(SETS.map(z=>z.id)),NO="Tanpa set / set dihapus";
    if(!qsel){
      const gs=[...SETS].sort((a,b)=>sn(a.id).localeCompare(sn(b.id),"id",{numeric:true})).map(z=>[z.id,sn(z.id),all.filter(q=>q.data().set==z.id).length]);
      const lost=all.filter(q=>!known.has(q.data().set)).length;
      if(lost)gs.push(["_none",NO,lost]);
      list=gs.map(([id,name,c])=>`<button class="c go" onclick="pickSet('${id}')"><span class="t"><b>${esc(name)}</b><small>${c} soal</small></span><span class="ch">›</span></button>`).join("")||'<p class="empty">Belum ada set soal. Buat dulu di tab Set Soal.</p>';
    }else{
      const L=all.filter(q=>qsel=="_none"?!known.has(q.data().set):q.data().set==qsel);
      list=`<button class="back" onclick="pickSet('')">← Semua set</button><h3>${esc(qsel=="_none"?NO:sn(qsel))} <small>${L.length} soal</small></h3>${bulk(L.length,"Hapus semua soal di set ini","delSetQ")}`+(L.map(row).join("")||'<p class="empty">Belum ada soal di set ini.</p>');
    }
  }else if(k=="materials"){
    const known=new Set(cats.map(c=>c.id)),NOC="Tanpa kategori / kategori dihapus";
    if(!msel){
      const g={};all.forEach(m=>{const c=known.has(m.data().category)?m.data().category:"_none";g[c]=(g[c]||0)+1});
      list=Object.entries(g).map(([id,c])=>[id,id=="_none"?NOC:path(cats.find(x=>x.id==id)),c]).sort((a,b)=>a[1].localeCompare(b[1],"id",{numeric:true})).map(([id,name,c])=>`<button class="c go" onclick="pickCat('${id}')"><span class="t"><b>${esc(name)}</b><small>${c} materi</small></span><span class="ch">›</span></button>`).join("")||'<p class="empty">Belum ada materi.</p>';
    }else{
      const L=all.filter(m=>msel=="_none"?!known.has(m.data().category):m.data().category==msel);
      list=`<button class="back" onclick="pickCat('')">← Semua kategori</button><h3>${esc(msel=="_none"?NOC:path(cats.find(x=>x.id==msel)))} <small>${L.length} materi</small></h3>${bulk(L.length,"Hapus semua materi di kategori ini","delCatM")}`+(L.map(row).join("")||'<p class="empty">Belum ada materi di kategori ini.</p>');
    }
  }else list=all.map(row).join("");
  $("#c").innerHTML=`<h2>Tambah baru</h2>${k=="questions"?'<div id="qf"></div>':`<form id="f">${S[k].map(fld).join("")}<button class="p">Simpan</button></form>`}<h2>${k=="questions"?"Daftar soal":`Daftar (${s.size})`}</h2>`+list;
  if(k=="questions"){
    qsave=async o=>{await F.setDoc(F.doc(db,k,eid||F.doc(F.collection(db,k)).id),{...o,createdAt:(D[eid]||{}).createdAt||Date.now()});tab(k)};
    questionForm($("#qf"),SETS,sn,null,qsave,qsel&&qsel!="_none"?{set:qsel}:null);return;
  }
  $("#f").onsubmit=async e=>{
    e.preventDefault();
    const o=Object.fromEntries(new FormData(e.target));
    if("order"in o)o.order=+o.order||0;
    if("limit"in o)o.limit=+o.limit||0;
    if(eid)await F.setDoc(F.doc(db,k,eid),o,{merge:true});else await F.addDoc(F.collection(db,k),{...o,createdAt:Date.now()});
    tab(k);
  };
};

window.edit=id=>{
  eid=id;
  if(cur=="questions"){questionForm($("#qf"),SETS,sn,D[id],qsave);scrollTo(0,0);return}
  const x={...D[id]};
  S[cur].forEach(([n])=>{const e=$("#f").elements[n];if(e)e.value=x[n]??""});
  $("#f button").textContent="Simpan perubahan";scrollTo(0,0);
};

window.delSetQ=async()=>{
  const known=new Set(SETS.map(z=>z.id));
  const ids=Object.entries(D).filter(([,x])=>qsel=="_none"?!known.has(x.set):x.set==qsel).map(([id])=>id);
  if(!ids.length)return;
  if(!confirm("Hapus SEMUA "+ids.length+" soal di "+(qsel=="_none"?"kelompok ini":sn(qsel))+"? Tindakan ini tidak bisa dibatalkan."))return;
  try{
    for(let n=0;n<ids.length;n+=400){
      const b=F.writeBatch(db);
      ids.slice(n,n+400).forEach(id=>b.delete(F.doc(db,"questions",id)));
      await b.commit();
    }
  }catch(e){return alert("Gagal menghapus: "+e.message)}
  tab("questions");
};
let msel="";
const delMany=async(c,ids)=>{
  try{for(let n=0;n<ids.length;n+=400){const b=F.writeBatch(db);ids.slice(n,n+400).forEach(id=>b.delete(F.doc(db,c,id)));await b.commit()}return true}
  catch(e){alert("Gagal menghapus: "+e.message);return false}
};
const bulk=(n,label,fn)=>n?`<div class="row"><button onclick="selAll()">Pilih semua</button><button class="dg" style="margin:0" onclick="delSel()">Hapus terpilih</button></div><button class="dg" onclick="${fn}()">${label}</button>`:"";
window.selAll=()=>{const b=[...document.querySelectorAll(".sel")],on=b.some(x=>!x.checked);b.forEach(x=>x.checked=on)};
window.delSel=async()=>{
  const ids=[...document.querySelectorAll(".sel:checked")].map(x=>x.dataset.id);
  if(!ids.length)return alert("Centang dulu item yang ingin dihapus.");
  if(!confirm("Hapus "+ids.length+" item yang dipilih? Tindakan ini tidak bisa dibatalkan."))return;
  if(await delMany(cur,ids))tab(cur);
};
window.pickCat=id=>{msel=id;tab("materials")};
window.delCatM=async()=>{
  const known=new Set(cats.map(c=>c.id));
  const ids=Object.entries(D).filter(([,x])=>msel=="_none"?!known.has(x.category):x.category==msel).map(([id])=>id);
  if(!ids.length)return;
  if(!confirm("Hapus SEMUA "+ids.length+" materi di kategori ini? Tindakan ini tidak bisa dibatalkan."))return;
  if(await delMany("materials",ids))tab("materials");
};
window.pickSet=id=>{qsel=id;tab("questions")};

window.del=async id=>{
  if(confirm("Hapus item ini?")){await F.deleteDoc(F.doc(db,cur,id));tab(cur)}
};
