import {useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
// جهة الوسيط: إصدار رابط المشغّل ومتابعته. الرمز يظهر مرة واحدة فقط (لا يُخزَّن في القاعدة إلا بصمته)،
// والإرسال يتم بيد الوسيط (نسخ أو بريد مفتوح) لأن خدمة البريد لم تُختر بعد: لا شيء يخرج تلقائيًا.
type Row={id:string;operator_name:string;operator_contact:string|null;status:string;link_expires_at:string|null;link_first_opened_at:string|null;travel_requests:{origin_code:string|null;destination_code:string|null;travel_date:string|null}|null};
const X={ar:{h:'روابط المشغّلين',empty:'لا طلبات مفتوحة عند مشغّلين الآن.',issue:'إصدار رابط',reissue:'رابط جديد (يلغي السابق)',hours:'صلاحية الرابط',copy:'نسخ الرابط',copied:'تم النسخ',mail:'فتح مسودة بريد',once:'يظهر هذا الرابط الآن فقط. أي رابط جديد يُبطل السابق.',opened:'فُتح الرابط',notOpened:'لم يُفتح بعد',exp:'ينتهي',none:'لا رابط',err:'تعذّر الإصدار',noReq:'بلا رحلة',
  subj:'طلب عرض لرحلة',body:(r:string,u:string)=>`مرحبًا،\n\nلدينا طلب رحلة ${r}. التفاصيل والرد (عرض أو اعتذار) من هذا الرابط الخاص بك، بلا حاجة إلى حساب:\n${u}\n\nشكرًا لكم.`},
 en:{h:'Operator links',empty:'No open requests with operators right now.',issue:'Issue link',reissue:'New link (revokes the old one)',hours:'Link lifetime',copy:'Copy link',copied:'Copied',mail:'Open email draft',once:'This link is shown only now. A new link invalidates the previous one.',opened:'Link opened',notOpened:'Not opened yet',exp:'Expires',none:'No link',err:'Could not issue',noReq:'No trip',
  subj:'Quote request',body:(r:string,u:string)=>`Hello,\n\nWe have a trip request ${r}. Details and your reply (offer or decline) are at your private link, no account needed:\n${u}\n\nThank you.`}};
export default function OperatorLinks(){
 const {lang}=useI18n();const t=X[lang==='ar'?'ar':'en'];
 const [rows,setRows]=useState<Row[]|null>(null),[hrs,setHrs]=useState('48'),[link,setLink]=useState<{id:string;url:string}|null>(null),[copied,setCopied]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState('');
 const load=async()=>{const {data,error}=await sb.from('operator_rfqs').select('id,operator_name,operator_contact,status,link_expires_at,link_first_opened_at,travel_requests(origin_code,destination_code,travel_date)').in('status',['AWAITING','NO_RESPONSE']).order('contacted_at',{ascending:false});
  setRows(error?[]:(data as unknown as Row[]))};
 useEffect(()=>{load()},[]);
 const issue=async(r:Row)=>{setErr('');setBusy(r.id);setCopied(false);
  const {data,error}=await sb.rpc('loop_issue_operator_link',{p_rfq:r.id,p_ttl_hours:Number(hrs)});
  setBusy('');if(error||!data){setErr(t.err);return}
  setLink({id:r.id,url:`${location.origin}/?view=operator#t=${data}`});load()};
 const dt=(s:string)=>new Date(s).toLocaleString(lang==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const route=(r:Row)=>r.travel_requests?.origin_code&&r.travel_requests?.destination_code?`${r.travel_requests.origin_code} → ${r.travel_requests.destination_code}${r.travel_requests.travel_date?' · '+r.travel_requests.travel_date:''}`:t.noReq;
 return <div className="brk"><h3 className="bh">{t.h}</h3>
  <label className="mono" style={{display:'block',margin:'6px 0 12px'}}>{t.hours}<select value={hrs} onChange={e=>setHrs(e.target.value)} style={{marginInlineStart:10}}>{[6,24,48,72,168].map(h=><option key={h} value={h}>{h}h</option>)}</select></label>
  {err&&<div className="nt" role="alert">{err}</div>}
  {rows&&!rows.length&&<div className="empty">{t.empty}</div>}
  {rows?.map(r=><div className="card" key={r.id} style={{padding:'16px 0'}}>
   <div className="row"><span><bdi>{r.operator_name}</bdi></span><span dir="ltr">{route(r)}</span></div>
   <div className="row"><span>{r.link_first_opened_at?t.opened:r.link_expires_at?t.notOpened:t.none}</span><span>{r.link_expires_at?`${t.exp} ${dt(r.link_expires_at)}`:''}</span></div>
   <div className="act"><button className={r.link_expires_at?'g':''} disabled={busy===r.id} onClick={()=>issue(r)}>{r.link_expires_at?t.reissue:t.issue}</button></div>
   {link?.id===r.id&&<div className="nt e"><p dir="ltr" style={{wordBreak:'break-all',fontSize:13}}>{link.url}</p>
    <div className="act"><button onClick={async()=>{await navigator.clipboard.writeText(link.url);setCopied(true)}}>{copied?t.copied:t.copy}</button>
     <a className="mono" href={`mailto:${encodeURIComponent(r.operator_contact??'')}?subject=${encodeURIComponent(t.subj)}&body=${encodeURIComponent(t.body(route(r),link.url))}`}>{t.mail}</a></div><small>{t.once}</small></div>}
  </div>)}</div>;
}
