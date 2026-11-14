import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';

type Sig={id:string;grade:string|null;title:string|null;evidence:string|null;source_url:string|null;est_origin:string|null;est_destination:string|null;est_pax:number|null;recommended_action:string|null;status:string;review_note:string|null;created_at:string};
type Note={entry_date:string;summary:string;next_step:string;created_at:string};
type Ov={owner:string|null;contact_locked:boolean;signals:Sig[];regions:Record<string,number>|null;opportunities:Record<string,number>|null;notes:Note[];last_run:{action:string;created_at:string}|null};

const when=(d:string)=>new Date(d).toLocaleString('ar-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC';
const REG:Record<string,string>={NORMAL:'عادي',CAUTION:'حذر',CRISIS:'أزمة',UNKNOWN:'غير معروف'};
const DEC:[string,string,string][]=[['interested','مهتم (مراقبة)','p'],['verify','يحتاج تحقق','q'],['ignore','تجاهل','q']];

function Counts({title,data}:{title:string;data:Record<string,number>|null}){
 const e=data?Object.entries(data):[];
 return <div className="ad-card"><h3>{title}</h3>{!data?<p>غير متاح الآن.</p>:!e.length?<p>لا يوجد.</p>:<p>{e.map(([k,v])=>`${REG[k]??k}: ${v}`).join(' · ')}</p>}</div>}

export default function Command({setErr}:{setErr:(s:string)=>void}){
 const [ov,setOv]=useState<Ov|null>(null),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{
  const r=await sb.functions.invoke('owner-room',{body:{action:'overview'}});
  if(r.error||!r.data||r.data.error){setErr('تعذّر تحميل لوحة القيادة. لو الجلسة قديمة سجّل الدخول من جديد بكود المصادقة.');return}
  setOv(r.data as Ov)},[setErr]);
 useEffect(()=>{load()},[load]);
 const review=async(id:string,decision:string)=>{
  setBusy(id);setErr('');
  const r=await sb.functions.invoke('owner-room',{body:{action:'review',id,decision}});
  setBusy('');
  if(r.error||!r.data?.ok){setErr('تعذّر تسجيل القرار.');return}
  load()};
 if(!ov)return <div className="ad-empty">جارٍ التحميل…</div>;
 return <>
  <div className="ad-card"><h3>التواصل التلقائي<span className="ad-chip">{ov.contact_locked?'مقفول':'مفتوح'}</span></h3>
   <p>{ov.contact_locked?'الوكيل لا يتواصل مع أي جهة. كل رسالة مسودة تعتمدها أنت.':'تنبيه: القفل مفتوح. راجع مفاتيح النظام.'}</p>
   {ov.last_run&&<p>آخر تشغيل للصياد: {when(ov.last_run.created_at)}</p>}</div>
  <Counts title="جاهزية الدول" data={ov.regions}/>
  <Counts title="الفرص حسب الحالة" data={ov.opportunities}/>
  <h2 style={{margin:'20px 0 8px',fontSize:17}}>إشارات تنتظر قرارك ({ov.signals.length})</h2>
  {!ov.signals.length&&<div className="ad-empty">لا توجد إشارات جديدة.</div>}
  {ov.signals.map(s=><div className="ad-card" key={s.id}>
   <h3>{s.title||'إشارة بدون عنوان'}{s.grade&&<span className="ad-chip">درجة {s.grade}</span>}<span className="ad-chip">{s.status}</span></h3>
   {(s.est_origin||s.est_destination)&&<p>{s.est_origin??'؟'} ← {s.est_destination??'؟'}{s.est_pax?` · ${s.est_pax} ركاب (تقدير)`:''}</p>}
   {s.evidence&&<p>{s.evidence}</p>}{s.recommended_action&&<p>الإجراء المقترح: {s.recommended_action}</p>}
   {s.source_url&&<p><a href={s.source_url} target="_blank" rel="noopener noreferrer">المصدر</a></p>}
   <p>{when(s.created_at)}</p>
   <div className="ad-row">{DEC.map(([k,l,c])=><button key={k} type="button" className={c} disabled={busy===s.id} onClick={()=>review(s.id,k)}>{l}</button>)}</div></div>)}
  {!!ov.notes.length&&<><h2 style={{margin:'20px 0 8px',fontSize:17}}>آخر ملاحظات التسليم</h2>
   {ov.notes.map(n=><div className="ad-card" key={n.created_at}><p><b>{n.entry_date}</b></p><p>{n.summary}</p>{n.next_step&&<p>الخطوة التالية: {n.next_step}</p>}</div>)}</>}
 </>}
