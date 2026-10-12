import {useCallback,useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {Switch} from './cabin/Switch';
import Route from './Route';
import {useI18n,airportName,type Lang} from './i18n';
import type {Airport} from './data/types';
import './profile.css';

// «اللي قلته للعين»: صفحة كلام لا إعدادات. كل سطر جملة قالها العميل بنفسه، والنسيان بنقرة.
// الكتم يمر عبر الدالتين mute_my_route وunmute_my_route (التحقق والتدقيق في القاعدة). لا درجات ولا استنتاجات هنا.
type Mute={id:string;origin_code:string|null;destination_code:string|null};
const S:Record<'ar'|'en',Record<string,string>>={
ar:{nav:'اللي قلته للعين',h:'اللي قلته للعين',intro:'كل ما هنا من كلامك أنت. العين لا تذكر لك ما طلبت تجاهله، وتفتحه من جديد متى شئت.',
 none:'لم تطلب منا تجاهل أي مسار.',skip:'لا أريد أن أسمع عن',any:'أي مكان',from:'من',to:'إلى',tell:'قلها للعين',telling:'جارٍ الحفظ…',reopen:'افتحه من جديد',
 done:'تمام. لن نذكر لك هذا المسار مرة أخرى.',undo:'تراجع',reopened:'تمام، فتحناه من جديد.',
 loadErr:'تعذّر تحميل ما قلته. حاول مرة أخرى.',saveErr:'تعذّر الحفظ. حاول مرة أخرى.',pickOne:'اختر مكان البداية أو الوجهة',same:'البداية والوجهة لا يمكن أن تكونا نفس المطار',loading:'جارٍ التحميل…'},
en:{nav:'What you told the Eye',h:'What you told the Eye',intro:'Everything here is in your own words. The Eye will not mention what you asked it to skip, and you can reopen it any time.',
 none:'You have not asked us to skip any route.',skip:'I do not want to hear about',any:'Anywhere',from:'From',to:'To',tell:'Tell the Eye',telling:'Saving…',reopen:'Reopen it',
 done:'Done. We will not mention this route again.',undo:'Undo',reopened:'Done, it is open again.',
 loadErr:'Could not load what you told us. Try again.',saveErr:'Could not save. Try again.',pickOne:'Choose a start or a destination',same:'Start and destination cannot be the same airport',loading:'Loading…'}};
const T=(l:Lang)=>S[l==='ar'?'ar':'en'];
export const saidNav=(l:Lang)=>T(l).nav;

export default function Said({airports}:{airports:Airport[]}){
 const {lang}=useI18n();const t=T(lang);
 const [rows,setRows]=useState<Mute[]|null>(null),[loadErr,setLoadErr]=useState(false);
 const [o,setO]=useState(''),[d,setD]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[last,setLast]=useState<string|null>(null);
 const name=(c:string|null)=>{if(!c)return t.any;const a=airports.find(x=>x.iata===c);return a?airportName(a):c};
 const load=useCallback(async()=>{
  const {data,error}=await sb.from('activation_route_mutes').select('id,origin_code,destination_code').is('removed_at',null).order('created_at',{ascending:false});
  if(error){setLoadErr(true);setRows([]);return}setLoadErr(false);setRows((data??[]) as Mute[])},[]);
 useEffect(()=>{load()},[load]);
 const tell=async()=>{setErr('');setMsg('');setLast(null);
  if(!o&&!d){setErr(t.pickOne);return}if(o&&o===d){setErr(t.same);return}
  setBusy(true);const {data,error}=await sb.rpc('mute_my_route',{p_origin:o||null,p_dest:d||null});setBusy(false);
  const r=(data??{}) as any;if(error||r.error){setErr(t.saveErr);return}
  setO('');setD('');setMsg(t.done);if(!r.already)setLast(r.mute_id??null);await load()};
 const reopen=async(id:string,said=false)=>{setErr('');
  const {data,error}=await sb.rpc('unmute_my_route',{p_id:id});const r=(data??{}) as any;
  if(error||r.error){setErr(t.saveErr);return}setLast(null);setMsg(said?'':t.reopened);await load()};
 const opts=<>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</>;
 if(rows===null)return <p className="dim" role="status">{t.loading}</p>;
 return <div className="pf sd">
  <h2 className="big">{t.h}</h2>
  <p className="dim">{t.intro}</p>
  {loadErr&&<div className="nt" role="alert">{t.loadErr}</div>}
  {rows.length===0&&!loadErr&&<p className="sd-none">{t.none}</p>}
  {rows.length>0&&<ul className="pf-names sd-list">{rows.map(m=><li key={m.id}>
   <span className="sd-line">{t.skip} <Route from={name(m.origin_code)} to={name(m.destination_code)}/></span>
   <button type="button" className="g sm" onClick={()=>reopen(m.id)}>{t.reopen}</button></li>)}</ul>}
  <div className="pf-blk sd-say">
   <span className="sd-line">{t.skip}</span>
   <div className="pf-add" style={{gridTemplateColumns:'1fr 1fr'}}>
    <select aria-label={t.from} value={o} onChange={e=>setO(e.target.value)}><option value="">{t.from} · {t.any}</option>{opts}</select>
    <select aria-label={t.to} value={d} onChange={e=>setD(e.target.value)}><option value="">{t.to} · {t.any}</option>{opts}</select>
   </div>
   <div className="pf-go"><Switch small busy={busy} disabled={busy} label={busy?t.telling:t.tell} onActivate={tell}/></div>
  </div>
  {err&&<div className="nt" role="alert">{err}</div>}
  {msg&&<p className="sd-ok" role="status">{msg}{last&&<> <button type="button" className="g sm" onClick={()=>reopen(last,true)}>{t.undo}</button></>}</p>}
 </div>;
}
