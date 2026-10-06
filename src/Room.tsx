import Route from './Route';
import {useCallback,useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,MemoryItem,MyTrip,RouteWx} from './data/types';
import {useI18n,airportName} from './i18n';
import Glyph from './Glyph';
import Requests,{useMyRequests,reqNav} from './Requests';
const LOC={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'} as const;
const SAMPLE:MyTrip={id:'sim',origin:'RUH',destination:'JED',departureAt:null,createdAt:''};
const NAME={now:'room.n0',wx:'room.n1',trips:'room.n2',mem:'j.mem.title'} as const;
type Page=keyof typeof NAME|'req';
// شاشة العميل بعد الدخول: لحظة واحدة في كل مرة، بنفس لغة الجولة. لا شيء هنا محاكاة إلا حين تكون real=false (وتُعلَّم بذلك).
// الطقس والرحلات من القاعدة الحقيقية فقط. وما لا نعرفه نقول إننا لا نعرفه، وتنبيهات الرحلة غير مفعّلة ولا نوحي بغير ذلك.
export default function Room({airports,real}:{airports:Airport[];real:boolean}){
 const {t,lang}=useI18n();
 const [trips,setTrips]=useState<MyTrip[]|null>(real?null:[SAMPLE]),[loadErr,setLoadErr]=useState(false),[sel,setSel]=useState(0),[pg,setPg]=useState(0),[adding,setAdding]=useState(false);
 const [wx,setWx]=useState<RouteWx[]|null>(null),[wxErr,setWxErr]=useState(false);
 const [mem,setMem]=useState<MemoryItem[]>([]),[ed,setEd]=useState<string|null>(null),[val,setVal]=useState('');
 const [o,setO]=useState(''),[d,setD]=useState(''),[at,setAt]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const nm=(c:string)=>{const a=airports.find(x=>x.iata===c);return a?airportName(a):c};
 const when=(x:string|null)=>x?new Date(x).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'}):t('mt.nodate');
 const load=useCallback(()=>{if(!real)return Promise.resolve();return api.listMyTrips().then(x=>{setTrips(x);setLoadErr(false)}).catch(()=>{setTrips([]);setLoadErr(true)})},[real]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{api.listMemory().then(setMem)},[lang]);
 const cur=trips&&trips.length?trips[Math.min(sel,trips.length-1)]:undefined,key=cur?cur.origin+'-'+cur.destination:'';
 // الطقس يتجدد في القاعدة كل 20 دقيقة تقريبًا، فنعيد القراءة كل 10 دقائق ما دامت الشاشة مفتوحة
 useEffect(()=>{setWx(null);setWxErr(false);if(!cur||!real)return;let live=true;
  const go=()=>api.routeWeather(cur.origin,cur.destination).then(r=>{if(live){setWx(r);setWxErr(false)}}).catch(()=>{if(live)setWxErr(true)});
  go();const i=setInterval(go,600000);return()=>{live=false;clearInterval(i)}},[key,real]);
 const my=useMyRequests(real);
 // طلب الرحلة هو الفعل الأهم للعميل. يتقدم ليكون الصفحة الأولى حين ينتظر عرضٌ قراره، أو حين لا توجد رحلة مدخلة بعد؛ وإلا فهو الثانية
 const base=(cur?['now','wx','trips','mem']:['now','mem']).filter(p=>!(real&&p==='mem')) as Page[],offerReady=real&&my.offers.some(o=>o.status==='PRESENTED'),reqFirst=offerReady||(real&&trips!==null&&!cur);
 const pages:Page[]=!real?base:reqFirst?['req',...base]:[base[0],'req',...base.slice(1)],pi=Math.min(pg,pages.length-1),page=pages[pi];
 const pageName=(p:Page)=>p==='req'?reqNav(lang):t(NAME[p]);
 const save=async()=>{setErr('');if(!o||!d||o===d){setErr(t('mt.same'));return}setBusy(true);
  try{await api.addMyTrip(o,d,at?new Date(at).toISOString():null);setO('');setD('');setAt('');setAdding(false);setSel(0);setPg(0);await load()}catch{setErr(t('mt.err'))}finally{setBusy(false)}};
 const del=async(id:string)=>{try{await api.removeMyTrip(id);setSel(0);await load()}catch{setErr(t('mt.err'))}};
 const dirTxt=(v:string|null)=>v&&/^\d+$/.test(v)?v+'°':v;
 const route=(x:MyTrip)=><Route from={nm(x.origin)} to={nm(x.destination)}/>;
 const AddTrip=<div className="add"><div className="f2">
   <div><label>{t('mt.from')}</label><select aria-label={t('mt.from')} value={o} onChange={e=>setO(e.target.value)}><option value="">{t('mt.pick')}</option>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</select></div>
   <div><label>{t('mt.to')}</label><select aria-label={t('mt.to')} value={d} onChange={e=>setD(e.target.value)}><option value="">{t('mt.pick')}</option>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>)}</select></div>
   <div><label>{t('mt.when')}</label><input type="datetime-local" aria-label={t('mt.when')} value={at} onChange={e=>setAt(e.target.value)}/></div></div>
  {err&&<div className="nt" role="alert">{err}</div>}
  <div className="act"><button disabled={busy} onClick={save}>{busy?t('mt.saving'):t('mt.save')}</button></div></div>;
 const ok=wx?wx.filter(r=>r.status==='CURRENT').length:0;
 const leg=(r:RouteWx)=>{const cur=r.status==='CURRENT';
  const det=cur?[r.windKt!=null?t('wx.wind',{d:dirTxt(r.windDir)??'',k:r.windKt}):'',r.vis?t('wx.vis',{v:r.vis+' SM'}):'',r.ageMin!=null?t('wx.age',{n:r.ageMin}):''].filter(Boolean).join(' · '):'';
  return <li key={r.leg}><span>{t('wx.'+r.leg)} · {nm(r.code)}</span><b>{cur?t(r.cat?'wx.cat.'+r.cat:'wx.cat.none'):t('wx.unknown')}</b><span className={`badge${cur?'':' u'}`}>{cur?t('b.live'):t('b.waiting')}</span>{det&&<small>{det}</small>}</li>};
 const memV=(m:MemoryItem)=>m.value??t('memv.'+m.key);
 return <section className="rm" aria-live="polite">
  {!real&&<span className="chip">{t('show.demo')}</span>}
  <div className="pg" key={page}>
   {page==='now'&&(cur?<><Glyph k="plane" s={64}/><h2 className="big">{t('room.trip',{d:nm(cur.destination)})}</h2><p className="rt">{route(cur)}</p>
     <p className="dim">{t('j.departure')} · {real||cur.departureAt?when(cur.departureAt):t('mt.nodate')}</p><p className="dim">{t('room.read')}</p></>
    :<><Glyph k="air" s={64}/><h2 className="big">{t('room.ask')}</h2>
     {trips===null?null:loadErr&&<div className="nt" role="alert">{t('mt.loadfail')}</div>}{real&&trips!==null&&AddTrip}</>)}
   {page==='wx'&&cur&&<><Glyph k="wx" s={64}/>
    <h2 className="big">{!real?t('room.wx.sim'):wx===null?'':ok>=2?t('room.wx.ok'):ok===1?t('room.wx.part'):t('wx.unknown')}</h2>
    <ul>{real?wx&&wx.map(leg):[cur.origin,cur.destination].map(c=><li key={c}><span>{nm(c)}</span><b>{t('j.wx.row')}</b></li>)}</ul>
    {wxErr&&<div className="nt" role="alert">{t('wx.fail')}</div>}
    {ok>0&&<p className="dim sm">{t('wx.src')}</p>}{real&&<p className="dim sm">{t('wx.refresh')}</p>}</>}
   {page==='trips'&&trips&&<><Glyph k="radar" s={56}/><h2 className="big">{t('room.trips')}</h2>
    <ul>{trips.map((x,i)=><li key={x.id}><button className={`tp${i===sel?' on':''}`} onClick={()=>{setSel(i);setPg(0)}}>{route(x)} · {when(x.departureAt)}</button>{real&&<button className="g sm" onClick={()=>del(x.id)}>{t('mt.remove')}</button>}</li>)}</ul>
    {err&&!adding&&<div className="nt" role="alert">{err}</div>}
    {real&&(adding?AddTrip:<button className="g" onClick={()=>setAdding(true)}>{t('room.add')}</button>)}
    {lang==='ar'&&<button className="g" onClick={()=>{location.href='?view=journeys'}}>{t('j.trips.open')}</button>}</>}
   {page==='req'&&<Requests airports={airports} my={my} nm={nm}/>}
   {page==='mem'&&<><Glyph k="lock" s={56}/><h2 className="big">{t('j.mem.title')}</h2>
    <ul>{mem.map(m=><li className="mm" key={m.key}><span>{t('mem.'+m.key)}</span>{ed===m.key?<><input aria-label={t('mem.'+m.key)} value={val} onChange={e=>setVal(e.target.value)}/><button className="g sm" onClick={async()=>{await api.saveMemory(m.key,val);setMem(await api.listMemory());setEd(null)}}>{t('j.save')}</button></>:<><b>{memV(m)}</b><button className="g sm" onClick={()=>{setEd(m.key);setVal(memV(m))}}>{t('j.edit')}</button></>}</li>)}</ul>
    <p className="dim sm">{t('j.mem.note')}</p></>}
  </div>
  <nav className="nv" aria-label={t('room.trips')}>
   <button className="g" disabled={pi===0} onClick={()=>setPg(pi-1)}>{t('d.back')}</button>
   <span className="dots">{pages.map((p,i)=><button key={p} className={i===pi?'on':''} aria-label={pageName(p)} aria-current={i===pi} onClick={()=>setPg(i)}/>)}</span>
   <button disabled={pi===pages.length-1} onClick={()=>setPg(pi+1)}>{t('show.next')}</button>
  </nav></section>;
}
