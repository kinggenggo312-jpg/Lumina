import{db,F,$,esc}from"./firebase.js";
import{fromCsv,parse}from"./parse.js";

const PDF="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const loadPdf=()=>window.pdfjsLib?Promise.resolve():new Promise((ok,no)=>{
  const s=document.createElement("script");s.src=PDF+"pdf.min.js";
  s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc=PDF+"pdf.worker.min.js";ok()};
  s.onerror=()=>no(new Error("Gagal memuat pembaca PDF. Periksa koneksi internet."));
  document.head.append(s);
});

// Ambil teks PDF per baris (dikelompokkan menurut posisi vertikal)
async function pdfLines(file){
  await loadPdf();
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
  for(let p=1;p<=pdf.numPages;p++){
    const tc=await(await pdf.getPage(p)).getTextContent(),rows=new Map();
    for(const it of tc.items){const y=Math.round(it.transform[5]/3);(rows.get(y)||rows.set(y,[]).get(y)).push(it)}
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,its])=>out.push(its.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(" ").replace(/\s+/g," ").trim()));
  }
  return out;
}

export function renderImport(box,SETS,sn){
  let items=[];
  box.innerHTML=`<h2>Impor soal</h2><form id="imf" onsubmit="return false">
    <label>Masukkan ke set soal</label><select id="imset">${SETS.map(s=>`<option value="${s.id}">${esc(sn(s.id))}</option>`).join("")||'<option value="">(buat set soal dulu)</option>'}</select>
    <label>Berkas CSV atau PDF</label><input type="file" id="imfile" accept=".csv,.pdf,text/csv,application/pdf">
    <button type="button" class="p" id="imgo">Baca berkas</button></form>
    <p><button type="button" id="imtpl">Unduh templat CSV</button></p>
    <small>CSV: kolom pertanyaan, A, B, C, D, jawaban (A-D), pembahasan. PDF: soal bernomor "1.", pilihan "A." sampai "D.", dan jawaban "Jawaban: B" atau daftar "Kunci Jawaban" di akhir.</small>
    <div id="imout"></div>`;

  $("#imtpl").onclick=()=>{
    const t='pertanyaan,A,B,C,D,jawaban,pembahasan\n"Hasil 2 + 3 adalah ...",4,5,6,7,B,"2 ditambah 3 sama dengan 5"\n';
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+t],{type:"text/csv"}));a.download="templat-soal.csv";a.click();
  };

  $("#imgo").onclick=async()=>{
    const f=$("#imfile").files[0],o=$("#imout");
    if(!f)return o.innerHTML='<p class="empty">Pilih berkas dulu.</p>';
    o.innerHTML='<p class="empty">Membaca berkas…</p>';
    try{items=/\.pdf$/i.test(f.name)?parse(await pdfLines(f)):fromCsv(await f.text())}
    catch(e){return o.innerHTML=`<p class="empty">${esc(e.message)}</p>`}
    if(!items.length)return o.innerHTML='<p class="empty">Tidak ada soal yang terbaca. Periksa format berkas. PDF hasil scan (berupa gambar) tidak bisa dibaca.</p>';
    preview();
  };

  const preview=()=>{
    $("#imout").innerHTML=`<h2>Pratinjau (${items.length} soal)</h2>`+items.map((q,i)=>`<div class="c">
      <label style="margin:0"><input type="checkbox" data-i="${i}" checked style="width:auto"> Soal ${i+1}</label>
      <p>${esc(q.text)}</p>${q.options.map((o,k)=>`<small>${"ABCD"[k]}. ${esc(o)}</small><br>`).join("")}
      <label>Jawaban benar</label><select data-a="${i}"><option value="-1">(pilih)</option>${q.options.map((_,k)=>`<option value="${k}"${q.answer==k?" selected":""}>${"ABCD"[k]}</option>`).join("")}</select></div>`).join("")
      +`<button class="p" id="imsave">Simpan soal terpilih</button>`;
    $("#imsave").onclick=save;
  };

  const save=async()=>{
    const set=$("#imset").value;if(!set)return alert("Pilih set soal dulu.");
    const pick=items.map((q,i)=>({q,i,a:+document.querySelector(`[data-a="${i}"]`).value})).filter(p=>document.querySelector(`[data-i="${p.i}"]`).checked);
    if(!pick.length)return alert("Tidak ada soal yang dicentang.");
    const bad=pick.filter(p=>p.a<0).length;
    if(bad)return alert(bad+" soal belum dipilih jawaban benarnya.");
    $("#imsave").disabled=true;const t=Date.now();
    try{
      for(let n=0;n<pick.length;n+=400){
        const b=F.writeBatch(db);
        pick.slice(n,n+400).forEach(({q,a},j)=>b.set(F.doc(F.collection(db,"questions")),{set,text:q.text,options:q.options,answer:a,explain:q.explain||"",status:"aktif",createdAt:t+pick.length-n-j}));
        await b.commit();
      }
      $("#imout").innerHTML=`<p class="empty">${pick.length} soal berhasil disimpan. Lihat di tab Soal.</p>`;
    }catch(e){$("#imsave").disabled=false;alert("Gagal menyimpan: "+e.message)}
  };
}
