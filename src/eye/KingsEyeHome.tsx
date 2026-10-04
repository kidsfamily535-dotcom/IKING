import {useEffect,useState} from 'react';
import {api} from '../data/api';
import type {Opportunity,ParkedAircraft,CalendarEvent} from '../data/types';
import {useI18n} from '../i18n';
import {useCopy} from './copy';
import {EyeMark,Truth} from './parts';
import type {Tone} from './day';
type Brief={pend:Opportunity[];parked:ParkedAircraft[];events:CalendarEvent[];failed:string[]};
const LOC:Record<string,string>={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'};
// العين الكبرى: ملخص من بيانات فُحصت فعلًا الآن. لا نقول «فحصتُ» إلا لما يتم الفحص، وما فشل لا نعرضه.
export default function KingsEyeHome({real}:{real:boolean}){
 const cp=useCopy();const {lang}=useI18n();
 const [b,setB]=useState<Brief|null>(null),[at,setAt]=useState(new Date());
 useEffect(()=>{let live=true;setB(null);const failed:string[]=[];
  Promise.all([
   api.listOpportunities().catch(()=>{failed.push(cp('c.opp'));return [] as Opportunity[]}),
   api.parkedAircraft().catch(()=>{failed.push(cp('l.rev'));return [] as ParkedAircraft[]}),
   api.demandCalendar(14).catch(()=>{failed.push(cp('l.opp'));return [] as CalendarEvent[]})
  ]).then(([o,p,c])=>{if(live){setB({pend:o.filter(x=>x.status==='ACTIVATION_PENDING'),parked:p,events:c.filter(e=>e.days_until<=14),failed});setAt(new Date())}});
  return()=>{live=false}},[real,lang]);
 if(!b)return <section className="sec ke-home"><EyeMark tone="watch"/><p className="lead" style={{textAlign:'center'}}>{cp('loading')}</p></section>;
 const hot=b.parked.filter(a=>a.related_demand_signals>0||a.open_explicit_requests>0);
 const reqs=b.parked.reduce((n,a)=>n+a.open_explicit_requests,0);
 const opp:string[]=[];
 if(b.pend.length)opp.push(cp('c.opp.pend',{n:b.pend.length}));
 if(hot.length)opp.push(cp('c.opp.park',{n:hot.length}));
 if(b.events.length)opp.push(cp('c.opp.ev',{n:b.events.length}));
 const n=(opp.length?1:0)+(reqs?1:0),tone:Tone=opp.length||reqs?'opp':'calm';
 const time=at.toLocaleTimeString(LOC[lang],{hour:'2-digit',minute:'2-digit'});
 return <section className="sec ke-home" aria-labelledby="ke-h">
  <div className="mono">THE KING'S EYE · WATCHING</div>
  <EyeMark tone={tone} label/>
  <h2 id="ke-h" className="ke-greet">{cp('greet')}</h2>
  <p className="lead ke-sub">{n?cp('greet.sub'):cp('greet.none')} <Truth sim={!real}/></p>
  <div className="kc-grid">
   <article className="kc t-risk quiet"><h3><i className="dot"/>{cp('c.mission')}</h3><p>{cp('c.mission.q')}</p></article>
   <article className={`kc t-opp${opp.length?'':' quiet'}`}><h3><i className="dot"/>{cp('c.opp')}</h3>{opp.length?opp.map(x=><p key={x}>{x}</p>):<p>{cp('c.opp.q')}</p>}</article>
   <article className={`kc t-calm${reqs?'':' quiet'}`}><h3><i className="dot"/>{cp('c.client')}</h3><p>{reqs?cp('c.client.n',{n:reqs}):cp('c.client.q')}</p></article>
  </div>
  {b.failed.length?<p className="ke-note" role="alert">{cp('checked.fail',{x:b.failed.join('، ')})}</p>
   :<p className="ke-note">{cp('checked')} {cp('checked.at',{t:time})}</p>}
 </section>;
}
