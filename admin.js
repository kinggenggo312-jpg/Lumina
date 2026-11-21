import{auth,db,F,login,signOut,onAuthStateChanged,$,esc,ensureUser}from"./firebase.js";
let cats=[],SETS=[],D={},cur="categories",eid=null;

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
  sets:[["category","Kategori","cat"],["name","Nama set (mis. Latihan 1)","text"],["order","Urutan","num"],["status","Status","sel",["terbit","draf"]]],
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
  cur=k;eid=null;
  cats=(await F.getDocs(F.collection(db,"categories"))).docs.map(d=>({id:d.id,...d.data()}));
  SETS=(await F.getDocs(F.collection(db,"sets"))).docs.map(d=>({id:d.id,...d.data()}));
  const s=await F.getDocs(F.collection(db,k));
  D=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));
  $("#c").innerHTML=`<h2>Tambah baru</h2><form id="f">${S[k].map(fld).join("")}<button class="p">Simpan</button></form><h2>Daftar (${s.size})</h2>`
    +s.docs.map(d=>{const x=d.data();
      const title=k=="categories"?path(cats.find(c=>c.id==d.id)):(x.title||x.name||x.text);
      const sub=k=="categories"?"":(k=="questions"?sn(x.set):path(cats.find(c=>c.id==x.category)))+" · "+x.status;
      return`<div class="c"><button class="d" onclick="del('${d.id}')">Hapus</button><button class="d" onclick="edit('${d.id}')">Edit</button><b>${esc(title)}</b><br><small>${esc(sub)}</small></div>`}).join("");
  $("#f").onsubmit=async e=>{
    e.preventDefault();
    const o=Object.fromEntries(new FormData(e.target));
    if(k=="questions"){o.options=[o.o0,o.o1,o.o2,o.o3];["o0","o1","o2","o3"].forEach(z=>delete o[z]);o.answer="ABCD".indexOf(o.answer)}
    if("order"in o)o.order=+o.order||0;
    if(eid)await F.setDoc(F.doc(db,k,eid),o);else await F.addDoc(F.collection(db,k),o);
    tab(k);
  };
};

window.edit=id=>{
  eid=id;const x={...D[id]};
  if(cur=="questions"){(x.options||[]).forEach((o,i)=>x["o"+i]=o);x.answer="ABCD"[x.answer]}
  S[cur].forEach(([n])=>{const e=$("#f").elements[n];if(e)e.value=x[n]??""});
  $("#f button").textContent="Simpan perubahan";scrollTo(0,0);
};

window.del=async id=>{
  if(confirm("Hapus item ini?")){await F.deleteDoc(F.doc(db,cur,id));tab(cur)}
};
