import {useCallback,useEffect,useState} from 'react';
import './eye/mission.css';
import {realApi,routeWeatherPublic,listMissions,addMission,setMissionPriority,removeMission} from './data/supabaseApi';
import {sb} from './lib/supabase';
import {useI18n,airportName} from './i18n';
import {Switch,Toggle} from './cabin/Switch';
import {PriorityChips} from './Guardian';
import {missionStatus} from './data/guardian';
import type {Airport,Mission as M,MissionPurpose,Priority,RouteWx} from './data/types';
// «مهمتي»: العميل يدخل بمهمة (اجتماع، عائلة، مناسبة) لا بطلب طائرة. لا طائرة ولا حجز ولا مشغّل هنا.
// الحقيقي: طقس مطار الوجهة الرسمي (دالة عامة للقراءة فقط، يراه الزائر قبل أي بريد)، والمهمة المحفوظة (customer_missions، صفوف العميل فقط)،
// وكل ما فيها من كلام العميل نفسه ومن اختياره (النوع، العنوان، الموعد، الأهم له). لا نستنتج منه شيئًا.
// الموعد توقيت الوجهة كما كتبه، بلا تحويل منطقة زمنية. وما ليس مفعّلًا (بريد، تقدير زمن الخروج، سيارة) لا نوحي به.
const PURPOSES:MissionPurpose[]=['MEETING','FAMILY','EVENT'];
interface Draft{purpose:MissionPurpose|null;title:string;d:string;at:string;pr:Priority|null}
const EMPTY:Draft={purpose:null,title:'',d:'',at:'',pr:null};
const LOC={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'} as const;
const dirTxt=(v:string|null)=>v&&/^\d+$/.test(v)?v+'°':v;
export default function Mission(){
 const {t,lang}=useI18n();
 const [ap,setAp]=useState<Airport[]>([]),[authed,setAuthed]=useState<boolean|null>(null),[ms,setMs]=useState<M[]>([]),[sel,setSel]=useState(0),[adding,setAdding]=useState(false);
 const [f,setF]=useState<Draft>(EMPTY),[pv,setPv]=useState<Draft|null>(null),[em,setEm]=useState(''),[ok,setOk]=useState(false),[sent,setSent]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const [wx,setWx]=useState<RouteWx[]|null>(null),[wxErr,setWxErr]=useState(false);
 const nm=(c:string)=>{const a=ap.find(x=>x.iata===c);return a?airportName(a):c};
 const load=useCallback(()=>listMissions().then(x=>{setMs(x);setSel(0)}).catch(()=>setMs([])),[]);
 useEffect(()=>{realApi.listAirports().then(setAp);
  sb.auth.getSession().then(({data:{session}})=>{setAuthed(!!session);if(session)load()})},[load]);
 const cur=authed&&!adding&&ms.length?ms[Math.min(sel,ms.length-1)]:undefined;
 const dest=cur?cur.destination:pv&&!sent?pv.d:'';
 // الطقس يتجدد في القاعدة كل 20 دقيقة تقريبًا، فنعيد القراءة كل 10 دقائق ما دامت الصفحة مفتوحة
 useEffect(()=>{setWx(null);setWxErr(false);if(!dest)return;let live=true;
  const go=()=>routeWeatherPublic(dest,dest).then(r=>{if(live){setWx(r);setWxErr(false)}}).catch(()=>{if(live)setWxErr(true)});
  go();const i=setInterval(go,600000);return()=>{live=false;clearInterval(i)}},[dest]);
 const st=missionStatus(wx),row=wx?.find(r=>r.status==='CURRENT');
 const fmt=(v:string)=>new Date(v).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'});
 const head=(m:{purpose:MissionPurpose|null;title:string|null})=>m.title||(m.purpose?t('ms.p.'+m.purpose):t('ms.untitled'));
 const submit=async()=>{setErr('');if(!f.d){setErr(t('ms.need'));return}
  if(!authed){setPv(f);return}
  setBusy(true);
  try{await addMission({purpose:f.purpose,title:f.title,destination:f.d,arriveLocal:f.at||null,priority:f.pr});await load();setAdding(false);setF(EMPTY)}catch{setErr(t('ms.err'))}finally{setBusy(false)}};
 const keep=async()=>{setErr('');if(!pv)return;if(!em.includes('@')||!ok){setErr(t('ms.needEmail'));return}
  setBusy(true);
  try{try{localStorage.setItem('iking_mission_want',JSON.stringify({u:pv.purpose,t:pv.title,d:pv.d,at:pv.at,p:pv.pr}))}catch{/* التخزين غير متاح */}
   const r=await sb.auth.signInWithOtp({email:em.trim(),options:{emailRedirectTo:location.origin}});
   if(r.error)throw r.error;setSent(em.trim())}catch{setErr(t('ms.err'))}finally{setBusy(false)}};
 const savePri=async(v:Priority|null)=>{if(!cur)return;setErr('');try{await setMissionPriority(cur.id,v);const keepId=cur.id,x=await listMissions();setMs(x);setSel(Math.max(0,x.findIndex(y=>y.id===keepId)))}catch{setErr(t('ms.err'))}};
 const del=async(id:string)=>{try{await removeMission(id);await load()}catch{setErr(t('ms.err'))}};
 const Status=<>
  <div className="nt" role="status">{wxErr?t('wx.fail'):t('ms.'+st.state,{a:nm(st.code||dest),n:st.age})}</div>
  {row&&!wxErr&&<p className="ms-wx">{[t(row.cat?'wx.cat.'+row.cat:'wx.cat.none'),row.windKt!=null?t('wx.wind',{d:dirTxt(row.windDir)??'',k:row.windKt}):'',row.vis?t('wx.vis',{v:row.vis+' SM'}):'',row.ageMin!=null?t('wx.age',{n:row.ageMin}):''].filter(Boolean).join(' · ')}</p>}
  <p className="dim sm">{t('ms.note')}</p></>;
 const form=<div className="form">
  <div><span className="lb">{t('ms.what')}</span>
   <div className="chips" role="group" aria-label={t('ms.what')}>{PURPOSES.map(p=>{const on=f.purpose===p;return <button key={p} type="button" className={on?'on':''} aria-pressed={on} onClick={()=>setF({...f,purpose:on?null:p})}>{t('ms.p.'+p)}</button>})}</div></div>
  <label>{t('ms.title')}<input type="text" maxLength={80} value={f.title} placeholder={t('ms.title.ph')} onChange={e=>setF({...f,title:e.target.value})}/></label>
  <label>{t('ms.to')}<select value={f.d} onChange={e=>setF({...f,d:e.target.value})}><option value="">{t('ms.pick')}</option>{ap.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</select></label>
  <label>{t('ms.when')}<input type="datetime-local" value={f.at} onChange={e=>setF({...f,at:e.target.value})}/></label>
  <div><span className="lb">{t('pr.q')}</span><PriorityChips value={f.pr} onChange={v=>setF({...f,pr:v})}/><small className="dim sm">{t('pr.note')}</small></div>
  {err&&<p className="er" role="alert">{err}</p>}
  <div className="act"><Switch primary busy={busy} disabled={authed===null} label={busy?t('ms.saving'):authed?t('ms.save'):t('ms.see')} onActivate={submit}/>
   {adding&&<Switch small label={t('d.back')} onActivate={()=>{setAdding(false);setErr('')}}/>}</div></div>;
 const sub=(m:{destination?:string;d?:string;arriveLocal?:string|null;at?:string})=>{const a=m.arriveLocal??m.at??'';return <p className="dim">{nm(m.destination??m.d??'')} · {a?t('ms.at',{w:fmt(a)}):t('ms.noTime')}</p>};
 return <section className="ms" aria-live="polite"><h2>{t('ms.h')}</h2>{!cur&&!pv&&!sent&&<p className="lead">{t('ms.sub')}</p>}
  {sent?<><h3>{t('ms.sentH')}</h3><p className="dim">{t('ms.sentB',{e:sent})}</p></>
  :cur?<><h3>{head(cur)}</h3>{sub(cur)}{Status}
    <div className="blk"><span className="lb">{t('pr.q')}</span><PriorityChips value={cur.priority} onChange={savePri}/><small className="dim sm">{t('pr.note')}</small>{err&&<p className="er" role="alert">{err}</p>}</div>
    {ms.length>1&&<div className="blk"><span className="lb">{t('ms.mine')}</span><div className="chips">{ms.map((x,i)=><button key={x.id} type="button" className={i===sel?'on':''} onClick={()=>setSel(i)}>{head(x)}</button>)}</div></div>}
    <div className="act"><Switch small label={t('ms.add')} onActivate={()=>{setAdding(true);setF(EMPTY);setErr('')}}/><Switch small label={t('ms.remove')} onActivate={()=>del(cur.id)}/></div></>
  :pv?<><h3>{head({purpose:pv.purpose,title:pv.title.trim()||null})}</h3>{sub(pv)}{Status}
    <div className="blk keep"><h4>{t('ms.keepH')}</h4><p className="dim">{t('ms.keepB')}</p>
     <div className="form"><label>{t('ms.email')}<input type="email" autoComplete="email" inputMode="email" value={em} onChange={e=>setEm(e.target.value)}/></label>
      <Toggle checked={ok} onChange={setOk}>{t('ms.consent')}</Toggle>
      {err&&<p className="er" role="alert">{err}</p>}
      <div className="act"><Switch primary busy={busy} label={busy?t('ms.saving'):t('ms.keepGo')} onActivate={keep}/><Switch small label={t('d.back')} onActivate={()=>{setPv(null);setErr('')}}/></div></div></div></>
  :form}</section>;
}
