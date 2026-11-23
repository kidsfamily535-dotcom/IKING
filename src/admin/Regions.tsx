import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
// جاهزية الدول/المدن (مستوى 0 إلى 4): قراءة، اعتماد اقتراحات الوكيل، وتغيير مستوى بقرارك مع السبب والمصدر. لا يُسجَّل مستوى بلا مصدر.
type Rg={region_code:string;region_name:string|null;level:number;verification:string;basis:string;source_note:string|null;verified_at:string|null;review_due_at:string|null;freshness:string|null};
type Pr={id:string;region_code:string;region_name:string|null;from_level:number|null;to_level:number;reason:string|null;source_note:string|null};
const RVER:Record<string,string>={CONFIRMED:'مؤكد',LIKELY:'مرجّح'};
const RBASIS:Record<string,string>={OFFICIAL:'مصدر رسمي',TWO_INDEPENDENT:'مصدران مستقلان',OWNER:'بقرارك'};
const f=(d:string|null)=>d?new Date(d).toLocaleString('ar-u-nu-latn',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC':'—';
const E:Record<string,string>={mfa_required:'يلزم كود المصادقة. سجّل الدخول من جديد.',admin_only:'للمالك فقط.',already_decided:'تم البت فيها من قبل.'};
const et=(m:string)=>{for(const k in E)if(m.includes(k))return E[k];return 'تعذّر التنفيذ.'};
export default function Regions({setErr}:{setErr:(s:string)=>void}){
 const [rg,setRg]=useState<Rg[]|null>(null),[pr,setPr]=useState<Pr[]>([]),[b,setB]=useState(false),[sel,setSel]=useState(''),[lv,setLv]=useState('0'),[why,setWhy]=useState(''),[src,setSrc]=useState(''),[hrs,setHrs]=useState(''),[ok,setOk]=useState('');
 const load=useCallback(async()=>{const [a,c]=await Promise.all([sb.from('region_levels_current').select('region_code,region_name,level,verification,basis,source_note,verified_at,review_due_at,freshness').order('level',{ascending:false}),sb.from('region_level_changes').select('id,region_code,region_name,from_level,to_level,reason,source_note').eq('status','PROPOSED').order('created_at',{ascending:false})]);
  if(a.error){setErr('تعذّر قراءة مستويات المدن. هذا لا يعني أن كل شيء هادئ.');setRg([])}else{const d=(a.data??[]) as Rg[];setRg(d);setSel(x=>x||d[0]?.region_code||'')}
  setPr(c.error?[]:(c.data??[]) as Pr[])},[setErr]);
 useEffect(()=>{load()},[load]);
 const decide=async(p:Pr,d:'APPROVE'|'REJECT')=>{if(!confirm(d==='APPROVE'?`اعتماد رفع ${p.region_name||p.region_code} إلى المستوى ${p.to_level}؟ يسري فورًا ويتسجّل باسمك.`:'رفض هذا الاقتراح؟'))return;
  setB(true);setErr('');const r=await sb.rpc('owner_decide_region_proposal',{p_change:p.id,p_decision:d});setB(false);if(r.error){setErr(et(r.error.message||''));return}load()};
 const set=async()=>{const name=rg?.find(x=>x.region_code===sel)?.region_name||sel,L=parseInt(lv,10);
  if(!why.trim()||!src.trim()){setErr('اكتب السبب والمصدر. مستوى بلا مصدر لا يُسجَّل.');return}
  if(!confirm(`تغيير ${name} إلى المستوى ${L}${L>=3?' (مستوى مرتفع: يتحرك به الوكيل فورًا)':''}؟ يسري فورًا ويتسجّل باسمك.`))return;
  setB(true);setErr('');setOk('');const r=await sb.rpc('owner_set_region_level',{p_region:sel,p_name:name,p_level:L,p_reason:why.trim(),p_source:src.trim(),p_review_hours:hrs?parseInt(hrs,10):null});setB(false);
  if(r.error){setErr(et(r.error.message||''));return}setOk('تم تسجيل المستوى.');setWhy('');setSrc('');setHrs('');load()};
 return <>
  {pr.map(p=><div className="ad-card" key={p.id}><h3>اقتراح من الوكيل: {p.region_name||p.region_code}<span className="ad-chip">من {p.from_level??'؟'} إلى {p.to_level}</span></h3>
   {p.reason&&<p>{p.reason}</p>}{p.source_note&&<p>المصدر: {p.source_note}</p>}
   <div className="ad-row"><button type="button" className="p" disabled={b} onClick={()=>decide(p,'APPROVE')}>اعتمد</button><button type="button" className="q" disabled={b} onClick={()=>decide(p,'REJECT')}>ارفض</button></div></div>)}
  {rg===null?<div className="ad-empty">جارٍ التحميل…</div>:!rg.length?<div className="ad-empty">لا توجد مدن مسجّلة بعد: المستوى غير معروف ويحتاج تحققًا.</div>:rg.map(x=><div className="ad-card" key={x.region_code}>
   <h3>{x.region_name||x.region_code} <small dir="ltr">{x.region_code}</small><span className="ad-chip">المستوى {x.level} من 4</span>
    <span className="ad-chip">{RVER[x.verification]||x.verification}</span><span className="ad-chip">{RBASIS[x.basis]||x.basis}</span>
    <span className="ad-chip" style={x.freshness==='STALE'?{borderColor:'#b3261e',color:'#b3261e'}:undefined}>{x.freshness==='STALE'?'غير محدّث: المراجعة فاتت':'محدّث'}</span></h3>
   <p>تحقق: {f(x.verified_at)}{x.review_due_at?' · المراجعة القادمة: '+f(x.review_due_at):' · بلا موعد مراجعة'}</p><p>{x.source_note||'لا يوجد مصدر مسجّل.'}</p></div>)}
  {!!rg?.length&&<div className="ad-card"><h3>غيّر مستوى مدينة بنفسك</h3><p>المستوى 3 أو 4 معناه إن الوكيل بيتحرك فورًا. لازم سبب ومصدر.</p>
   <div className="ad-row"><select aria-label="المدينة" value={sel} onChange={e=>setSel(e.target.value)}>{rg.map(x=><option key={x.region_code} value={x.region_code}>{x.region_name||x.region_code}</option>)}</select>
    <select aria-label="المستوى" value={lv} onChange={e=>setLv(e.target.value)}>{[0,1,2,3,4].map(i=><option key={i} value={i}>المستوى {i}</option>)}</select>
    <input type="number" min={1} max={168} style={{maxWidth:170}} placeholder="ساعات للمراجعة" aria-label="ساعات للمراجعة" value={hrs} onChange={e=>setHrs(e.target.value)}/></div>
   <input maxLength={300} placeholder="السبب" aria-label="السبب" value={why} onChange={e=>setWhy(e.target.value)}/>
   <input maxLength={300} placeholder="المصدر (رابط أو اسم الجهة)" aria-label="المصدر" value={src} onChange={e=>setSrc(e.target.value)}/>
   <div className="ad-row"><button type="button" className="p" disabled={b} onClick={set}>اعتمد المستوى</button></div>{ok&&<p role="status">{ok}</p>}</div>}</>}
