import{auth,db,F,login,signOut,onAuthStateChanged,$,esc,ensureUser}from"./firebase.js";
let cats=[],cur="categories";

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
  materials:[["category","Kategori","cat"],["title","Judul","text"],["type","Jenis","sel",["teks","video","pdf"]],["body","Isi teks, atau link YouTube / Google Drive","area"],["status","Status","sel",["terbit","draf"]]],
  questions:[["category","Kategori","cat"],["text","Pertanyaan","area"],["o0","Pilihan A","text"],["o1","Pilihan B","text"],["o2","Pilihan C","text"],["o3","Pilihan D","text"],["answer","Jawaban benar","sel",["A","B","C","D"]],["explain","Pembahasan","area"],["status","Status","sel",["aktif","disembunyikan"]]]
};

const path=c=>c?(c.parent?path(cats.find(x=>x.id==c.parent))+" › ":"")+c.name:"";
const fld=([n,l,t,o])=>`<label>${l}</label>`+(
  t=="area"?`<textarea name="${n}"></textarea>`
  :t=="cat"?`<select name="${n}"><option value="">(tidak ada)</option>${cats.map(c=>`<option value="${c.id}">${esc(path(c))}</option>`).join("")}</select>`
  :t=="sel"?`<select name="${n}">${o.map(x=>`<option>${x}</option>`).join("")}</select>`
  :`<input name="${n}" type="${t=="num"?"number":"text"}">`);

window.tab=async k=>{
  cur=k;
  cats=(await F.getDocs(F.collection(db,"categories"))).docs.map(d=>({id:d.id,...d.data()}));
  const s=await F.getDocs(F.collection(db,k));
  $("#c").innerHTML=`<h2>Tambah baru</h2><form id="f">${S[k].map(fld).join("")}<button class="p">Simpan</button></form><h2>Daftar (${s.size})</h2>`
    +s.docs.map(d=>{const x=d.data();
      const title=k=="categories"?path(cats.find(c=>c.id==d.id)):(x.title||x.text);
      const sub=k=="categories"?"":path(cats.find(c=>c.id==x.category))+(x.status?` · ${x.status}`:"");
      return`<div class="c"><button class="d" onclick="del('${d.id}')">Hapus</button><b>${esc(title)}</b><br><small>${esc(sub)}</small></div>`}).join("");
  $("#f").onsubmit=async e=>{
    e.preventDefault();
    const o=Object.fromEntries(new FormData(e.target));
    if(k=="questions"){o.options=[o.o0,o.o1,o.o2,o.o3];["o0","o1","o2","o3"].forEach(z=>delete o[z]);o.answer="ABCD".indexOf(o.answer)}
    if("order"in o)o.order=+o.order||0;
    await F.addDoc(F.collection(db,k),o);
    tab(k);
  };
};

window.del=async id=>{
  if(confirm("Hapus item ini?")){await F.deleteDoc(F.doc(db,cur,id));tab(cur)}
};
