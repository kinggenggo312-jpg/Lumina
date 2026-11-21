import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import{getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import*as F from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app=initializeApp({
  apiKey:"AIzaSyDVwIgJwmZ8mS8thnEI-dkddvMSS34iq28",
  authDomain:"lumina-97bbd.firebaseapp.com",
  projectId:"lumina-97bbd",
  storageBucket:"lumina-97bbd.firebasestorage.app",
  messagingSenderId:"293950198704",
  appId:"1:293950198704:web:e3a98b24386a7d9ac13c75"
});

export const auth=getAuth(app),db=F.getFirestore(app);
export{signOut,onAuthStateChanged,F};
export const login=()=>{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});return signInWithPopup(auth,p)};
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// Buat dokumen user saat pertama login; kembalikan role ("user" / "admin")
export async function ensureUser(u){
  const r=F.doc(db,"users",u.uid),s=await F.getDoc(r);
  if(!s.exists()){await F.setDoc(r,{name:u.displayName||"",email:u.email||"",role:"user"});return"user"}
  return s.data().role||"user";
}

// Ubah link YouTube / Google Drive menjadi alamat embed
export function embed(m){
  const b=m.body||"";
  if(m.type=="video"){const x=b.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);return x?"https://www.youtube.com/embed/"+x[1]:""}
  const d=b.match(/\/d\/([\w-]+)/)||b.match(/[?&]id=([\w-]+)/);
  return d?"https://drive.google.com/file/d/"+d[1]+"/preview":"";
}
