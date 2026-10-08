import Route from './Route';
import {useCallback,useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,Companion,MyTrip,MyEmptyLeg,RouteWx} from './data/types';
import Guardian,{CompanionChips} from './Guardian';
import {useI18n,airportName} from './i18n';
const LOC={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'} as const;
const LT=(s:string|number)=><span dir="ltr">{s}</span>;
// رحلة العميل الحقيقية + طقس مطاريها من آخر رصد رسمي مخزّن. لا شيء هنا محاكاة، وما لا نعرفه نقول إننا لا نعرفه.
// التنبيهات التلقائية غير مفعّلة بعد، والواجهة تقول ذلك صراحة (wx.refresh).
export default function MyTrips({airports}:{airports:Airport[]}){
 const {t,lang,dir}=useI18n();
 const [trips,setTrips]=useState<MyTrip[]|null>(null),[loadErr,setLoadErr]=useState(false);
 const [wx,setWx]=useState<RouteWx[]|null>(null),[wxErr,setWxErr]=useState(false);
 const [kind,setKind]=useState<'TRIP'|'LEG'>('TRIP'),[legs,setLegs]=useState<MyEmptyLeg[]>([]),[seats,setSeats]=useState(''),[note,setNote]=useState('');
 const [comp,setComp]=useState<Companion[]>([]),[o,setO]=useState(''),[d,setD]=useState(''),[at,setAt]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const nm=(c:string)=>{const a=airports.find(x=>x.iata===c);return a?airportName(a):c};
 const when=(x:string|null)=>x?new Date(x).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'}):t('mt.nodate');
 const load=useCallback(()=>api.listMyTrips().then(x=>{setTrips(x);setLoadErr(false)}).catch(()=>{setTrips([]);setLoadErr(true)}),[]);
 const loadLegs=useCallback(()=>api.listMyEmptyLegs().then(setLegs).catch(()=>setLegs([])),[]);
 useEffect(()=>{load();loadLegs()},[load,loadLegs]);
 const next=trips?.[0],key=next?next.origin+'-'+next.destination:'';
 // الطقس يتجدد في القاعدة كل 20 دقيقة تقريبًا، فنعيد القراءة كل 10 دقائق ما دامت الشاشة مفتوحة
 useEffect(()=>{setWx(null);if(!next)return;let live=true;
  const go=()=>api.routeWeather(next.origin,next.destination).then(r=>{if(live){setWx(r);setWxErr(false)}}).catch(()=>{if(live)setWxErr(true)});
  go();const i=setInterval(go,600000);return()=>{live=false;clearInterval(i)}},[key]);
 const save=async()=>{setErr('');if(!o||!d||o===d){setErr(t('mt.same'));return}
  const n=seats?Number(seats):null;if(kind==='LEG'&&n!==null&&(!Number.isInteger(n)||n<1||n>40)){setErr(t('mt.seats.bad'));return}
  setBusy(true);
  try{const iso=at?new Date(at).toISOString():null;
   if(kind==='LEG'){await api.addMyEmptyLeg(o,d,iso,n,note);await loadLegs()}else{await api.addMyTrip(o,d,iso,comp);await load()}
   setO('');setD('');setAt('');setSeats('');setNote('');setComp([])}catch{setErr(t('mt.err'))}finally{setBusy(false)}};
 const del=async(id:string)=>{try{await api.removeMyTrip(id);await Promise.all([load(),loadLegs()])}catch{setErr(t('mt.err'))}};
 const dirTxt=(v:string|null)=>v&&/^\d+$/.test(v)?v+'°':v;
 const leg=(r:RouteWx)=>{const ok=r.status==='CURRENT';
  const det=ok?[r.windKt!=null?t('wx.wind',{d:dirTxt(r.windDir)??'',k:r.windKt}):'',r.vis?t('wx.vis',{v:r.vis+' SM'}):'',r.ageMin!=null?t('wx.age',{n:r.ageMin}):''].filter(Boolean).join(' · '):'';
  return <div key={r.leg}><div className="row"><span>{t('wx.'+r.leg)} · {nm(r.code)}</span>
   <span style={{direction:dir}}>{ok?t(r.cat?'wx.cat.'+r.cat:'wx.cat.none'):t('wx.unknown')}<span className={`badge${ok?'':' u'}`}>{ok?t('b.live'):t('b.waiting')}</span></span></div>
   {det&&<small style={{color:'var(--dim)',display:'block',padding:'4px 0 8px'}}>{det}</small>}</div>};
 return <>
  {trips===null?null:!trips.length&&<div className="nt">{loadErr?t('mt.loadfail'):t('mt.none')}</div>}
  {next&&<div className="card"><div className="mono">{LT(`${next.origin} → ${next.destination}`)}<span className="badge">{t('mt.mine')}</span></div>
   <h3>{nm(next.origin)} · {nm(next.destination)}</h3>
   <div className="row"><span>{t('j.departure')}</span><span style={{direction:dir}}>{when(next.departureAt)}</span></div>
   <div className="act"><button className="g" onClick={()=>del(next.id)}>{t('mt.remove')}</button></div>
   <div className="mono" style={{margin:'20px 0 4px'}}>{t('j.cap.wx')}</div>
   {wx&&wx.map(leg)}
   {wxErr&&<div className="nt" role="alert">{t('wx.fail')}</div>}
   {wx&&wx.some(r=>r.status==='CURRENT')&&<small style={{color:'var(--dim)',display:'block'}}>{t('wx.src')}</small>}
   <small style={{color:'var(--dim)',display:'block',marginTop:6}}>{t('wx.refresh')}</small>
   <Guardian trip={next} wx={wx} nm={nm} onChange={load}/></div>}
  {trips&&trips.slice(1).map(x=><div className="row" key={x.id}><span><Route from={nm(x.origin)} to={nm(x.destination)}/></span><span style={{direction:dir}}>{when(x.departureAt)} <button className="g" style={{padding:'0 10px'}} onClick={()=>del(x.id)}>{t('mt.remove')}</button></span></div>)}
  {legs.length>0&&<><div className="mono" style={{margin:'24px 0 4px'}}>{t('mt.legs.title')}</div>
   {legs.map(x=><div className="row" key={x.id}><span><Route from={nm(x.origin)} to={nm(x.destination)}/>{x.seats?<small style={{color:'var(--dim)'}}> · {t('mt.seats.n',{n:x.seats})}</small>:null}<span className="badge u">{t('mt.leg.pending')}</span></span>
    <span style={{direction:dir}}>{when(x.departureAt)} <button className="g" style={{padding:'0 10px'}} onClick={()=>del(x.id)}>{t('mt.remove')}</button></span></div>)}
   <small style={{color:'var(--dim)',display:'block',marginTop:6}}>{t('mt.leg.rule')}</small></>}
  <div className="mono" style={{margin:'24px 0 4px'}}>{t(kind==='LEG'?'mt.leg.add':'mt.title')}</div>
  <div className="act" role="group" aria-label={t('mt.kind')} style={{justifyContent:'flex-start',gap:8}}>
   <button className={kind==='TRIP'?'':'g'} aria-pressed={kind==='TRIP'} onClick={()=>{setKind('TRIP');setErr('')}}>{t('mt.kind.trip')}</button>
   <button className={kind==='LEG'?'':'g'} aria-pressed={kind==='LEG'} onClick={()=>{setKind('LEG');setErr('')}}>{t('mt.kind.leg')}</button></div>
  <div className="f2">
   <div><label>{t('mt.from')}</label><select aria-label={t('mt.from')} value={o} onChange={e=>setO(e.target.value)}><option value="">{t('mt.pick')}</option>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</select></div>
   <div><label>{t('mt.to')}</label><select aria-label={t('mt.to')} value={d} onChange={e=>setD(e.target.value)}><option value="">{t('mt.pick')}</option>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</select></div>
   <div><label>{t('mt.when')}</label><input type="datetime-local" aria-label={t('mt.when')} value={at} onChange={e=>setAt(e.target.value)}/></div>
   {kind==='LEG'&&<><div><label>{t('mt.seats')}</label><input type="number" inputMode="numeric" min={1} max={40} aria-label={t('mt.seats')} value={seats} onChange={e=>setSeats(e.target.value)}/></div>
   <div><label>{t('mt.note')}</label><input type="text" maxLength={300} aria-label={t('mt.note')} value={note} onChange={e=>setNote(e.target.value)}/></div></>}
  </div>
  {kind==='TRIP'&&<><p className="dim sm" style={{margin:'10px 0 6px'}}>{t('gd.who')}</p><CompanionChips value={comp} onChange={setComp}/></>}
  {kind==='LEG'&&<small style={{color:'var(--dim)',display:'block',marginBottom:8}}>{t('mt.leg.rule')}</small>}
  {err&&<div className="nt" role="alert">{err}</div>}
  <div className="act"><button disabled={busy} onClick={save}>{busy?t('mt.saving'):t(kind==='LEG'?'mt.leg.save':'mt.save')}</button></div>
 </>;
}
