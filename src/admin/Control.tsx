import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';

type Flag={key:string;value:boolean;note?:string|null;switchable?:boolean};
type Job={jobname:string;active:boolean;state:string;schedule:string;protected?:boolean};
type Ctl={mode:string;flags:Flag[];jobs:Job[]};
type Dir={id:string;body:string;scope:string;status:string;created_at:string};
type OD={id:string;company:string;body:string;status:string;created_at:string;expires_at:string};
type Hl={jobname:string;state:string;last_proof_at:string|null};

const SCOPES:[string,string][]=[['GENERAL','عامة'],['HUNTER','الصياد'],['CUSTOMER','العميل'],['SECRETARY','السكرتير'],['OPERATOR','المشغّل']];
const DSTATE:Record<string,string>={ACTIVE:'لم يستلمها الوكيل بعد',ACKED:'استلمها الوكيل',DONE:'نُفّذت'};
const HSTATE:Record<string,string>={OK:'سليم',STALE:'متأخر',FAILED:'فشل',NEVER_RAN:'لم يعمل بعد',OFF:'متوقف',PAUSED:'موقوف مؤقتًا'};
const SWFLAGS:Record<string,string>={hermes_enabled:'Hermes — بوابة النماذج',xpoz_enabled:'XPOZ — إشارات عامة من السوشيال',apify_enabled:'Apify — جمع من صفحات الويب العامة'};
const ERRS:Record<string,string>={mfa_required:'يلزم كود المصادقة. سجّل الدخول من جديد.',over_budget:'تجاوز السقف اليومي.',admin_only:'للمالك فقط.',protected_job:'مهمة محمية ولا تُقفل.',agent_paused_resume_first:'الوكيل موقوف. استأنفه أولًا.',locked_by_owner_rule:'قفل التواصل التلقائي يتغيّر بقرارك الصريح فقط، مش من هنا.',not_switchable:'هذا المفتاح غير قابل للتغيير من هنا.',unknown_job:'مهمة غير معروفة.'};
const errText=(m:string)=>{for(const k in ERRS)if(m.includes(k))return ERRS[k];return 'تعذّر التنفيذ.'};
const grp=(n:string)=>/^hunt-/.test(n)?'الصيادون':/^(eye-|secretary-|trip-alerts)/.test(n)?'العيون والمتابعة والتنبيهات':/^(weather-|aircraft-|infer-|demand-wikidata)/.test(n)?'بيانات حية':'أخرى';
const ORDER=['الصيادون','العيون والمتابعة والتنبيهات','بيانات حية','أخرى'];
const ago=(d:string|null)=>d?new Date(d).toLocaleString('ar-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC':'—';

export default function Control({setErr}:{setErr:(s:string)=>void}){
 const [c,setC]=useState<Ctl|null>(null),[dirs,setDirs]=useState<Dir[]|null>(null),[hl,setHl]=useState<Hl[]|null>(null),[q,setQ]=useState<{f:number;t:number}|null>(null);
 const [od,setOd]=useState<OD[]|null>(null),[body,setBody]=useState(''),[scope,setScope]=useState('GENERAL'),[days,setDays]=useState('7'),[b,setB]=useState(false);
 const load=useCallback(async()=>{
  const [a,d,h,p,o]=await Promise.all([sb.rpc('owner_controls'),sb.from('owner_directives').select('id,body,scope,status,created_at').in('status',['ACTIVE','ACKED']).order('created_at',{ascending:false}).limit(20),sb.rpc('agent_health'),sb.from('owner_prefs').select('quiet_from,quiet_to').eq('id',1).maybeSingle(),sb.rpc('admin_list_operator_directives')]);setOd(o.error||!Array.isArray(o.data)?null:o.data as OD[]);
  setC(a.error||!a.data?null:a.data as Ctl);setDirs(d.error?[]:(d.data??[]) as Dir[]);setHl(h.error||!Array.isArray(h.data)?null:h.data as Hl[]);setQ(p.data?{f:p.data.quiet_from,t:p.data.quiet_to}:null);
  if(a.error)setErr('تعذّر قراءة المفاتيح. هذا لا يعني أنها كلها شغالة أو واقفة.')},[setErr]);
 useEffect(()=>{load()},[load]);
 const run=async(fn:string,args:Record<string,unknown>,ask?:string)=>{
  if(ask&&!confirm(ask))return;setB(true);setErr('');const r=await sb.rpc(fn,args);setB(false);
  if(r.error){setErr(errText(r.error.message||''));return false}await load();return true};
 const paused=c?.mode==='PAUSED';
 const bad=(hl??[]).filter(x=>x.state!=='OK');
 const row=(t:string,sub:string,on:boolean,fn:(v:boolean)=>void)=><div className="ad-card" key={t}><h3>{t}<span className="ad-chip">{on?'يعمل':'متوقف'}</span></h3>{sub&&<p>{sub}</p>}
  <div className="ad-row"><button type="button" className={on?'q':'p'} disabled={b||paused} onClick={()=>fn(!on)}>{on?'إيقاف':'تشغيل'}</button></div></div>;
 return <>
  <div className="ad-card"><h3>حالة الوكيل<span className="ad-chip">{!c?'غير معروفة':paused?'موقوف':'يعمل'}</span></h3>
   <p>{paused?'الوكيل موقوف بالكامل. لا يمكن تشغيل أي مفتاح قبل الاستئناف.':'قفل التواصل التلقائي لا يتغيّر من هنا أبدًا.'}</p>
   {c&&<div className="ad-row">{paused?<button type="button" className="p" disabled={b} onClick={()=>run('agent_resume',{})}>استئناف الوكيل</button>:<button type="button" className="q" disabled={b} onClick={()=>run('agent_pause',{p_reason:'owner_admin'},'إيقاف الوكيل بالكامل؟')}>إيقاف الوكيل</button>}</div>}</div>

  <h2 style={{margin:'20px 0 8px',fontSize:17}}>تعليماتك للوكيل ({dirs?.length??0})</h2>
  <div className="ad-card"><input value={body} maxLength={500} onChange={e=>setBody(e.target.value)} placeholder="اكتب تعليمة قصيرة للوكيل" style={{width:'100%'}}/>
   <div className="ad-row"><select value={scope} onChange={e=>setScope(e.target.value)}>{SCOPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <select value={days} onChange={e=>setDays(e.target.value)}>{[['1','يوم'],['3','3 أيام'],['7','أسبوع'],['30','شهر']].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <button type="button" className="p" disabled={b||body.trim().length<3} onClick={async()=>{if(await run('owner_send_directive',{p_body:body.trim(),p_scope:scope,p_days:parseInt(days,10)}))setBody('')}}>أرسل</button></div>
   <p style={{fontSize:13,marginTop:8}}>التعليمة معلومة للوكيل فقط. لا تفتح قفل التواصل ولا تتجاوز بوابات الموافقة.</p></div>
  {dirs?.map(d=><div className="ad-card" key={d.id}><p>{d.body}</p><p><span className="ad-chip">{SCOPES.find(s=>s[0]===d.scope)?.[1]??d.scope}</span><span className="ad-chip">{DSTATE[d.status]??d.status}</span></p>
   <div className="ad-row"><button type="button" className="q" disabled={b} onClick={()=>run('owner_cancel_directive',{p_id:d.id})}>إلغاء</button></div></div>)}

  <h2 style={{margin:'20px 0 8px',fontSize:17}}>توجيهات المشغّلين لوكلائهم{od?` (${od.length})`:''}</h2>
  {!od?<div className="ad-empty">تعذّر قراءة توجيهات المشغّلين.</div>:!od.length?<div className="ad-empty">لا توجد توجيهات نشطة من المشغّلين.</div>:od.map(x=><div className="ad-card" key={x.id}><h3>{x.company}<span className="ad-chip">{DSTATE[x.status]??x.status}</span></h3><p>{x.body}</p><p>تنتهي: {ago(x.expires_at)}</p>
   <div className="ad-row"><button type="button" className="q" disabled={b} onClick={()=>{const n=prompt('سبب الإلغاء؟ (اختياري)');if(n!==null)run('admin_cancel_operator_directive',{p_id:x.id,p_reason:n.trim()||null})}}>إلغاء التوجيه</button></div></div>)}

  {q&&<><h2 style={{margin:'20px 0 8px',fontSize:17}}>ساعات الهدوء (بتوقيت UTC)</h2>
   <div className="ad-card"><div className="ad-row"><span>من</span><select value={q.f} onChange={e=>setQ({...q,f:+e.target.value})}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{i}:00</option>)}</select>
    <span>إلى</span><select value={q.t} onChange={e=>setQ({...q,t:+e.target.value})}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{i}:00</option>)}</select>
    <button type="button" className="q" disabled={b} onClick={()=>run('owner_set_prefs',{p_from:q.f,p_to:q.t})}>حفظ</button></div></div></>}

  <h2 style={{margin:'20px 0 8px',fontSize:17}}>نبض الوكيل{hl?` — ${hl.length-bad.length} من ${hl.length} سليمة`:''}</h2>
  {!hl?<div className="ad-empty">تعذّر قراءة النبض. هذا لا يعني أن كل شيء سليم.</div>:!bad.length?<div className="ad-empty">كل المهام تعمل في موعدها.</div>:bad.map(x=><div className="ad-card" key={x.jobname}><h3>{x.jobname}<span className="ad-chip">{HSTATE[x.state]??x.state}</span></h3><p>آخر دليل: {ago(x.last_proof_at)}</p></div>)}

  {c&&<><h2 style={{margin:'20px 0 8px',fontSize:17}}>لوحة المفاتيح</h2>
   {c.flags.filter(f=>f.switchable&&f.key!=='auto_contact_locked').map(f=>row(SWFLAGS[f.key]||f.key,f.note?String(f.note).slice(0,110):'',!!f.value,v=>run('owner_flag_set',{p_key:f.key,p_value:v,p_reason:'owner_admin'},v?'تشغيل هذا المصدر؟ يشتغل تجريبي وبسقف يومي ومن غير أي تواصل مع أحد.':undefined)))}
   {ORDER.map(g=>{const js=c.jobs.filter(j=>!j.protected&&grp(j.jobname)===g);return js.length?<div key={g}><h3 style={{margin:'14px 0 6px',fontSize:15}}>{g}</h3>{js.map(j=>row(j.jobname,`الحالة: ${HSTATE[j.state]??j.state} | الجدول: ${j.schedule}`,j.active,v=>run('owner_job_set',{p_jobname:j.jobname,p_active:v,p_reason:'owner_admin'})))}</div>:null})}
   {c.jobs.some(j=>j.protected)&&<p style={{fontSize:13,marginTop:10}}>مهام محمية لا تُقفل: {c.jobs.filter(j=>j.protected).map(j=>j.jobname).join('، ')}</p>}</>}
 </>}
