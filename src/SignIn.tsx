import {useState} from 'react';
import {sb} from './lib/supabase';
import type {Role} from './data/types';
import {useI18n,type Lang} from './i18n';
// دخول فوري بالإيميل: رابط يصلك، تفتحه فتدخل. لا كلمة سر. الحساب الجديد يُنشأ عميلًا مفعّلًا تلقائيًا (من القاعدة)،
// وعند العودة من الرابط يستعيد App.tsx الجلسة والدور من جدول profiles.
export default function SignIn(_:{onDone:(r:Role,pl?:Lang)=>void}){
 const {t}=useI18n();const [em,setEm]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const go=async()=>{setBusy(true);setMsg('');
  const r=await sb.auth.signInWithOtp({email:em.trim(),options:{emailRedirectTo:location.origin}});
  setBusy(false);if(r.error){setMsg(t('gate.err'));return}setSent(true);setMsg(t('gate.sent'))};
 return <div style={{width:'100%',maxWidth:340,margin:'18px auto 0',textAlign:'start'}}>
  <div className="f2" style={{gridTemplateColumns:'1fr'}}><label>{t('si.email')}<input type="email" value={em} onChange={e=>{setEm(e.target.value);setSent(false)}} onKeyDown={e=>e.key==='Enter'&&em.includes('@')&&!busy&&go()} autoComplete="email"/></label></div>
  <div className="roles"><button disabled={busy||!em.includes('@')||sent} onClick={go}>{t('gate.send')}</button></div>
  {msg&&<div className="nt" role="status">{msg}</div>}</div>;
}
