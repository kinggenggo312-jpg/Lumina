import{$,esc}from"./firebase.js";
const TY=[["pg","Pilihan ganda"],["pgk","Pilihan ganda kompleks"],["bs","Benar / Salah"],["essay","Essay"]];
// Formulir soal: jumlah pilihan bisa ditambah/dikurangi, bentuk jawaban menyesuaikan jenis soal
// Perkecil gambar (maks 1000 px, JPEG) agar muat disimpan di database tanpa Storage berbayar
const shrink=file=>new Promise((ok,no)=>{
  const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{
    const k=Math.min(1,1000/Math.max(im.width,im.height)),w=Math.round(im.width*k),h=Math.round(im.height*k),c=document.createElement("canvas");
    c.width=w;c.height=h;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);
    let q=.8,d=c.toDataURL("image/jpeg",q);
    while(d.length>600000&&q>.4){q-=.1;d=c.toDataURL("image/jpeg",q)}
    URL.revokeObjectURL(u);d.length>800000?no(new Error("Gambar terlalu besar, pilih gambar yang lebih kecil.")):ok(d);
  };
  im.onerror=()=>no(new Error("Berkas bukan gambar yang valid."));im.src=u;
});
export function questionForm(box,SETS,sn,init,save,pre){
  const x={...(pre||{}),...(init||{})};let type=x.type||"pg";
  let opts=(x.options&&x.options.length&&type!="bs"?x.options:["",""]).map((t,i)=>({t,c:type=="pgk"?(x.answers||[]).includes(i):type=="pg"&&x.answer===i}));
  let bs=type=="bs"&&x.answer==1?1:0;
  const sync=()=>{
    const f=$("#qf2");if(!f)return;const g=n=>f.elements[n];
    Object.assign(x,{set:g("set").value,text:g("text").value,explain:g("explain").value,status:g("status").value});
    if(g("key"))x.key=g("key").value;
    if(g("bs"))bs=+g("bs").value;
    const ts=[...f.querySelectorAll("[data-t]")];
    if(ts.length)opts=ts.map(e=>({t:e.value,c:f.querySelector(`[data-i="${e.dataset.t}"]`).checked}));
  };
  const draw=()=>{
    box.innerHTML=`<form id="qf2"><label>Set soal</label><select name="set">${SETS.map(s=>`<option value="${s.id}"${s.id==x.set?" selected":""}>${esc(sn(s.id))}</option>`).join("")}</select>
    <label>Jenis soal</label><select id="qt">${TY.map(([v,n])=>`<option value="${v}"${v==type?" selected":""}>${n}</option>`).join("")}</select>
    <label>Pertanyaan <small>(kode: ketik di antara \`\`\` ... \`\`\`, rumus: $...$ gaya LaTeX)</small></label><textarea name="text">${esc(x.text||"")}</textarea>
    <label>Gambar soal <small>(opsional)</small></label>${x.img?`<img class="qi" src="${x.img}" alt="Gambar soal"><button type="button" id="qrm" class="d" style="float:none">Hapus gambar</button>`:""}<input type="file" id="qimg" accept="image/*">
    ${type=="pg"||type=="pgk"?`<label>Pilihan jawaban (tandai yang benar)</label>${opts.map((o,i)=>`<div class="orow"><input type="${type=="pg"?"radio":"checkbox"}" name="ok" data-i="${i}"${o.c?" checked":""}><input data-t="${i}" value="${esc(o.t)}" placeholder="Pilihan ${i+1}"><button type="button" class="d" data-r="${i}">Hapus</button></div>`).join("")}<button type="button" id="qadd" style="margin-top:8px">+ Tambah pilihan</button>`
    :type=="bs"?`<label>Jawaban benar</label><select name="bs"><option value="0"${bs?"":" selected"}>Benar</option><option value="1"${bs?" selected":""}>Salah</option></select>`
    :`<label>Kunci jawaban / rubrik</label><textarea name="key">${esc(x.key||"")}</textarea>`}
    <label>Pembahasan</label><textarea name="explain">${esc(x.explain||"")}</textarea>
    <label>Status</label><select name="status">${["aktif","disembunyikan"].map(s=>`<option${s==(x.status||"aktif")?" selected":""}>${s}</option>`).join("")}</select>
    <button class="p">${init?"Simpan perubahan":"Simpan"}</button></form>`;
    $("#qt").onchange=e=>{sync();type=e.target.value;draw()};
    $("#qimg").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=await shrink(f);sync();x.img=d;draw()}catch(er){alert(er.message);e.target.value=""}};
    const rm=$("#qrm");if(rm)rm.onclick=()=>{sync();delete x.img;draw()};
    const a=$("#qadd");if(a)a.onclick=()=>{sync();opts.push({t:"",c:false});draw()};
    box.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{sync();if(opts.length>2){opts.splice(+b.dataset.r,1);draw()}else alert("Minimal 2 pilihan.")});
    $("#qf2").onsubmit=async e=>{
      e.preventDefault();sync();
      const o={set:x.set,type,text:(x.text||"").trim(),explain:(x.explain||"").trim(),status:x.status||"aktif"};
      if(!o.text&&!x.img)return alert("Isi pertanyaan atau tambahkan gambar soal.");
      if(x.img)o.img=x.img;
      if(type=="pg"||type=="pgk"){
        const L=opts.filter(p=>p.t.trim()),c=L.map((p,i)=>p.c?i:-1).filter(i=>i>=0);
        if(L.length<2)return alert("Minimal 2 pilihan yang terisi.");
        if(!c.length)return alert("Tandai jawaban yang benar.");
        o.options=L.map(p=>p.t.trim());
        if(type=="pg")o.answer=c[0];else o.answers=c;
      }else if(type=="bs"){o.options=["Benar","Salah"];o.answer=bs}
      else o.key=(x.key||"").trim();
      await save(o);
    };
  };
  draw();
}
