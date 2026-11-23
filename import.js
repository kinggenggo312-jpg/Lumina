import{db,F,$,esc}from"./firebase.js";
import{fromCsv,parse}from"./parse.js";
import{rich,typeset,imgTag}from"./rich.js";

const PDF="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/",TESS="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",LT="ABCDEFGH";
const loaded={};
const loadScript=(src,after)=>loaded[src]||(loaded[src]=new Promise((ok,no)=>{
  const s=document.createElement("script");s.src=src;
  s.onload=()=>{after&&after();ok()};s.onerror=()=>no(new Error("Gagal memuat pustaka pembaca. Periksa koneksi internet."));
  document.head.append(s);
}));

// OCR untuk gambar dan halaman PDF hasil scan
async function ocr(src,say){
  await loadScript(TESS);
  const r=await Tesseract.recognize(src,"ind+eng",{logger:m=>{if(m.status=="recognizing text")say("Membaca gambar (OCR)… "+Math.round(m.progress*100)+"%")}});
  return r.data.text.split("\n");
}

async function pdfLines(file,say){
  await loadScript(PDF+"pdf.min.js",()=>pdfjsLib.GlobalWorkerOptions.workerSrc=PDF+"pdf.worker.min.js");
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),items=(await page.getTextContent()).items.filter(i=>i.str.trim());
    if(items.reduce((n,i)=>n+i.str.length,0)<15){
      say(`Halaman ${p} dari ${pdf.numPages} berupa gambar, memakai OCR…`);
      const vp=page.getViewport({scale:2}),cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;
      await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
      out.push(...await ocr(cv,say));continue;
    }
    const minX=Math.min(...items.map(i=>i.transform[4])),rows=new Map();
    for(const it of items){const y=Math.round(it.transform[5]/3);(rows.get(y)||rows.set(y,[]).get(y)).push(it)}
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,its])=>{
      its.sort((a,b)=>a.transform[4]-b.transform[4]);
      out.push(" ".repeat(Math.max(0,Math.round((its[0].transform[4]-minX)/6)))+its.map(i=>i.str).join(" ").replace(/\s+/g," ").trim());
    });
  }
  return out;
}

export function renderImport(box,SETS,sn){
  let items=[];
  const say=t=>$("#imout").innerHTML=`<p class="empty">${t}</p>`;
  box.innerHTML=`<h2>Impor soal</h2><form id="imf" onsubmit="return false">
    <label>Masukkan ke set soal</label><select id="imset">${SETS.map(s=>`<option value="${s.id}">${esc(sn(s.id))}</option>`).join("")||'<option value="">(buat set soal dulu)</option>'}</select>
    <label>Berkas CSV, PDF, atau gambar (JPG/PNG)</label><input type="file" id="imfile" accept=".csv,.pdf,.png,.jpg,.jpeg,.webp,text/csv,application/pdf,image/*">
    <button type="button" class="p" id="imgo">Baca berkas</button></form>
    <p><button type="button" id="imtpl">Unduh templat CSV</button></p>
    <small>CSV: kolom tipe, pertanyaan, A sampai H, jawaban, pembahasan. Tipe: pg, pgk, bs, essay. Jawaban pgk: A,C. Kode: pakai tanda \`\`\` dan rumus: $...$ (LaTeX). PDF atau gambar: soal bernomor "1.", pilihan "A.", "Jawaban: B", bagian "Essay" atau "Benar Salah", dan "Kunci Jawaban".</small>
    <div id="imout"></div>`;

  $("#imtpl").onclick=()=>{
    const t='tipe,pertanyaan,A,B,C,D,E,jawaban,pembahasan\npg,"Hasil 2 + 3 adalah ...",4,5,6,7,,B,"2 ditambah 3 sama dengan 5"\npgk,"Pilih bilangan prima:",2,4,5,9,,"A,C",\nbs,"Matahari terbit dari barat.",,,,,,Salah,\nessay,"Jelaskan fungsi akar pada tumbuhan.",,,,,,"Menyerap air dan mineral",\npg,"Hasil kode ini?\n```\nprint(2**3)\n```",6,8,9,,,B,"2 pangkat 3 = 8"\npg,"Nilai $x$ jika $2x=10$ adalah ...",2,5,10,,,B,\n';
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+t],{type:"text/csv"}));a.download="templat-soal.csv";a.click();
  };

  $("#imgo").onclick=async()=>{
    const f=$("#imfile").files[0];
    if(!f)return say("Pilih berkas dulu.");
    say("Membaca berkas…");
    try{
      items=/\.pdf$/i.test(f.name)?parse(await pdfLines(f,say)):/\.(png|jpe?g|webp)$/i.test(f.name)||f.type.startsWith("image/")?parse(await ocr(f,say)):fromCsv(await f.text());
    }catch(e){return say(esc(e.message))}
    if(!items.length)return say("Tidak ada soal yang terbaca. Periksa format berkas, atau gunakan CSV untuk soal yang rumit.");
    preview();
  };

  const ctl=(q,i)=>q.type=="pgk"?`<label>Jawaban benar (boleh lebih dari satu)</label>${q.options.map((_,k)=>`<label style="font-weight:400"><input type="checkbox" data-c="${i}" value="${k}" style="width:auto"${q.answers.includes(k)?" checked":""}> ${LT[k]}</label>`).join("")}`
    :q.type=="essay"?`<label>Kunci jawaban</label><textarea data-k="${i}">${esc(q.key||"")}</textarea>`
    :`<label>Jawaban benar</label><select data-a="${i}"><option value="-1">(pilih)</option>${(q.type=="bs"?["Benar","Salah"]:q.options.map((_,k)=>LT[k])).map((n,k)=>`<option value="${k}"${q.answer==k?" selected":""}>${n}</option>`).join("")}</select>`;

  const preview=()=>{
    $("#imout").innerHTML=`<h2>Pratinjau (${items.length} soal)</h2>`+items.map((q,i)=>`<div class="c">
      <label style="margin:0"><input type="checkbox" data-i="${i}" checked style="width:auto"> Soal ${i+1} <small>(${q.type})</small></label>
      <div>${rich(q.text)}</div>${imgTag(q.img)}${q.type=="bs"?"":q.options.map((o,k)=>`<small>${LT[k]}. </small>${rich(o)}<br>`).join("")}${ctl(q,i)}</div>`).join("")
      +`<button class="p" id="imsave">Simpan soal terpilih</button>`;
    typeset($("#imout"));$("#imsave").onclick=save;
  };

  const save=async()=>{
    const set=$("#imset").value;if(!set)return alert("Pilih set soal dulu.");
    const pick=items.map((q,i)=>({q,i})).filter(p=>document.querySelector(`[data-i="${p.i}"]`).checked);
    if(!pick.length)return alert("Tidak ada soal yang dicentang.");
    const docs=[];let bad=0;
    pick.forEach(({q,i})=>{
      const o={set,type:q.type,text:q.text,explain:q.explain||"",status:"aktif"};if(q.img)o.img=q.img;
      if(q.type=="essay")o.key=document.querySelector(`[data-k="${i}"]`).value.trim();
      else{
        o.options=q.options;
        if(q.type=="pgk"){o.answers=[...document.querySelectorAll(`[data-c="${i}"]:checked`)].map(e=>+e.value);if(!o.answers.length)bad++}
        else{o.answer=+document.querySelector(`[data-a="${i}"]`).value;if(o.answer<0)bad++}
      }
      docs.push(o);
    });
    if(bad)return alert(bad+" soal belum dipilih jawaban benarnya.");
    $("#imsave").disabled=true;const t=Date.now();
    try{
      for(let n=0;n<docs.length;n+=400){
        const b=F.writeBatch(db);
        docs.slice(n,n+400).forEach((o,j)=>b.set(F.doc(F.collection(db,"questions")),{...o,createdAt:t+docs.length-n-j}));
        await b.commit();
      }
      say(`${docs.length} soal berhasil disimpan. Lihat di tab Soal.`);
    }catch(e){$("#imsave").disabled=false;alert("Gagal menyimpan: "+e.message)}
  };
}
