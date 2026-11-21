import{auth,db,F,login,signOut,onAuthStateChanged,$,esc,ensureUser}from"./firebase.js";
import{renderImport}from"./import.js";
let cats=[],SETS=[],D={},cur="categories",eid=null;

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

// ===== Import soal dari CSV =====
const csv=(t,d)=>{const R=[];let r=[],c="",q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch=='"')q=true;
    else if(ch==d){r.push(c);c=""}
    else if(ch=="\n"||ch=="\r"){if(ch=="\r"&&t[i+1]=="\n")i++;r.push(c);c="";if(r.some(x=>x.trim()))R.push(r);r=[]}
    else c+=ch}
  r.push(c);if(r.some(x=>x.trim()))R.push(r);return R};
const imp=()=>SETS.length?`<h2>Import dari CSV</h2><form id="imp"><label>Set soal tujuan</label><select name="set">${SETS.map(s=>`<option value="${s.id}">${esc(sn(s.id))}</option>`).join("")}</select><label>File CSV</label><input type="file" name="f" accept=".csv,text/csv" required><p><small>Kolom: pertanyaan, A, B, C, D, jawaban (A-D), pembahasan. <a href="#" id="tpl">Unduh template</a></small></p><button class="p">Import</button></form><p id="imsg"></p>`:"";
const bindImp=()=>{
  const f=$("#imp");if(!f)return;
  $("#tpl").onclick=e=>{e.preventDefault();const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(["\uFEFFpertanyaan,A,B,C,D,jawaban,pembahasan\n\"2 + 2 = ?\",3,4,5,6,B,\"Dua ditambah dua sama dengan empat.\"\n"],{type:"text/csv"}));
    a.download="template-soal.csv";a.click()};
  f.onsubmit=async e=>{
    e.preventDefault();
    const m=$("#imsg"),file=f.f.files[0];if(!file)return;
    const t=(await file.text()).replace(/^\uFEFF/,""),l=t.split(/\r?\n/)[0];
    const R=csv(t,(l.match(/;/g)||[]).length>(l.match(/,/g)||[]).length?";":",");
    const head=R.length&&/pertanyaan|soal/i.test(R[0][0]);if(head)R.shift();
    const ok=[],bad=[];
    R.forEach((r,i)=>{const[q,a,b,c,d,ans,ex]=r.map(x=>(x||"").trim()),k="ABCD".indexOf(ans.toUpperCase());
      if(!q||!a||!b||!c||!d||ans.length!=1||k<0)bad.push(i+(head?2:1));
      else ok.push({set:f.set.value,text:q,options:[a,b,c,d],answer:k,explain:ex||"",status:"aktif"})});
    if(!ok.length){m.textContent="Tidak ada soal valid. Periksa format kolom."+(bad.length?" Baris bermasalah: "+bad.slice(0,8).join(", ")+".":"");return}
    m.textContent="Mengimpor "+ok.length+" soal…";
    try{
      const now=Date.now();
      for(let i=0;i<ok.length;i+=20){const w=F.writeBatch(db);
        ok.slice(i,i+20).forEach((x,n)=>w.set(F.doc(F.collection(db,"questions")),{...x,createdAt:now+i+n}));await w.commit()}
    }catch(err){m.textContent="Gagal mengimpor. Periksa koneksi internet atau aturan Firestore.";return}
    alert(ok.length+" soal berhasil diimpor."+(bad.length?" Baris dilewati: "+bad.slice(0,8).join(", ")+".":""));
    tab("questions");
  };
};

window.tab=async k=>{
  cur=k;eid=null;
  cats=(await F.getDocs(F.collection(db,"categories"))).docs.map(d=>({id:d.id,...d.data()}));
  SETS=(await F.getDocs(F.collection(db,"sets"))).docs.map(d=>({id:d.id,...d.data()}));
  if(k=="import")return renderImport($("#c"),SETS,sn);
  const s=await F.getDocs(F.collection(db,k));
  D=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));
  $("#c").innerHTML=`<h2>Tambah baru</h2><form id="f">${S[k].map(fld).join("")}<button class="p">Simpan</button></form>${k=="questions"?imp():""}<h2>Daftar (${s.size})</h2>`
    +s.docs.sort((a,b)=>(b.data().createdAt||0)-(a.data().createdAt||0)).map(d=>{const x=d.data();
      const title=k=="categories"?path(cats.find(c=>c.id==d.id)):(x.title||x.name||x.text);
      const sub=k=="categories"?"":(k=="questions"?sn(x.set):path(cats.find(c=>c.id==x.category)))+" · "+(x.type?x.type+" · ":"")+x.status;
      return`<div class="c"><button class="d" onclick="del('${d.id}')">Hapus</button><button class="d" onclick="edit('${d.id}')">Edit</button><b>${esc(title)}</b><br><small>${esc(sub)}</small>${x.createdAt?`<br><small>Diunggah ${dt(x.createdAt)}</small>`:""}</div>`}).join("");
  if(k=="questions")bindImp();
  $("#f").onsubmit=async e=>{
    e.preventDefault();
    const o=Object.fromEntries(new FormData(e.target));
    if(k=="questions"){o.options=[o.o0,o.o1,o.o2,o.o3];["o0","o1","o2","o3"].forEach(z=>delete o[z]);o.answer="ABCD".indexOf(o.answer)}
    if("order"in o)o.order=+o.order||0;
    if(eid)await F.setDoc(F.doc(db,k,eid),o,{merge:true});else await F.addDoc(F.collection(db,k),{...o,createdAt:Date.now()});
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
