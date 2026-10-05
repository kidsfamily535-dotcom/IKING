import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {FleetAircraft,ParkedAircraft,CalendarEvent} from './data/types';
const L=(s:string)=><span dir="ltr">{s}</span>;
const ago=(m:number|null)=>m===null?'—':m<60?`قبل ${m} دقيقة`:`قبل ${Math.round(m/60)} ساعة`;
const BASIS:Record<string,string>={EXPLICIT:'مذكور صراحةً',INFERRED_FROM_TITLE:'مُستنتَج من التسمية',UNKNOWN:'غير معلوم'};
const msg=(e:any)=>e?.message==='not authorized'?'هذه الشاشة مخصّصة لفريق العمل فقط (ادخل عبر «دخول حقيقي» بحساب المدير)':e?.message??'عذرًا، تعذّر إتمام الطلب. يُرجى المحاولة مجددًا.';

function FleetReport(){
 const [txt,setTxt]=useState(''),[ok,setOk]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[res,setRes]=useState<FleetAircraft[]|null>(null);
 const regs=txt.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
 const go=async()=>{setErr('');setRes(null);setBusy(true);try{setRes(await api.fleetReport(regs,ok))}catch(e){setErr(msg(e))}setBusy(false)};
 return <div className="card"><div className="mono">FLEET REPORT<span className="badge b">INFERRED</span></div><h3>تقرير الأسطول</h3>
  <p className="lead" style={{margin:'0 0 12px'}}>أدخل أرقام ذيل طائرات المشغّل (سطرًا لكل طائرة). ستفيدك العين بمواضع رصدها وبعدد الرحلات المستنتجة، استنادًا إلى تتبّع عام.</p>
  <textarea aria-label="أرقام ذيل الطائرات" dir="ltr" rows={4} placeholder={'A4O-AE\nTC-AKS'} value={txt} onChange={e=>setTxt(e.target.value)}/>
  <label className="ck"><input type="checkbox" checked={ok} onChange={e=>setOk(e.target.checked)}/> المشغّل أذِن بعرض بيانات التتبّع العامة لطائراته</label>
  <div className="act"><button disabled={!ok||!regs.length||regs.length>50||busy} onClick={go}>أعِدّ التقرير</button>{regs.length>50&&<span className="mono">MAX 50</span>}</div>
  {err&&<div className="nt" role="alert">{err}</div>}
  {res&&<><div className="nt">مُستنتَج من تتبّع عام، ولا يدلّ على التوافر ولا على الحجز.</div>
   {res.map(a=><div className="sg" key={a.registration}>
    <span><b style={{fontWeight:500}}>{L(a.registration)}</b>{a.icao_type&&<> · {L(a.icao_type)} · {a.category}</>}</span>
    <span className={`pr${a.found?'':' u'}`}>{a.found?'SEEN':'NOT SEEN'}</span>
    <small>{a.found?<>آخر رصد {ago(a.minutes_since_seen)} قرب {L(a.nearest_airport??'؟')} ({a.nearest_km} كم) · رحلات مستنتجة خلال آخر 48 ساعة: {a.legs_48h}{a.last_leg&&<> · آخر رحلة {L(`${a.last_leg.from??'?'} → ${a.last_leg.to??'?'}`)} ({a.last_leg.status})</>}</>:'لم تُرصَد في المسح الحالي (ربما خارج نطاق تغطية التتبّع)'}</small></div>)}</>}
 </div>;
}

function Parked(){
 const [r,setR]=useState<ParkedAircraft[]|null>(null),[err,setErr]=useState('');
 const load=()=>{setErr('');api.parkedAircraft().then(setR).catch(e=>setErr(msg(e)))};useEffect(load,[]);
 return <div className="card"><div className="mono">PARKED AIRCRAFT<span className="badge b">INFERRED</span></div><h3>طائرات رابضة بعد الهبوط</h3>
  <p className="lead" style={{margin:'0 0 8px'}}>طائرات هبطت خلال آخر 24 ساعة ولم يُرصَد لها إقلاع بعد ذلك. وهذا لا يعني أنها متاحة، والتأكيد من المشغّل وحده.</p>
  {err&&<div className="nt" role="alert">{err}</div>}
  {r&&!r.length&&<div className="empty">لا توجد طائرات رابضة مرصودة في الوقت الراهن</div>}
  {r?.map(a=><div className="sg" key={a.icao24}><span><b style={{fontWeight:500}}>{L(a.registration??a.icao24)}</b> · {a.category??a.icao_type} · {L(a.airport)}</span><span className="pr">PARKED {a.parked_hours}H</span>
   <small>إشارات طلب مرتبطة بالمطار: {a.related_demand_signals} · طلبات عملاء مفتوحة من المطار ذاته: {a.open_explicit_requests}</small></div>)}
  <div className="act"><button className="g" onClick={load}>حدّث</button></div></div>;
}

function Calendar(){
 const [r,setR]=useState<CalendarEvent[]|null>(null),[err,setErr]=useState('');
 useEffect(()=>{api.demandCalendar(120).then(setR).catch(e=>setErr(msg(e)))},[]);
 return <div className="card"><div className="mono">DEMAND CALENDAR · 120 DAYS<span className="badge b">INFERRED</span></div><h3>خريطة الطلب القادم</h3>
  <p className="lead" style={{margin:'0 0 8px'}}>فعاليات قادمة من مصادر عامة، مع عدد الطائرات المرصودة بالقرب من مطاراتها. إشارات محتملة وليست طلبات مؤكدة.</p>
  {err&&<div className="nt" role="alert">{err}</div>}
  {r&&!r.length&&<div className="empty">لا توجد فعاليات في هذه الفترة</div>}
  {r?.map(e=><div className="sg" key={e.signal_id}><span><b style={{fontWeight:500}}>{e.title}</b><span className="badge u">GRADE {e.grade}</span></span><span className="pr">{L(e.event_date)} · {e.days_until}d</span>
   <small>{e.airports?<>المطارات: {L(e.airports.join(' · '))} ({BASIS[e.airports_basis]}) · طائرات مرصودة قريبًا خلال آخر 24 ساعة: {e.tracked_aircraft_near_24h}</>:'المطار غير معلوم'} · {e.source??''}</small></div>)}</div>;
}

export default function OperatorValue(){
 return <section className="sec"><div className="mono">OPERATOR VALUE</div><h2>ما تقدّمه العين للمشغّل</h2>
  <p className="lead" style={{margin:'0 0 8px'}}>ثلاث أدوات تُثبت قيمتها قبل أن يُدخل المشغّل أي بيانات. وجميعها استنتاج من مصادر عامة.</p>
  <FleetReport/><Parked/><Calendar/></section>;
}
