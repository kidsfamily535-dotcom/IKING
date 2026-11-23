import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
// قرارات منتظرة: مسودات وتصعيدات، واقتراحات الصياد (بوابة الموافقة). الاعتماد لا يرسل شيئًا لأي جهة.
type It={kind:string;id:string;title:string|null;detail:string|null;created_at:string;expires_at:string|null};
type Q={id:string;source:string;run_label:string|null;proposed:{title?:string;evidence?:string;grade?:string;source_url?:string}|null;expires_at:string};
const KINDS:Record<string,string>={DRAFT:'مسودة رسالة',ESCALATION:'تصعيد',PROPOSAL:'اقتراح المساعد',REQUEST:'طلب عميل'};
const REASONS:[string,string][]=[['PRICE','السعر'],['TIMING','التوقيت'],['NOT_RELEVANT','غير مهم'],['NEED_INFO','أحتاج معلومات'],['RISK','مخاطرة'],['OTHER','سبب آخر']];
const QSRC:Record<string,string>={XPOZ:'XPOZ (منشورات عامة)',APIFY:'Apify',NEWS:'أخبار',TED:'مناقصات TED',BROKER:'الصياد',MANUAL:'يدوي'};
const f=(d:string)=>new Date(d).toLocaleString('ar-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC';
export default function Inbox({setErr,onCount}:{setErr:(s:string)=>void;onCount:(n:number)=>void}){
 const [it,setIt]=useState<It[]|null>(null),[q,setQ]=useState<Q[]|null>(null),[b,setB]=useState(false),[rs,setRs]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{const [a,c]=await Promise.all([sb.rpc('owner_inbox'),sb.rpc('owner_queue_list',{p_status:'PENDING',p_limit:40})]);
  const items=a.error||!Array.isArray(a.data)?null:(a.data as It[]).filter(x=>x.kind!=='SIGNAL');const qs=c.error||!Array.isArray(c.data)?null:c.data as Q[];
  setIt(items);setQ(qs);onCount((items?.length??0)+(qs?.length??0));
  if(!items||!qs)setErr('تعذّر قراءة بعض القرارات المنتظرة. هذا لا يعني أنها فاضية.')},[setErr,onCount]);
 useEffect(()=>{load()},[load]);
 const call=async(fn:string,args:Record<string,unknown>,ask?:string)=>{if(ask&&!confirm(ask))return;setB(true);setErr('');const r=await sb.rpc(fn,args);setB(false);if(r.error){setErr(/mfa_required/.test(r.error.message||'')?'يلزم كود المصادقة. سجّل الدخول من جديد.':'تعذّر تسجيل القرار.');return}load()};
 const none=it&&q&&!it.length&&!q.length;
 return <>{none&&<div className="ad-empty">مفيش قرارات منتظرة دلوقتي. الوكيل شغّال ويرجعلك عند الحاجة.</div>}
  {it?.map(x=><div className="ad-card" key={x.kind+x.id}><h3>{x.title||'بدون عنوان'}<span className="ad-chip">{KINDS[x.kind]||x.kind}</span></h3>{x.detail&&<p>{x.detail}</p>}<p>{f(x.created_at)}{x.expires_at?' · ينتهي '+f(x.expires_at):''}</p>
   {x.kind==='DRAFT'&&<div className="ad-row"><button type="button" className="p" disabled={b} onClick={()=>call('owner_decide',{p_kind:x.kind,p_id:x.id,p_decision:'APPROVE',p_reason_code:null,p_note:null})}>اعتماد المسودة</button>
    <select aria-label="سبب الرفض" value={rs[x.id]??''} onChange={e=>setRs({...rs,[x.id]:e.target.value})}><option value="">سبب الرفض</option>{REASONS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <button type="button" className="q" disabled={b||!rs[x.id]} onClick={()=>call('owner_decide',{p_kind:x.kind,p_id:x.id,p_decision:'REJECT',p_reason_code:rs[x.id],p_note:null})}>رفض</button></div>}
   {x.kind==='DRAFT'&&<p style={{fontSize:13}}>الاعتماد لا يرسل شيئًا. التواصل الخارجي يبقى مقفولًا حتى تفتحه أنت.</p>}
   {x.kind==='ESCALATION'&&<div className="ad-row"><button type="button" className="p" disabled={b} onClick={()=>call('owner_decide',{p_kind:x.kind,p_id:x.id,p_decision:'RESOLVE',p_reason_code:null,p_note:null})}>تم الحل</button></div>}</div>)}
  {q?.map(x=>{const p=x.proposed||{};return <div className="ad-card" key={x.id}><h3>{String(p.title||'بدون عنوان').slice(0,200)}<span className="ad-chip">{(QSRC[x.source]||x.source)+' · درجة '+(p.grade||'D')}</span></h3>
   {p.evidence&&<p>{String(p.evidence).slice(0,420)}</p>}<p>يسقط تلقائيًا: {f(x.expires_at)}{x.run_label?' | '+x.run_label:''}</p>
   <div className="ad-row">{/^https:\/\//.test(String(p.source_url||''))&&<a href={p.source_url} target="_blank" rel="noopener noreferrer">فتح المصدر</a>}
    <button type="button" className="p" disabled={b} onClick={()=>call('owner_queue_decide',{p_id:x.id,p_decision:'APPROVE',p_note:null},'تسجيلها كإشارة درجة D وثقة منخفضة، من غير أي تواصل؟')}>اعتماد كإشارة ضعيفة</button>
    <button type="button" className="q" disabled={b} onClick={()=>call('owner_queue_decide',{p_id:x.id,p_decision:'REJECT',p_note:null})}>رفض</button></div></div>})}</>}
