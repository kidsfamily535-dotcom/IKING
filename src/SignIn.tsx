import {useState} from 'react';
import {sb} from './lib/supabase';
import type {Role} from './data/types';
import {useI18n,isLang,type Lang} from './i18n';
export default function SignIn({onDone}:{onDone:(r:Role,pl?:Lang)=>void}){
 const {t}=useI18n();const [em,setEm]=useState(''),[pw,setPw]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const go=async(up:boolean)=>{setBusy(true);setMsg('');
  const r=up?await sb.auth.signUp({email:em,password:pw}):await sb.auth.signInWithPassword({email:em,password:pw});
  if(r.error){setMsg(r.error.message);setBusy(false);return}
  if(!r.data.session){setMsg(t('si.created'));setBusy(false);return}
  const {data}=await sb.from('profiles').select('role,status,preferred_language').eq('id',r.data.user!.id).single();
  setBusy(false);
  if(!data||data.status!=='active'){setMsg(t('si.pending'));return}
  onDone(data.role==='admin'||data.role==='broker'?'admin':data.role==='operator'?'operator':'customer',isLang(data.preferred_language)?data.preferred_language:undefined)};
 return <div style={{width:'100%',maxWidth:340,margin:'18px auto 0',textAlign:'start'}}>
  <div className="f2" style={{gridTemplateColumns:'1fr'}}><label>{t('si.email')}<input type="email" value={em} onChange={e=>setEm(e.target.value)} autoComplete="email"/></label>
  <label>{t('si.password')}<input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password"/></label></div>
  <div className="roles"><button disabled={busy||!em||pw.length<8} onClick={()=>go(false)}>{t('si.in')}</button><button className="g" disabled={busy||!em||pw.length<8} onClick={()=>go(true)}>{t('si.up')}</button></div>
  {msg&&<div className="nt" role="alert">{msg}</div>}</div>;
}
