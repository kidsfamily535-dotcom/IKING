import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import {Chip} from './ui';
// «صيد النهارده»: تقرير يجهّزه الفريق ويعتمده الأدمن قبل ما يظهر هنا. لا هوية عميل ولا درجات ولا هامش.
// ردود المشغّل (مهتم / مش مناسب / تفاصيل / عندي طيارة) بتروح للفريق فقط، ولا بتفتح أي تواصل تلقائي.
type It={route:string;when?:string;reason:string;confidence:'VERIFIED'|'ESTIMATED'|'UNCONFIRMED'};
type Rp={item_idx:number;reply:string;note:string|null};
type Rep={id:string;report_date:string;items:It[];replies:Rp[]};
const TX={
 ar:{h:'صيد النهارده',p:'فرص لقاها الوكيل على خطوطك. الفريق راجعها قبل ما تظهر لك، وما فيها أي بيانات عن عميل.',none:'مفيش تقرير معتمد النهارده. أول ما الفريق يعتمد تقرير هيظهر هنا.',err:'تعذّر تحميل التقرير. ده مش معناه إنه فاضي.',
  c:{VERIFIED:'مؤكد',ESTIMATED:'تقديري',UNCONFIRMED:'غير مؤكد'},r:{INTERESTED:'مهتم',NOT_FIT:'مش مناسب',DETAILS:'عايز تفاصيل',HAVE_AIRCRAFT:'عندي طيارة متاحة'},
  note:'ملاحظة للفريق (اختياري)',sent:'سُجّل ردك',foot:'ردّك بيوصل للفريق بس. مفيش حد هيتواصل معاك أو مع حد غيرك تلقائيًا.',when:'الموعد'},
 en:{h:'Today’s hunt',p:'Opportunities the agent found on your routes. Our team reviews them before you see them, and they hold no client data.',none:'No approved report today. It will appear here once the team approves one.',err:'Could not load the report. That does not mean it is empty.',
  c:{VERIFIED:'Verified',ESTIMATED:'Estimated',UNCONFIRMED:'Unconfirmed'},r:{INTERESTED:'Interested',NOT_FIT:'Not a fit',DETAILS:'Want details',HAVE_AIRCRAFT:'I have an aircraft'},
  note:'Note for the team (optional)',sent:'Your reply is recorded',foot:'Your reply reaches our team only. Nobody is contacted automatically.',when:'When'}};
const tone={VERIFIED:'ok',ESTIMATED:'est',UNCONFIRMED:'unk'} as const;
export default function Hunt(){
 const {lang}=useI18n();const T=lang==='ar'?TX.ar:TX.en;
 const [rows,setRows]=useState<Rep[]|null>(null),[bad,setBad]=useState(false),[note,setNote]=useState<Record<string,string>>({}),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{const r=await sb.rpc('operator_hunt_today');if(r.error){setBad(true);setRows([]);return}setBad(false);setRows((r.data??[]) as Rep[])},[]);
 useEffect(()=>{load()},[load]);
 const reply=async(rep:Rep,i:number,v:string)=>{const k=rep.id+i;setBusy(k);const r=await sb.rpc('operator_hunt_reply',{p_report:rep.id,p_idx:i,p_reply:v,p_note:note[k]??null});setBusy('');if(r.error){setBad(true);return}setBad(false);await load()};
 if(rows===null)return <section className="sk-hunt"><p className="sk-quiet">…</p></section>;
 return <section className="sk-hunt" aria-label={T.h}><h2>{T.h}</h2><p className="sk-trust">{T.p}</p>
  {bad&&<div className="sk-err" role="alert">{T.err}</div>}
  {!bad&&rows.length===0&&<p className="sk-quiet">{T.none}</p>}
  {rows.map(rep=>rep.items.map((it,i)=>{const k=rep.id+i;const mine=rep.replies.find(x=>x.item_idx===i);
   return <article className="sk-hcard" key={k}><header><b>{it.route}</b><Chip tone={tone[it.confidence]??'unk'}>{T.c[it.confidence]??T.c.UNCONFIRMED}</Chip></header>
    {it.when&&<p><small>{T.when}:</small> {it.when}</p>}<p>{it.reason}</p>
    <div className="sk-hbtn" role="group">{(['INTERESTED','NOT_FIT','DETAILS','HAVE_AIRCRAFT'] as const).map(v=><button type="button" key={v} className={mine?.reply===v?'on':'g'} disabled={busy===k} aria-pressed={mine?.reply===v} onClick={()=>reply(rep,i,v)}>{T.r[v]}</button>)}</div>
    <input className="sk-hnote" value={note[k]??mine?.note??''} maxLength={500} placeholder={T.note} aria-label={T.note} onChange={e=>setNote({...note,[k]:e.target.value})}/>
    {mine&&<small className="sk-quiet" role="status">{T.sent}: {T.r[mine.reply as keyof typeof T.r]}</small>}</article>}))}
  <small className="sk-quiet">{T.foot}</small></section>}
