import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {Opportunity,ParkedAircraft,CalendarEvent} from './data/types';
type Brief={pending:Opportunity[];parked:ParkedAircraft[];events:CalendarEvent[];failed:string[]};
const L=(s:string)=><span dir="ltr">{s}</span>;
// العين الكبرى: ملخص صباحي من البيانات الحقيقية فقط. كل سطر له مصدر، ولا نقول «فحصت» إلا لما نكون فحصنا فعلًا.
export default function MorningBrief(){
 const [b,setB]=useState<Brief|null>(null),[at,setAt]=useState('');
 const load=async()=>{const failed:string[]=[];
  const [o,p,c]=await Promise.all([
   api.listOpportunities().catch(()=>{failed.push('الفرص');return [] as Opportunity[]}),
   api.parkedAircraft().catch(()=>{failed.push('الطيارات الواقفة');return [] as ParkedAircraft[]}),
   api.demandCalendar(14).catch(()=>{failed.push('تقويم الطلب');return [] as CalendarEvent[]})]);
  setB({pending:o.filter(x=>x.status==='ACTIVATION_PENDING'),parked:p,events:c,failed});setAt(new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}))};
 useEffect(()=>{load()},[]);
 if(!b)return <section className="sec"><div className="mono">THE KING'S EYE</div><h2>العين بتراجع الشبكة…</h2></section>;
 const hot=b.parked.filter(a=>a.related_demand_signals>0||a.open_explicit_requests>0);
 const soon=b.events.filter(e=>e.days_until<=14);
 const items:{c:string;t:string;d:string}[]=[];
 if(b.pending.length)items.push({c:'🟡',t:`${b.pending.length} فرصة بتستنى موافقتك`,d:'مفيش حاجة هتتبعت لأي عميل قبل ما توافق.'});
 if(hot.length)items.push({c:'🟡',t:`${hot.length} طيارة واقفة جنبها إشارة طلب أو طلب عميل`,d:'الوقوف مش معناه إنها متاحة، والتأكيد من المشغّل.'});
 if(soon.length)items.push({c:'🟢',t:`${soon.length} إشارة فعالية خلال 14 يوم`,d:'إشارات محتملة من مصادر عامة، مش طلبات مؤكدة.'});
 return <section className="sec"><div className="mono">THE KING'S EYE · WATCHING<span className="badge b">LIVE DATA</span></div>
  <h2>صباح الخير</h2>
  <p className="lead" style={{margin:'0 0 8px'}}>راجعت الشبكة. {items.length?`فيه ${items.length} حاجات محتاجة انتباهك:`:'مفيش حاجة محتاجة انتباهك دلوقتي.'}</p>
  {items.map((i,k)=><div className="sg" key={k}><span>{i.c} <b style={{fontWeight:500}}>{i.t}</b></span><small>{i.d}</small></div>)}
  {b.failed.length>0&&<div className="nt" role="alert">ما قدرتش أراجع: {b.failed.join('، ')}. ده مش معناه إن مفيش جديد.</div>}
  <div className="cap">راجعت: الفرص · الطيارات الواقفة · {L('14d')} تقويم الطلب · آخر مراجعة {at}</div>
  <div className="act"><button className="g" onClick={load}>راجع تاني</button></div></section>;
}
