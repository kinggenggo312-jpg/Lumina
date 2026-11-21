const L="ABCD";

// Pembaca CSV (mendukung koma atau titik koma, tanda kutip, baris baru di dalam sel)
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

// Kolom: pertanyaan, A, B, C, D, jawaban (A-D atau 1-4), pembahasan
export function fromCsv(text){
  const rows=csv(text);
  if(rows.length&&/^(pertanyaan|soal|question)/i.test(rows[0][0].trim()))rows.shift();
  return rows.map(r=>{
    const c=r.map(x=>(x||"").trim());
    const opts=[c[1],c[2],c[3],c[4]];
    while(opts.length&&!opts.at(-1))opts.pop();
    let a=L.indexOf((c[5]||"").charAt(0).toUpperCase());
    if(a<0&&/^[1-4]/.test(c[5]||""))a=+c[5].charAt(0)-1;
    if(a>=opts.length)a=-1;
    return{text:c[0],options:opts,answer:a,explain:c[6]||""};
  }).filter(q=>q.text&&q.options.length>=2&&q.options.every(Boolean));
}

// Soal bernomor ("1."), pilihan "A." sampai "D.", jawaban "Jawaban: B" atau daftar "Kunci Jawaban"
export function parse(lines){
  lines=lines.flatMap(l=>/^\(?[A-Da-d][.)]\s/.test(l.trim())?l.trim().split(/\s+(?=[B-D][.)]\s)/):[l]);
  const Q=[];let cur=null,mode="q";
  const push=()=>{if(cur&&cur.text&&cur.options.length>=2)Q.push(cur);cur=null};
  const keyAt=lines.findIndex(l=>/kunci\s+jawaban/i.test(l));
  for(const raw of keyAt>=0?lines.slice(0,keyAt):lines){
    const l=raw.trim();if(!l)continue;let m;
    if(m=l.match(/^(\d{1,3})\s*[.)]\s+(.+)/)){push();cur={no:+m[1],text:m[2],options:[],answer:-1,explain:""};mode="q"}
    else if(!cur)continue;
    else if(m=l.match(/^\(?([A-Da-d])[.)]\s*(.+)/)){const k=L.indexOf(m[1].toUpperCase());cur.options[k]=m[2];mode="o"+k}
    else if(m=l.match(/^(?:jawaban|kunci)(?:\s+benar)?\s*[:=]\s*\(?([A-Da-d])/i)){cur.answer=L.indexOf(m[1].toUpperCase());mode="x"}
    else if(m=l.match(/^(?:pembahasan|penjelasan)\s*[:=]?\s*(.*)/i)){cur.explain=m[1];mode="e"}
    else if(mode=="q")cur.text+=" "+l;
    else if(mode[0]=="o")cur.options[+mode[1]]+=" "+l;
    else if(mode=="e")cur.explain+=" "+l;
  }
  push();
  if(keyAt>=0){
    const map={};
    for(const m of lines.slice(keyAt+1).join(" ").matchAll(/(\d{1,3})\s*[.:)\-]?\s*([A-Da-d])\b/g))map[+m[1]]=L.indexOf(m[2].toUpperCase());
    Q.forEach(q=>{if(q.answer<0&&map[q.no]!==undefined)q.answer=map[q.no]});
  }
  return Q.map(q=>({...q,options:[0,1,2,3].map(i=>q.options[i]).filter(x=>x!==undefined)})).filter(q=>q.options.length>=2);
}
