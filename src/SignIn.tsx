import {useState} from 'react';
import {sb} from './lib/supabase';
import type {Role} from './data/types';
export default function SignIn({onDone}:{onDone:(r:Role)=>void}){
 const [em,setEm]=useState(''),[pw,setPw]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const go=async(up:boolean)=>{setBusy(true);setMsg('');
  const r=up?await sb.auth.signUp({email:em,password:pw}):await sb.auth.signInWithPassword({email:em,password:pw});
  if(r.error){setMsg(r.error.message);setBusy(false);return}
  if(!r.data.session){setMsg('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم ادخل.');setBusy(false);return}
  const {data}=await sb.from('profiles').select('role,status').eq('id',r.data.user!.id).single();
  setBusy(false);
  if(!data||data.status!=='active'){setMsg('حسابك في انتظار التفعيل من الفريق.');return}
  onDone(data.role==='admin'||data.role==='broker'?'admin':data.role==='operator'?'operator':'customer')};
 return <div style={{width:'100%',maxWidth:340,margin:'18px auto 0',textAlign:'start'}}>
  <div className="f2" style={{gridTemplateColumns:'1fr'}}><label>البريد<input type="email" value={em} onChange={e=>setEm(e.target.value)} autoComplete="email"/></label>
  <label>كلمة المرور<input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password"/></label></div>
  <div className="roles"><button disabled={busy||!em||pw.length<8} onClick={()=>go(false)}>دخول</button><button className="g" disabled={busy||!em||pw.length<8} onClick={()=>go(true)}>حساب جديد</button></div>
  {msg&&<div className="nt" role="alert">{msg}</div>}</div>;
}
