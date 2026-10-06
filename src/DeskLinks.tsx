import {useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
// جهة الوسيط: مكتب المشغّل = رابط ثابت لكل مشغّل يضيف منه رحلاته الفاضية. الرمز يظهر مرة واحدة فقط (تُخزَّن بصمته)،
// والإرسال بيد الوسيط (نسخ أو بريد مفتوح). الرحلات المستلَمة تُعرض للقراءة فقط هنا: لا تتحول إلى توفّر أو فرصة تلقائيًا.
type Desk={id:string;name:string;contact:string|null;expires_at:string;revoked_at:string|null;first_opened_at:string|null};
type Sub={id:string;operator_name:string;origin_code:string;destination_code:string|null;departure_from:string;departure_until:string;aircraft_model:string;seats:number;indicative_price:number|null;currency:string|null;notes:string|null;status:string;model_known:boolean};
const X={ar:{h:'مكاتب المشغّلين',name:'اسم المشغّل',contact:'بريد أو هاتف (اختياري)',days:'صلاحية الرابط',d:'يوم',issue:'إصدار رابط مكتب',copy:'نسخ الرابط',copied:'تم النسخ',mail:'فتح مسودة بريد',once:'يظهر هذا الرابط الآن فقط. لإلغائه استخدم «إلغاء».',
  revoke:'إلغاء الرابط',revoked:'ملغى',opened:'فُتح',notOpened:'لم يُفتح بعد',exp:'ينتهي',err:'تعذّر التنفيذ',needName:'اكتب اسم المشغّل',empty:'لا مكاتب بعد.',
  sh:'رحلات فاضية وصلت من المشغّلين',sempty:'لا رحلات مستلَمة.',any:'أي وجهة',unknownModel:'نوع طائرة غير معروف في القاعدة',seats:'مقاعد',
  RECEIVED:'مستلَمة، بانتظار التحقق',WITHDRAWN:'سحبها المشغّل',REJECTED:'مرفوضة',CONVERTED:'معتمدة',
  subj:'رابط مكتبك في THE KING\'S EYE',body:(u:string)=>`مرحبًا،\n\nهذا رابطك الخاص لإضافة رحلاتك الفاضية، بلا حاجة إلى حساب:\n${u}\n\nشكرًا لكم.`},
 en:{h:'Operator desks',name:'Operator name',contact:'Email or phone (optional)',days:'Link lifetime',d:'d',issue:'Issue desk link',copy:'Copy link',copied:'Copied',mail:'Open email draft',once:'This link is shown only now. Use Revoke to cancel it.',
  revoke:'Revoke link',revoked:'Revoked',opened:'Opened',notOpened:'Not opened yet',exp:'Expires',err:'Could not complete',needName:'Enter the operator name',empty:'No desks yet.',
  sh:'Empty legs received from operators',sempty:'No legs received.',any:'Any destination',unknownModel:'Aircraft type not in our database',seats:'seats',
  RECEIVED:'Received, awaiting verification',WITHDRAWN:'Withdrawn by operator',REJECTED:'Rejected',CONVERTED:'Accepted',
  subj:'Your desk link on THE KING\'S EYE',body:(u:string)=>`Hello,\n\nThis is your private link to add your empty legs, no account needed:\n${u}\n\nThank you.`}};
export default function DeskLinks(){
 const {lang}=useI18n();const t=X[lang==='ar'?'ar':'en'];
 const [desks,setDesks]=useState<Desk[]|null>(null),[subs,setSubs]=useState<Sub[]|null>(null),[name,setName]=useState(''),[contact,setContact]=useState(''),[days,setDays]=useState('30');
 const [link,setLink]=useState<{contact:string;url:string}|null>(null),[copied,setCopied]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const [a,b]=await Promise.all([sb.rpc('list_desk_links'),sb.rpc('list_leg_submissions')]);setDesks(a.error?[]:(a.data as Desk[]));setSubs(b.error?[]:(b.data as Sub[]))};
 useEffect(()=>{load()},[]);
 const issue=async()=>{setErr('');setCopied(false);if(name.trim().length<2){setErr(t.needName);return}setBusy(true);
  const {data,error}=await sb.rpc('loop_issue_desk_link',{p_name:name.trim(),p_contact:contact.trim()||null,p_ttl_days:Number(days)});
  setBusy(false);if(error||!data?.token){setErr(t.err);return}
  setLink({contact:contact.trim(),url:`${location.origin}/?view=desk#t=${data.token}`});setName('');setContact('');load()};
 const revoke=async(d:Desk)=>{if(!window.confirm(`${t.revoke}: ${d.name}؟`))return;setErr('');const {error}=await sb.rpc('loop_revoke_desk_link',{p_desk:d.id});if(error)setErr(t.err);load()};
 const dt=(s:string)=>new Date(s).toLocaleString(lang==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return <div className="brk"><h3 className="bh">{t.h}</h3>
  <div className="f2"><div><label>{t.name}</label><input aria-label={t.name} value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></div>
   <div><label>{t.contact}</label><input aria-label={t.contact} value={contact} maxLength={200} onChange={e=>setContact(e.target.value)}/></div>
   <div><label>{t.days}</label><select aria-label={t.days} value={days} onChange={e=>setDays(e.target.value)}>{[7,30,90,180].map(n=><option key={n} value={n}>{n} {t.d}</option>)}</select></div></div>
  <div className="act"><button disabled={busy} onClick={issue}>{t.issue}</button></div>
  {err&&<div className="nt" role="alert">{err}</div>}
  {link&&<div className="nt e"><p dir="ltr" style={{wordBreak:'break-all',fontSize:13}}>{link.url}</p>
   <div className="act"><button onClick={async()=>{await navigator.clipboard.writeText(link.url);setCopied(true)}}>{copied?t.copied:t.copy}</button>
    <a className="mono" href={`mailto:${encodeURIComponent(link.contact.includes('@')?link.contact:'')}?subject=${encodeURIComponent(t.subj)}&body=${encodeURIComponent(t.body(link.url))}`}>{t.mail}</a></div><small>{t.once}</small></div>}
  {desks&&!desks.length&&<div className="empty">{t.empty}</div>}
  {desks?.map(d=><div className="card" key={d.id} style={{padding:'14px 0'}}>
   <div className="row"><span><bdi>{d.name}</bdi></span><span>{d.revoked_at?t.revoked:d.first_opened_at?t.opened:t.notOpened}</span></div>
   <div className="row"><span>{d.contact?<bdi>{d.contact}</bdi>:''}</span><span>{t.exp} {dt(d.expires_at)}</span></div>
   {!d.revoked_at&&<div className="act"><button className="g" onClick={()=>revoke(d)}>{t.revoke}</button></div>}</div>)}
  <div className="mono" style={{margin:'24px 0 4px'}}>{t.sh}</div>
  {subs&&!subs.length&&<div className="empty">{t.sempty}</div>}
  {subs?.map(s=><div className="card" key={s.id} style={{padding:'14px 0'}}>
   <div className="row"><span><bdi>{s.operator_name}</bdi></span><span dir="ltr">{s.origin_code} → {s.destination_code??t.any}</span></div>
   <div className="row"><span><bdi>{s.aircraft_model}</bdi> · {s.seats} {t.seats}{s.indicative_price?<> · <span dir="ltr">{s.indicative_price} {s.currency}</span></>:null}</span><span>{dt(s.departure_from)} – {dt(s.departure_until)}</span></div>
   <div className="row"><span>{t[s.status as 'RECEIVED']??s.status}</span><span>{s.model_known?'':t.unknownModel}</span></div>
   {s.notes&&<small style={{color:'var(--dim)',display:'block'}}><bdi>{s.notes}</bdi></small>}</div>)}
 </div>;
}
