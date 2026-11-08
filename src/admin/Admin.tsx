import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import './admin.css';

type Av={id:string;aircraft_model:string|null;origin_code:string;destination_code:string|null;departure_from:string;departure_until:string;seats:number;expires_at:string;is_demo:boolean};
type Op={id:string;origin_code:string;destination_code:string|null;status:string;score:number|null;detect_reason:string|null;expires_at:string|null;created_at:string};
type Hf={id:string;created_at:string;reason:string|null;route:string|null;lang:string|null;status:string};

const f=(d:string)=>new Date(d).toLocaleString('ar-u-nu-latn',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC';
const TABS=['توافر بانتظار التأكيد','الفرص','طلبات رفيق'];
const SUB=['أي طيارة تفضل «بانتظار التحقق» ولا تظهر كمتاحة لأي عميل إلا بتأكيدك.','الفرص التي اكتشفها المحرك. لا يُرسَل شيء لأي عميل تلقائيًا.','الطلبات التي حوّلها رفيق لإنسان.'];

function Login({onDone}:{onDone:()=>void}){
 const [e,setE]=useState(''),[p,setP]=useState(''),[code,setCode]=useState(''),[fid,setFid]=useState(''),[m,setM]=useState(''),[b,setB]=useState(false);
 const mfa=async()=>{
  const a=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(a.data?.currentLevel==='aal2'){onDone();return}
  const l=await sb.auth.mfa.listFactors();const t=l.data?.totp?.find(x=>x.status==='verified');
  if(!t){setM('لم يتم تفعيل المصادقة الثنائية لهذا الحساب. فعّلها أولًا من مركز القيادة.');await sb.auth.signOut();return}
  setFid(t.id)};
 const login=async()=>{setB(true);setM('');const r=await sb.auth.signInWithPassword({email:e.trim(),password:p});setB(false);if(r.error){setM('البريد أو كلمة السر غير صحيحة.');return}await mfa()};
 const verify=async()=>{setB(true);setM('');const r=await sb.auth.mfa.challengeAndVerify({factorId:fid,code:code.trim()});setB(false);if(r.error){setM('الكود غير صحيح أو منتهي.');return}onDone()};
 return <div className="ad-login" dir="rtl"><h1>لوحة الأدمن</h1><p className="sub">EYE KING</p>
  {m&&<div className="ad-err" role="alert">{m}</div>}
  {!fid?<><label>البريد</label><input type="email" dir="ltr" value={e} onChange={x=>setE(x.target.value)} autoComplete="username"/>
   <label>كلمة السر</label><input type="password" dir="ltr" value={p} onChange={x=>setP(x.target.value)} autoComplete="current-password" onKeyDown={x=>x.key==='Enter'&&login()}/>
   <button className="p" disabled={b||!e||!p} onClick={login} type="button">دخول</button>
   <p style={{fontSize:13,marginTop:14}}>أول مرة أو نسيت كلمة السر؟ <a href="/owner-room.html">من مركز القيادة</a></p></>
  :<><label>كود المصادقة (6 أرقام)</label><input inputMode="numeric" dir="ltr" value={code} onChange={x=>setCode(x.target.value)} onKeyDown={x=>x.key==='Enter'&&verify()}/>
   <button className="p" disabled={b||code.trim().length<6} onClick={verify} type="button">تأكيد</button></>}
 </div>}

function Avail({onCount,setErr}:{onCount:(n:number)=>void;setErr:(s:string)=>void}){
 const [rows,setRows]=useState<Av[]|null>(null),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{const r=await sb.from('aircraft_availability').select('id,aircraft_model,origin_code,destination_code,departure_from,departure_until,seats,expires_at,is_demo').eq('status','PENDING_VERIFICATION').gt('expires_at',new Date().toISOString()).order('departure_from');
  if(r.error){setErr('تعذّر قراءة التوافر. هذا لا يعني أنه فاضي.');return}const d=(r.data??[]) as Av[];setRows(d);onCount(d.length)},[onCount,setErr]);
 useEffect(()=>{load()},[load]);
 const act=async(a:Av,to:'AVAILABLE'|'CANCELLED')=>{const rt=a.origin_code+(a.destination_code?' ← '+a.destination_code:'');
  if(!confirm(to==='AVAILABLE'?`تأكيد ${rt} كمتاحة؟ لن يُرسَل شيء لأي أحد تلقائيًا.`:`رفض وإلغاء ${rt}؟`))return;
  setBusy(a.id);setErr('');const r=await sb.rpc('set_availability_status',{p_id:a.id,p_new:to,p_reason:to==='AVAILABLE'?'confirmed by owner':'rejected by owner'});setBusy('');
  if(r.error){setErr(/mfa_required/.test(r.error.message)?'يلزم كود المصادقة. سجّل الدخول من جديد.':'تعذّر تنفيذ الإجراء: '+r.error.message);return}load()};
 if(!rows)return <div className="ad-empty">جارٍ التحميل…</div>;
 if(!rows.length)return <div className="ad-empty">لا يوجد توافر منتظر تأكيدك.</div>;
 return <>{rows.map(a=><div className="ad-card" key={a.id}><h3>{a.origin_code}{a.destination_code?` ← ${a.destination_code}`:' · أي وجهة'}{a.is_demo&&<span className="ad-chip">تجريبي</span>}</h3>
  <p>{a.aircraft_model} · {a.seats} مقاعد</p><p>يغادر: {f(a.departure_from)} إلى {f(a.departure_until)}</p><p>يسقط تلقائيًا: {f(a.expires_at)}</p>
  <div className="ad-row"><button type="button" className="p" disabled={busy===a.id} onClick={()=>act(a,'AVAILABLE')}>تأكيد كمتاحة</button><button type="button" className="q" disabled={busy===a.id} onClick={()=>act(a,'CANCELLED')}>رفض</button></div></div>)}</>}

function Opps({setErr}:{setErr:(s:string)=>void}){
 const [rows,setRows]=useState<Op[]|null>(null);
 useEffect(()=>{sb.from('opportunities').select('id,origin_code,destination_code,status,score,detect_reason,expires_at,created_at').order('created_at',{ascending:false}).limit(40).then(r=>{if(r.error){setErr('تعذّر قراءة الفرص.');return}setRows((r.data??[]) as Op[])})},[setErr]);
 if(!rows)return <div className="ad-empty">جارٍ التحميل…</div>;if(!rows.length)return <div className="ad-empty">لا توجد فرص بعد.</div>;
 return <>{rows.map(o=><div className="ad-card" key={o.id}><h3>{o.origin_code}{o.destination_code?` ← ${o.destination_code}`:''}<span className="ad-chip">{o.status}</span>{o.score!=null&&<span className="ad-chip">{o.score}/100</span>}</h3>
  {o.detect_reason&&<p>{o.detect_reason}</p>}<p>أُنشئت: {f(o.created_at)}{o.expires_at?` · تنتهي: ${f(o.expires_at)}`:''}</p></div>)}</>}

function Handoffs({setErr}:{setErr:(s:string)=>void}){
 const [rows,setRows]=useState<Hf[]|null>(null);
 useEffect(()=>{sb.from('rafiq_handoffs').select('id,created_at,reason,route,lang,status').order('created_at',{ascending:false}).limit(40).then(r=>{if(r.error){setErr('تعذّر قراءة طلبات رفيق.');return}setRows((r.data??[]) as Hf[])})},[setErr]);
 if(!rows)return <div className="ad-empty">جارٍ التحميل…</div>;if(!rows.length)return <div className="ad-empty">لا توجد طلبات.</div>;
 return <>{rows.map(h=><div className="ad-card" key={h.id}><h3>{h.route||'بدون مسار'}<span className="ad-chip">{h.status}</span>{h.lang&&<span className="ad-chip">{h.lang}</span>}</h3>{h.reason&&<p>{h.reason}</p>}<p>{f(h.created_at)}</p></div>)}</>}

export default function Admin(){
 const [ses,setSes]=useState<string|null|undefined>(undefined),[ok,setOk]=useState<boolean|null>(null),[lvl,setLvl]=useState(false),[tab,setTab]=useState(0),[err,setErr]=useState(''),[cnt,setCnt]=useState(0),[mail,setMail]=useState('');
 const check=useCallback(async()=>{const s=(await sb.auth.getSession()).data.session;setSes(s?.user.id??null);setMail(s?.user.email??'');
  if(!s){setOk(null);setLvl(false);return}
  const a=await sb.auth.mfa.getAuthenticatorAssuranceLevel();setLvl(a.data?.currentLevel==='aal2');
  const p=await sb.from('profiles').select('role,status').eq('id',s.user.id).maybeSingle();setOk(p.data?.role==='admin'&&p.data?.status==='active')},[]);
 useEffect(()=>{check();const {data}=sb.auth.onAuthStateChange(()=>{check()});return()=>data.subscription.unsubscribe()},[check]);
 const go=(i:number)=>{setTab(i);setErr('')};
 if(ses===undefined||(ses&&ok===null))return <div className="ad" dir="rtl"/>;
 if(!ses||!lvl)return <div className="ad" dir="rtl"><Login onDone={check}/></div>;
 if(!ok)return <div className="ad" dir="rtl"><div className="ad-login"><h1>غير مصرّح</h1><p className="sub">هذا الحساب ليس أدمن.</p><button className="q" type="button" onClick={()=>sb.auth.signOut()}>خروج</button></div></div>;
 return <div className="ad" dir="rtl"><header className="ad-top"><b>EYE KING</b>
  <nav role="tablist">{TABS.map((t,i)=><button key={t} type="button" role="tab" aria-selected={tab===i} className={tab===i?'on':''} onClick={()=>go(i)}>{t}{i===0&&cnt>0&&<em>{cnt}</em>}</button>)}</nav>
  <span dir="ltr" style={{fontSize:13}}>{mail}</span><button type="button" className="q" style={{color:'#f5f0e6',borderColor:'#555'}} onClick={()=>sb.auth.signOut()}>خروج</button></header>
  <main className="ad-main"><h1>{TABS[tab]}</h1><p className="sub">{SUB[tab]}</p>{err&&<div className="ad-err" role="alert">{err}</div>}
   {tab===0&&<Avail onCount={setCnt} setErr={setErr}/>}{tab===1&&<Opps setErr={setErr}/>}{tab===2&&<Handoffs setErr={setErr}/>}</main></div>}
