import {useEffect,useRef,useState} from 'react';
import {api,useRealApi} from './data/api';
import SignIn from './SignIn';
import OperatorRoom from './Operator';
import JourneyRoom from './Journey';
import DemoStory from './Demo';
import HoldRing from './Hold';
import LangSwitch from './LangSwitch';
import {useI18n,hasStoredLang,hasKey,catL,type Lang} from './i18n';
import type {Airport,AgentState,DataStatus,EventPriority,Opportunity,Role,Signal,DecisionPolicyRow} from './data/types';
const FLOW:AgentState[]=['WATCHING','DISCOVERING','THINKING','MATCHING','DECIDING','MONITORING','ANTICIPATING'];
const hm=(m:number)=>{const d=new Date(Date.now()-m*60000);return d.toTimeString().slice(0,5)};
const L=(s:string)=><span dir="ltr">{s}</span>;
const DS:Record<DataStatus,string>={CONFIRMED:'',LIVE:'',SIM:'b',INFERRED:'b',ESTIMATED:'b',UNKNOWN:'u'};
const Badge=({s}:{s:DataStatus})=><span className={`badge ${DS[s]}`}>{s}</span>;
const PR:Record<EventPriority,string>={SILENT:'SILENT',WATCH:'WATCH',INVESTIGATE:'INVESTIGATE',RECOMMEND:'RECOMMEND',ACT_INTERNAL:'ACT · INTERNAL',APPROVAL_REQUIRED:'APPROVAL REQUIRED',ESCALATE:'ESCALATE'};
const Eye=({an}:{an?:boolean})=><div className={`eye${an?' an':''}`} aria-hidden><i/></div>;

function proj(a:Airport,c:Airport,R:number,max:number){
 const r=Math.PI/180,dl=(a.lon-c.lon)*r,p1=c.lat*r,p2=a.lat*r;
 const d=6371*Math.acos(Math.min(1,Math.sin(p1)*Math.sin(p2)+Math.cos(p1)*Math.cos(p2)*Math.cos(dl)));
 const th=Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl));
 const k=Math.min(d,max)/max*R;return{x:300+k*Math.sin(th),y:300-k*Math.cos(th)};
}
function Radar({airports,arc,poster}:{airports:Airport[];arc?:[string,string];poster?:boolean}){
 const {t}=useI18n();const c=airports.find(a=>a.iata==='RUH');if(!c)return null;
 const P=Object.fromEntries(airports.map(a=>[a.iata,proj(a,c,270,2200)]));
 const ticks=Array.from({length:36},(_,i)=>i*10);
 const e=arc&&P[arc[0]]&&P[arc[1]]?arc.map(k=>P[k]):null;
 return <svg viewBox="0 0 600 600" role="img" aria-label={t('radar.aria')} className={poster?'poster':undefined} preserveAspectRatio="xMidYMid slice">
  {[67,135,202,270].map(r=><circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#f4ecdc" strokeOpacity=".1"/>)}
  {ticks.map(t=>{const a=t*Math.PI/180,m=t%30?4:10;return <line key={t} x1={300+270*Math.sin(a)} y1={300-270*Math.cos(a)} x2={300+(270-m)*Math.sin(a)} y2={300-(270-m)*Math.cos(a)} stroke="#f4ecdc" strokeOpacity=".3"/>})}
  <text x="12" y="304" fill="#f4ecdc99" fontSize="9" fontFamily="JetBrains Mono">270</text><text x="570" y="304" fill="#f4ecdc99" fontSize="9" fontFamily="JetBrains Mono">090</text>
  {e&&<path d={`M${e[0].x},${e[0].y} Q300,${Math.min(e[0].y,e[1].y)-60} ${e[1].x},${e[1].y}`} fill="none" stroke="#c9a961" strokeWidth="1.2"/>}
  {airports.map(a=>{const p=P[a.iata];return <g key={a.iata}><circle cx={p.x} cy={p.y} r={a.iata==='RUH'?3.5:2.2} fill={a.iata==='RUH'?'#c9a961':'#f4ecdc'}/><text x={p.x+6} y={p.y-5} fill="#f4ecdc99" fontSize="8.5" fontFamily="JetBrains Mono" letterSpacing="1">{a.iata}</text></g>})}
  <circle cx={P.JED?P.JED.x-26:0} cy={P.JED?P.JED.y+8:0} r="2.4" fill="#78a0c8" opacity=".8"/>
  <text x="300" y="590" textAnchor="middle" fill="#f4ecdc88" fontSize="8" fontFamily="JetBrains Mono" letterSpacing="2.5">{airports.length} POINTS OF AWARENESS · NO SIGNAL ASSUMED AVAILABLE</text>
 </svg>;
}

function Story({o,staff,onChange}:{o:Opportunity;staff:boolean;onChange:()=>void}){
 const {t}=useI18n();const [rej,setRej]=useState(false),[why,setWhy]=useState(''),[msg,setMsg]=useState('');
 const sp=o.scoreParts,total=sp.freshness+sp.sourceStrength+sp.urgency+sp.confidence,ok=o.availability==='CONFIRMED';
 return <div className="card"><div className="mono">OPPORTUNITY<span className="badge b">SIM</span></div>
  <h3>{L(`${o.origin} → ${o.destination}`)} · {catL(o.aircraftCategory)} · {t('seats',{n:o.seats})}</h3>
  <div className="row"><span>{t('st.label')}</span><span>{ok?<>{t('st.window')} <Badge s="CONFIRMED"/></>:<>{t('st.unknown')} <Badge s="UNKNOWN"/></>}</span></div>
  <div className="row"><span>{t('src')}</span><span>{o.source}</span></div>
  <div className="row"><span>{t('lastVerified')}</span><span>{o.verifiedMinAgo===null?t('notYet'):hm(o.verifiedMinAgo)}</span></div>
  <div className="row"><span>{t('expiresIn')}</span><span>{t('minutes',{n:o.expiresInMin})}</span></div>
  <div className="brief"><div className="mono">SCORE</div><span className="big">{total}</span><span className="mono"> / 100</span>
   <div className="parts"><div><small>{t('sp.freshness')}</small><b>{sp.freshness}/30</b></div><div><small>{t('sp.source')}</small><b>{sp.sourceStrength}/20</b></div><div><small>{t('sp.urgency')}</small><b>{sp.urgency}/30</b></div><div><small>{t('sp.confidence')}</small><b>{sp.confidence}/20</b></div></div>
   <ul>{o.reasons.map(r=><li key={r}>{r}</li>)}</ul></div>
  {o.matched&&<div className="nt e">{t('match',{seg:o.matched.segment,rel:o.matched.relevance,gate:o.matched.gate==='ALLOWED'?t('gate.allowed'):t('gate.blocked')})}{o.matched.gateReason&&` — ${o.matched.gateReason}`}</div>}
  {staff&&o.status==='ACTIVATION_PENDING'&&!msg&&<>
   <div className="nt">{t('approve.note')}</div>
   <div className="act"><HoldRing onDone={async()=>{await api.approveOpportunity(o.id);setMsg(t('approved.msg'));onChange()}}/><span className="mono">APPROVAL REQUIRED · HOLD</span><button className="g" onClick={()=>setRej(!rej)}>{t('reject')}</button></div>
   {rej&&<div className="act"><input aria-label={t('reject.reason.aria')} placeholder={t('reject.reason.ph')} value={why} onChange={e=>setWhy(e.target.value)}/><button className="g" disabled={!why.trim()} onClick={async()=>{await api.rejectOpportunity(o.id,why);setMsg(t('rejected.msg'));onChange()}}>{t('reject.confirm')}</button></div>}</>}
  {msg&&<div className="nt e">{msg}</div>}</div>;
}

function PolicyView(){
 const {t,lang}=useI18n();const [r,setR]=useState<DecisionPolicyRow[]>([]);useEffect(()=>{api.listPolicy().then(setR)},[lang]);
 return <details style={{marginBottom:48}}><summary className="mono" style={{cursor:'pointer'}}>DECISION POLICY · 8</summary>{r.map(x=><div className="row" key={x.decision}><span>{lang==='ar'||!hasKey('policy.'+x.decision)?x.descriptionAr:t('policy.'+x.decision)}</span><span className="pr">{x.decision}{x.requiresHuman?' · HUMAN':''}</span></div>)}</details>;
}
export default function App(){
 const {t,lang,setLang}=useI18n();const [role,setRole]=useState<Role|null>(null),[pick,setPick]=useState(false),[real,setReal]=useState(false),[login,setLogin]=useState(false);
 const [st,setSt]=useState<AgentState>('WATCHING'),[say,setSay]=useState('');
 const [ap,setAp]=useState<Airport[]>([]),[sg,setSg]=useState<Signal[]>([]),[op,setOp]=useState<Opportunity[]>([]);
 const load=()=>{api.listOpportunities().then(setOp)};
 useEffect(()=>{api.listAirports().then(setAp);api.listSignals().then(setSg);load()},[real,lang]);
 const run=async()=>{setSay('');setSay(await api.runPass(setSt))};
 const staff=role==='admin',table=op.filter(o=>o.status==='ACTIVATION_PENDING');
 const live=op.find(o=>o.availability==='CONFIRMED');
 return <>
  <div className="pill">{real?t('pill.live'):t('pill.demo')}</div><LangSwitch/>
  <section className="hero"><div className="poster" style={{position:'absolute',inset:0}}><Radar airports={ap} arc={['RUH','JED']} poster/></div>
   <div className="mono">ALWAYS WATCHING · 24 / 7</div><h1>THE KING'S EYE</h1><div className="sub">{t('hero.sub1')} <b>{t('hero.sub2')}</b></div>
   <Eye an={st!=='WATCHING'}/><div className="mono">{st}</div>
   <p className="lead">{t('hero.lead')}</p>
   {!pick?<button onClick={()=>setPick(true)}>{t('hero.enter')}</button>:<div className="roles" role="group" aria-label={t('hero.pick.aria')}>{(['admin','operator','customer'] as Role[]).map(r=><button key={r} className={role===r?'':'g'} onClick={()=>{setRole(r);setTimeout(()=>document.getElementById('room')?.scrollIntoView({behavior:'smooth'}),50)}}>{t('role.'+r)}</button>)}</div>}
   {pick&&<div className="mono" style={{marginTop:14,opacity:.6}}>{t('hero.demoaccess')}</div>}
   {pick&&!login&&!real&&<button className="g" style={{marginTop:14}} onClick={()=>setLogin(true)}>{t('hero.realLogin')}</button>}
   {login&&!real&&<SignIn onDone={(r,pl?:Lang)=>{useRealApi();setReal(true);setRole(r);setLogin(false);if(pl&&!hasStoredLang())setLang(pl,false)}}/>}
  </section>
  {role&&<><div id="bar"><b>{st}</b>{FLOW.map(f=><span key={f} className={`fc${f===st?' on':''}`}>{f}</span>)}<span className="ed">{role.toUpperCase()}</span></div>
  <main id="room">
   <DemoStory onState={setSt}/>
   {role==='customer'?<JourneyRoom airports={ap}/>:<>
   <section className="sec"><div className="mono">DISCOVERY</div><h2>{t('disc.title')}</h2><p className="lead" style={{margin:'0 0 8px'}}>{t('disc.lead')}</p>
    <div className="radar"><Radar airports={ap} arc={live?[live.origin,live.destination]:undefined}/></div><div className="cap">RUH-CENTRED · 2,200 KM</div>
    <div className="act"><button className="g" onClick={run} disabled={st!=='WATCHING'}>{t('disc.run')}</button>{say&&<span>{say}</span>}</div>
    <div className="fd">{sg.filter(s=>s.priority!=='SILENT'||true).map(s=><div className="sg" key={s.id}><span><b style={{fontWeight:500}}>{s.title}</b>{s.stage&&<span className="badge u">{s.stage}</span>}<Badge s={s.dataStatus}/>{s.grade&&<span className="badge u">GRADE {s.grade}</span>}</span><span className={`pr${s.priority==='APPROVAL_REQUIRED'?' a':''}`}>{PR[s.priority]}</span><small>{s.area} · {s.source} · {hm(s.minutesAgo)}</small></div>)}</div></section>
   <section className="sec"><div className="mono">OPPORTUNITIES</div><h2>{t('opp.title')}</h2>{op.map(o=><Story key={o.id} o={o} staff={staff} onChange={load}/>)}</section>
   <OperatorRoom airports={ap}/>
   {staff&&<PolicyView/>}
   {staff&&<section className="sec"><div className="mono">ON THE TABLE</div><h2>{t('table.title')}</h2>{table.length?table.map(o=><div className="row" key={o.id}><span>{L(`${o.origin} → ${o.destination}`)}</span><span className="pr a">APPROVAL REQUIRED</span></div>):<div className="empty">{t('table.empty')}</div>}</section>}</>}
  </main></>}
  <footer>{t('footer')}</footer></>;
}
