import {useState} from 'react';
import {sb} from '../lib/supabase';
// دخول الأدمن بالكامل: كلمة سر ← كود المصادقة، مع «أول مرة أو نسيت كلمة السر» وتفعيل تطبيق المصادقة (QR). بديل صفحة مركز القيادة القديمة.
type V='login'|'code'|'enroll';
const REDIR=()=>location.origin+'/?view=admin';
export function Login({onDone}:{onDone:()=>void}){
 const [e,setE]=useState(''),[p,setP]=useState(''),[code,setCode]=useState(''),[fid,setFid]=useState(''),[v,setV]=useState<V>('login'),[qr,setQr]=useState(''),[sec,setSec]=useState(''),[m,setM]=useState(''),[ok,setOk]=useState(''),[b,setB]=useState(false);
 const after=async()=>{
  const a=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(a.data?.currentLevel==='aal2'){onDone();return}
  const l=await sb.auth.mfa.listFactors();const t=l.data?.totp?.find(x=>x.status==='verified');
  if(t){setFid(t.id);setV('code');return}
  for(const x of l.data?.all??[])if(x.factor_type==='totp'&&x.status!=='verified')await sb.auth.mfa.unenroll({factorId:x.id});
  const r=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'owner-'+Date.now()});
  if(r.error||!r.data){setM('تعذّر تفعيل المصادقة: '+(r.error?.message??''));return}
  setFid(r.data.id);setQr(r.data.totp.qr_code);setSec(r.data.totp.secret);setV('enroll')};
 const login=async()=>{setB(true);setM('');setOk('');const r=await sb.auth.signInWithPassword({email:e.trim(),password:p});if(r.error){setB(false);setM('البريد أو كلمة السر غير صحيحة.');return}await after();setB(false)};
 const verify=async()=>{setB(true);setM('');const r=await sb.auth.mfa.challengeAndVerify({factorId:fid,code:code.trim()});setB(false);if(r.error){setM('الكود غير صحيح أو منتهي. جرّب الكود التالي.');return}onDone()};
 const forgot=async()=>{if(!e.includes('@')){setM('اكتب بريدك أولًا.');return}setB(true);setM('');setOk('');
  const r=await sb.auth.resetPasswordForEmail(e.trim(),{redirectTo:REDIR()});setB(false);
  if(r.error){setM(r.error.status===429?'وصلنا للحد المجاني لرسائل الإيميل في Supabase. انتظر نحو ساعة وجرّب تاني.':'تعذّر الإرسال. حاول بعد دقيقة.');return}
  setOk('لو البريد مسجّل، وصلك رابط لضبط كلمة السر.')};
 return <div className="ad-login" dir="rtl"><h1>لوحة الأدمن</h1><p className="sub">I JET</p>
  {m&&<div className="ad-err" role="alert">{m}</div>}{ok&&<p role="status" style={{color:'#174C3A'}}>{ok}</p>}
  {v==='login'&&<><label htmlFor="ad-e">البريد</label><input id="ad-e" type="email" dir="ltr" value={e} onChange={x=>setE(x.target.value)} autoComplete="username"/>
   <label htmlFor="ad-p">كلمة السر</label><input id="ad-p" type="password" dir="ltr" value={p} onChange={x=>setP(x.target.value)} autoComplete="current-password" onKeyDown={x=>x.key==='Enter'&&login()}/>
   <button className="p" disabled={b||!e||!p} onClick={login} type="button">دخول</button>
   <p style={{fontSize:13,marginTop:14}}><button type="button" className="ad-link" onClick={forgot} disabled={b}>أول مرة، أو نسيت كلمة السر</button></p></>}
  {v==='code'&&<><label htmlFor="ad-c">كود المصادقة (6 أرقام)</label><input id="ad-c" inputMode="numeric" maxLength={6} dir="ltr" autoComplete="one-time-code" value={code} onChange={x=>setCode(x.target.value)} onKeyDown={x=>x.key==='Enter'&&verify()}/>
   <button className="p" disabled={b||code.trim().length<6} onClick={verify} type="button">تأكيد</button></>}
  {v==='enroll'&&<><p>امسح الرمز بتطبيق مصادقة زي Google Authenticator أو Microsoft Authenticator، وبعدها اكتب الكود اللي يظهر.</p>
   <div style={{textAlign:'center',background:'#fff',borderRadius:12,padding:10,margin:'8px 0'}}><img src={qr} alt="رمز QR لتفعيل تطبيق المصادقة" width={180} height={180}/></div>
   <p style={{fontSize:12,wordBreak:'break-all'}} dir="ltr">{sec}</p>
   <label htmlFor="ad-c2">الكود الظاهر في التطبيق</label><input id="ad-c2" inputMode="numeric" maxLength={6} dir="ltr" autoComplete="one-time-code" value={code} onChange={x=>setCode(x.target.value)} onKeyDown={x=>x.key==='Enter'&&verify()}/>
   <button className="p" disabled={b||code.trim().length<6} onClick={verify} type="button">فعّل</button></>}
 </div>}
export function SetPw({onDone}:{onDone:()=>void}){
 const [a,setA]=useState(''),[c,setC]=useState(''),[m,setM]=useState(''),[b,setB]=useState(false);
 const save=async()=>{if(a.length<12){setM('كلمة السر أقصر من 12 حرفًا.');return}if(a!==c){setM('الكلمتان غير متطابقتين.');return}
  setB(true);setM('');const r=await sb.auth.updateUser({password:a});setB(false);if(r.error){setM('تعذّر الحفظ: '+r.error.message);return}
  history.replaceState(null,'',location.pathname+location.search);onDone()};
 return <div className="ad-login" dir="rtl"><h1>اضبط كلمة السر</h1><p className="sub">بعدها نكمّل بكود المصادقة.</p>
  {m&&<div className="ad-err" role="alert">{m}</div>}
  <label htmlFor="ad-n1">كلمة سر جديدة (12 حرفًا على الأقل)</label><input id="ad-n1" type="password" dir="ltr" autoComplete="new-password" value={a} onChange={x=>setA(x.target.value)}/>
  <label htmlFor="ad-n2">أعد كتابتها</label><input id="ad-n2" type="password" dir="ltr" autoComplete="new-password" value={c} onChange={x=>setC(x.target.value)} onKeyDown={x=>x.key==='Enter'&&save()}/>
  <button className="p" disabled={b||!a||!c} onClick={save} type="button">حفظ كلمة السر</button></div>}
