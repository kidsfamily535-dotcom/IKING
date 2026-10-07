import {useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {Switch,Toggle} from './cabin/Switch';
import {useI18n,airportName,type Lang} from './i18n';
import type {Airport} from './data/types';
import './profile.css';

// ملف الرحلة الجاهز + مرونتك + صاحب القرار: شاشة واحدة تحفظ كل شيء عبر الدالة save_my_trip_profile (التحقق في القاعدة).
// لا أرقام جوازات ولا بيانات حساسة هنا: أسماء المرافقين (للعرض فقط) والمطارات وعدد الركاب وصاحب القرار.
// المرونة تُستخدم لعرض الرحلات الفاضية المناسبة فقط، وكل نتيجة موسومة بسبب المرونة (انظر FlexLegs).
type Trav={name:string;note:string|null};
type Apt={code:string;role:'preferred'|'alternate'};
const MAX_TRAV=12,MAX_APT=8;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const P:Record<'ar'|'en',Record<string,string>>={
ar:{nav:'ملف الرحلة',h:'ملف رحلتك الجاهز',pax:'عدد الركاب المعتاد',paxAny:'غير محدد',trav:'المرافقون',travH:'أسماء للعرض فقط. لا نطلب أرقام جوازات ولا بيانات حساسة.',travPh:'اسم المرافق',add:'أضف',remove:'حذف',
 pref:'المطارات المفضلة',alt:'مطارات بديلة',aptPick:'اختر مطارًا',aptMax:'الحد الأقصى 8 مطارات',travMax:'الحد الأقصى 12 مرافقًا',
 flex:'مرونتك',flexH:'كم يومًا تقبل أن تتحرك الرحلة؟ إن لم تحدد، نعرض لك المطابقات الدقيقة فقط.',before:'أقبل قبل تاريخي',after:'أقبل بعد تاريخي',d0:'لا',d1:'يوم',d2:'يومان',d3:'3 أيام',
 altOk:'أقبل مطارًا بديلًا في نفس الدولة',altH:'من مطاراتك البديلة فقط',
 dec:'صاحب القرار',decH:'من يوافق على الدفع. يصله ملخص قصير ورابط آمن، والموافقة تسجّل نية حجز فقط.',decName:'الاسم',decMail:'البريد الإلكتروني',
 save:'احفظ ملفي',saving:'جارٍ الحفظ…',saved:'تم حفظ ملف رحلتك',loadErr:'تعذّر تحميل ملفك. حاول مرة أخرى.',saveErr:'تعذّر الحفظ. تأكد من البيانات وحاول مرة أخرى.',
 badMail:'البريد الإلكتروني غير صحيح',needBoth:'أدخل اسم صاحب القرار وبريده معًا، أو اتركهما فارغين',loading:'جارٍ التحميل…'},
en:{nav:'Trip profile',h:'Your ready trip profile',pax:'Usual passengers',paxAny:'Not set',trav:'Travelling companions',travH:'Display names only. We never ask for passport numbers or sensitive data.',travPh:'Companion name',add:'Add',remove:'Remove',
 pref:'Preferred airports',alt:'Alternate airports',aptPick:'Choose an airport',aptMax:'At most 8 airports',travMax:'At most 12 companions',
 flex:'Your flexibility',flexH:'How many days can the trip move? If you set nothing, we show exact matches only.',before:'Accept before my date',after:'Accept after my date',d0:'No',d1:'1 day',d2:'2 days',d3:'3 days',
 altOk:'Accept an alternate airport in the same country',altH:'From your alternate airports only',
 dec:'Decision-maker',decH:'Who approves payment. They get a short summary and a secure link; approving records a booking intent only.',decName:'Name',decMail:'Email',
 save:'Save my profile',saving:'Saving…',saved:'Your trip profile is saved',loadErr:'Could not load your profile. Try again.',saveErr:'Could not save. Check the details and try again.',
 badMail:'The email address is not valid',needBoth:'Enter the decision-maker name and email together, or leave both empty',loading:'Loading…'}};
const T=(l:Lang)=>P[l==='ar'?'ar':'en'];
export const profNav=(l:Lang)=>T(l).nav;

export default function Profile({airports}:{airports:Airport[]}){
 const {lang}=useI18n();const t=T(lang);
 const [ready,setReady]=useState(false),[loadErr,setLoadErr]=useState(false);
 const [pax,setPax]=useState(''),[trav,setTrav]=useState<Trav[]>([]),[apt,setApt]=useState<Apt[]>([]);
 const [before,setBefore]=useState(0),[after,setAfter]=useState(0),[alt,setAlt]=useState(false);
 const [dn,setDn]=useState(''),[de,setDe]=useState(''),[nm,setNm]=useState('');
 const [err,setErr]=useState(''),[ok,setOk]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;(async()=>{
  const {data,error}=await sb.rpc('get_my_trip_profile');
  if(!live)return;if(error){setLoadErr(true);setReady(true);return}
  const d=(data??{}) as any;
  setPax(d.default_passengers!=null?String(d.default_passengers):'');
  setTrav(Array.isArray(d.travelers)?d.travelers.map((x:any)=>({name:String(x.name??''),note:x.note??null})):[]);
  setApt(Array.isArray(d.airports)?d.airports.map((x:any)=>({code:String(x.code),role:x.role==='alternate'?'alternate':'preferred'})):[]);
  setBefore(Number(d.flex_days_before)||0);setAfter(Number(d.flex_days_after)||0);setAlt(!!d.accept_alt_airports);
  setDn(d.approver_name??'');setDe(d.approver_email??'');setReady(true)})();return()=>{live=false}},[]);
 const name=(c:string)=>{const a=airports.find(x=>x.iata===c);return a?airportName(a):c};
 const addTrav=()=>{const n=nm.trim();if(!n)return;if(trav.length>=MAX_TRAV){setErr(t.travMax);return}setErr('');setOk(false);setTrav([...trav,{name:n,note:null}]);setNm('')};
 const addApt=(role:Apt['role'],code:string)=>{if(!code)return;if(apt.some(a=>a.code===code))return;if(apt.length>=MAX_APT){setErr(t.aptMax);return}setErr('');setOk(false);setApt([...apt,{code,role}])};
 const save=async()=>{setErr('');setOk(false);
  const n=dn.trim(),e=de.trim();
  if((n&&!e)||(!n&&e)){setErr(t.needBoth);return}
  if(e&&!EMAIL.test(e)){setErr(t.badMail);return}
  const rank:Record<string,number>={preferred:0,alternate:0};
  const airportsOut=apt.map(a=>({code:a.code,role:a.role,rank:++rank[a.role]}));
  setBusy(true);
  const {error}=await sb.rpc('save_my_trip_profile',{p_profile:{default_passengers:pax?Number(pax):null,travelers:trav,airports:airportsOut,
   flex_days_before:before,flex_days_after:after,accept_alt_airports:alt,approver_name:n||null,approver_email:e||null}});
  setBusy(false);if(error){setErr(t.saveErr);return}setOk(true)};
 const days=[0,1,2,3];const dl=(d:number)=>[t.d0,t.d1,t.d2,t.d3][d];
 const aptBlock=(role:Apt['role'],title:string)=><div className="pf-blk"><span className="pf-h">{title}</span>
  <div className="pf-chips">{apt.filter(a=>a.role===role).map(a=><span className="pf-chip" key={a.code}><bdi>{name(a.code)}</bdi> <span dir="ltr">{a.code}</span>
   <button type="button" aria-label={`${t.remove} ${a.code}`} onClick={()=>{setOk(false);setApt(apt.filter(x=>x.code!==a.code))}}>×</button></span>)}</div>
  <select aria-label={title} value="" onChange={e=>addApt(role,e.target.value)}><option value="">{t.aptPick}</option>
   {airports.filter(a=>!apt.some(x=>x.code===a.iata)).map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</select></div>;
 const flexRow=(label:string,v:number,set:(n:number)=>void)=><div className="pf-blk"><label>{label}</label>
  <div className="pf-days pf-chips" role="group" aria-label={label}>{days.map(d=><button type="button" key={d} className={v===d?'on':''} aria-pressed={v===d} onClick={()=>{set(d);setOk(false)}}>{dl(d)}</button>)}</div></div>;
 if(!ready)return <p className="dim" role="status">{t.loading}</p>;
 return <div className="pf">
  <h2 className="big">{t.h}</h2>
  {loadErr&&<div className="nt" role="alert">{t.loadErr}</div>}
  <div className="pf-blk"><label htmlFor="pf-pax">{t.pax}</label>
   <select id="pf-pax" value={pax} onChange={e=>{setPax(e.target.value);setOk(false)}}><option value="">{t.paxAny}</option>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></div>
  <div className="pf-blk"><span className="pf-h">{t.trav}</span><span className="pf-hint">{t.travH}</span>
   {trav.length>0&&<ul className="pf-names">{trav.map((x,i)=><li key={i}><bdi>{x.name}</bdi><button type="button" className="g sm" onClick={()=>{setOk(false);setTrav(trav.filter((_,j)=>j!==i))}}>{t.remove}</button></li>)}</ul>}
   <div className="pf-add"><input aria-label={t.travPh} placeholder={t.travPh} maxLength={60} value={nm} onChange={e=>setNm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTrav()}}}/>
    <Switch small label={t.add} onActivate={addTrav}/></div></div>
  {aptBlock('preferred',t.pref)}{aptBlock('alternate',t.alt)}
  <div className="pf-blk"><span className="pf-h">{t.flex}</span><span className="pf-hint">{t.flexH}</span></div>
  {flexRow(t.before,before,setBefore)}{flexRow(t.after,after,setAfter)}
  <div className="pf-blk"><Toggle checked={alt} onChange={v=>{setAlt(v);setOk(false)}}>{t.altOk}<small className="pf-hint">{t.altH}</small></Toggle></div>
  <div className="pf-blk"><span className="pf-h">{t.dec}</span><span className="pf-hint">{t.decH}</span>
   <label htmlFor="pf-dn">{t.decName}</label><input id="pf-dn" maxLength={80} autoComplete="off" value={dn} onChange={e=>{setDn(e.target.value);setOk(false)}}/>
   <label htmlFor="pf-de">{t.decMail}</label><input id="pf-de" type="email" dir="ltr" inputMode="email" maxLength={120} autoComplete="off" value={de} onChange={e=>{setDe(e.target.value);setOk(false)}}/></div>
  {err&&<div className="nt" role="alert">{err}</div>}{ok&&<div className="nt e" role="status">{t.saved}</div>}
  <div className="pf-go"><Switch primary busy={busy} disabled={busy} label={busy?t.saving:t.save} onActivate={save}/></div>
 </div>;
}
