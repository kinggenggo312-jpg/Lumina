const L="ABCDEFGH";
export function csv(text){
  text=text.replace(/^\uFEFF/,"");
  const first=text.split("\n")[0],d=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",";
  const rows=[];let r=[],f="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){if(c=='"'){if(text[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
    else if(c=='"')q=true;
    else if(c==d){r.push(f);f=""}
    else if(c=="\n"){r.push(f);rows.push(r);r=[];f=""}
    else if(c!="\r")f+=c;
  }
  if(f||r.length){r.push(f);rows.push(r)}
  return rows.filter(x=>x.some(y=>y.trim()));
}
const letters=(s,n)=>[...new Set(String(s||"").split(/[\s,;&|]+/).filter(Boolean).flatMap(t=>t.length>1&&/^[A-Ha-h]+$/.test(t)?[...t]:[t]).map(t=>/^\d$/.test(t)?+t-1:L.indexOf(t.toUpperCase())).filter(i=>i>=0&&i<n))];
const TF=a=>/^(b|benar|true|t)$/i.test(a.trim())?0:/^(s|salah|false|f)$/i.test(a.trim())?1:-1;
const TYPE=s=>{s=s.toLowerCase();return/kompleks|pgk/.test(s)?"pgk":/benar|salah|^bs$|true/.test(s)?"bs":/essay|esai|uraian/.test(s)?"essay":/pilihan|^pg$|multiple/.test(s)?"pg":""};

// CSV: baris judul memakai nama kolom: tipe, pertanyaan, A..H, jawaban, pembahasan (tanpa judul: pertanyaan,A,B,C,D,jawaban,pembahasan)
export function fromCsv(text){
  const rows=csv(text);if(!rows.length)return[];
  const hd=rows[0].map(x=>x.trim().toLowerCase()),has=/^(tipe|type|jenis|pertanyaan|soal|question)$/.test(hd[0]);
  const ix=re=>has?hd.findIndex(h=>re.test(h)):-1;
  const ti=has?ix(/^(pertanyaan|soal|question)$/):0,yi=ix(/^(tipe|type|jenis)$/),ai=has?ix(/^(jawaban|kunci|answer)$/):5,ei=has?ix(/^(pembahasan|penjelasan)$/):6;
  const oi=has?hd.map((h,i)=>/^[a-h]$/.test(h)?i:-1).filter(i=>i>=0):[1,2,3,4];
  const gi=ix(/^(gambar|image|img)$/);
  return rows.slice(has?1:0).map(r=>{
    const g=i=>(i>=0?r[i]||"":"").trim(),a=g(ai),opts=oi.map(g);
    while(opts.length&&!opts.at(-1))opts.pop();
    let type=TYPE(g(yi));
    if(!type)type=opts.length>=2?(letters(a,opts.length).length>1?"pgk":"pg"):TF(a)>=0?"bs":"essay";
    const q={type,text:g(ti),options:[],answer:-1,answers:[],key:"",explain:g(ei),img:/^https:\/\//.test(g(gi))?g(gi):""};
    if(type=="pg"||type=="pgk"){q.options=opts;const l=letters(a,opts.length);if(type=="pg")q.answer=l.length?l[0]:-1;else q.answers=l}
    else if(type=="bs"){q.options=["Benar","Salah"];q.answer=TF(a)}
    else q.key=a;
    return q;
  }).filter(q=>q.text&&(q.type=="pg"||q.type=="pgk"?q.options.length>=2&&q.options.every(Boolean):true));
}

// Teks/PDF/OCR: soal bernomor "1.", pilihan "A." dst, "Jawaban: B" atau "Jawaban: A, C", bagian "Essay"/"Benar Salah", dan "Kunci Jawaban"
export function parse(lines){
  lines=lines.flatMap(l=>/^\s*\(?[A-Ha-h][.)]\s/.test(l)?l.trim().split(/\s+(?=[B-H][.)]\s)/):[l]);
  const code=l=>/[{};]\s*$|=>|==|!=|\(\)|\b(def|function|return|import|print|printf|console|System|include|public|void)\b.*[(;:{]/.test(l);
  const Q=[];let cur=null,mode="q",sec="pg";
  const fin=q=>{
    const out=[];let t=[],c=[];
    const ft=()=>{if(t.length)out.push(t.join(" "));t=[]},fc=()=>{if(c.length){const i=Math.min(...c.map(x=>x.search(/\S|$/)));out.push("```\n"+c.map(x=>x.slice(i)).join("\n")+"\n```")}c=[]};
    for(const{s,k}of q.tl){if(k){ft();c.push(s)}else{fc();t.push(s.trim())}}
    ft();fc();q.text=out.join("\n");delete q.tl;
    if(q.options.length>=2)q.type=q.answers.length>1?"pgk":"pg";
    if(q.type=="bs")q.options=["Benar","Salah"];
    q.options=[0,1,2,3,4,5,6,7].map(i=>q.options[i]).filter(x=>x!==undefined);
  };
  const push=()=>{if(cur){fin(cur);if(cur.text&&(cur.type=="pg"?cur.options.length>=2:true))Q.push(cur)}cur=null};
  const keyAt=lines.findIndex(l=>/kunci\s+jawaban/i.test(l));
  for(const raw of keyAt>=0?lines.slice(0,keyAt):lines){
    const l=raw.trim();if(!l)continue;let m;
    if(l.length<60&&!/^\d/.test(l)&&/^(\w+\s*[.:)-]\s*)?(bagian\s+\w+\s*[:.-]?\s*)?(soal\s+)?(essay|esai|uraian)\b/i.test(l)){push();sec="essay";continue}
    if(l.length<60&&!/^\d/.test(l)&&/benar\s*[\/&-]?\s*salah/i.test(l)){push();sec="bs";continue}
    if(l.length<60&&!/^\d/.test(l)&&/pilihan\s+ganda/i.test(l)){push();sec="pg";continue}
    if(m=l.match(/^(\d{1,3})\s*[.)]\s+(.+)/)){push();cur={no:+m[1],type:sec,tl:[{s:m[2],k:code(m[2])}],options:[],answer:-1,answers:[],key:"",explain:""};mode="q"}
    else if(!cur)continue;
    else if(m=l.match(/^\(?([A-Ha-h])[.)]\s*(.+)/)){const k=L.indexOf(m[1].toUpperCase());cur.options[k]=m[2];mode="o"+k}
    else if(m=l.match(/^(?:jawaban|kunci)(?:\s+benar)?\s*[:=]\s*(.+)/i)){
      const v=m[1].trim();mode="x";
      if(cur.options.length<2&&cur.type=="essay"){cur.key=v;mode="k"}
      else if(cur.options.length<2&&cur.type=="bs")cur.answer=TF(v.split(/[\s.,]/)[0]);
      else{const ls=letters(v.split(/[.]\s/)[0],8);if(ls.length>1)cur.answers=ls;else if(ls.length)cur.answer=ls[0]}
    }
    else if(m=l.match(/^(?:pembahasan|penjelasan)\s*[:=]?\s*(.*)/i)){cur.explain=m[1];mode="e"}
    else if(mode=="q")cur.tl.push({s:raw,k:code(l)});
    else if(mode[0]=="o")cur.options[+mode[1]]+=" "+l;
    else if(mode=="e")cur.explain+=" "+l;
    else if(mode=="k")cur.key+=" "+l;
  }
  push();
  if(keyAt>=0){
    const map={};
    for(const m of lines.slice(keyAt+1).join(" ").matchAll(/(\d{1,3})\s*[.:)\-]?\s*([A-Ha-h](?:\s*[,&]\s*[A-Ha-h])*)\b/g))map[+m[1]]=letters(m[2],8);
    Q.forEach(q=>{const k=map[q.no];if(!k||!k.length||(q.answer>=0||q.answers.length))return;if(k.length>1){q.type="pgk";q.answers=k}else q.answer=k[0]});
  }
  return Q;
}
