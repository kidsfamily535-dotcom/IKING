import {useCallback,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {sb} from '../lib/supabase';
import './customer.css';
import {useCx} from './cxi18n';
import {LANGS,type Lang} from '../i18n';
import {AIRPORT_L as AL} from '../i18n/airports';
type Ap={iata_code:string;name_ar:string|null;name_en:string|null};
type Trip={id:string;from:string;to:string;at:string|null;who:string|null;ours:boolean};
type Wx={airport_code:string;airport_name_ar:string;leg_ar:string;obs_status:string;age_minutes:number|null;condition_ar:string|null;wind_dir:string|null;wind_speed_kt:number|null;visibility:string|null;temp_c:number|null};
type Pulse='calm'|'watch'|'act';
const COL:Record<Pulse,string>={calm:'#7fc8a0',watch:'#e6c36a',act:'#e0907f'};
const LN:Record<Lang,string>={ar:'العربية',en:'English',tr:'Türkçe',ru:'Русский'};
const DEMO=location.hash==='#my-demo';
const H=3600e3,dAt=(h:number)=>new Date(Date.now()+h*H).toISOString();
const D_AP:Ap[]=[['RUH','الرياض','Riyadh'],['JED','جدة','Jeddah'],['CAI','القاهرة','Cairo'],['DXB','دبي','Dubai'],['DMM','الدمام','Dammam'],['AMM','عمّان','Amman']].map(a=>({iata_code:a[0],name_ar:a[1],name_en:a[2]}));
let D_TR:Trip[]=[{id:'d1',from:'RUH',to:'JED',at:dAt(20),who:'Demo Operator',ours:false},{id:'d2',from:'CAI',to:'DXB',at:dAt(70),who:null,ours:false},{id:'d3',from:'DMM',to:'DXB',at:dAt(120),who:null,ours:false},{id:'d4',from:'AMM',to:'RUH',at:dAt(-200),who:null,ours:false}];
const wk=(c:string,ok:boolean,wind=8):Wx=>ok?{airport_code:c,airport_name_ar:c,leg_ar:'',obs_status:'CURRENT',age_minutes:18,condition_ar:'رؤية جيدة',wind_dir:'280',wind_speed_kt:wind,visibility:'9999',temp_c:31}:{airport_code:c,airport_name_ar:c,leg_ar:'',obs_status:'UNKNOWN',age_minutes:null,condition_ar:null,wind_dir:null,wind_speed_kt:null,visibility:null,temp_c:null};
const wxFor=async(a:string,b:string):Promise<Wx[]>=>{if(DEMO)return [wk(a,a!=='CAI',a==='DMM'?28:8),wk(b,b!=='CAI')];
 const r=await sb.rpc('get_route_weather',{p_origin:a,p_destination:b});return r.error?[]:(r.data??[]) as Wx[]};
const L=(s:string)=><span dir="ltr">{s}</span>;
// الحالة تُحسب من رصد الطقس الرسمي فقط. لا نقول "كل شيء جاهز" لأننا لا نعرف حال الطائرة أو السائق عند مشغّل آخر.
const pulseOf=(w:Wx[]):Pulse=>{if(!w.length||w.some(x=>x.obs_status!=='CURRENT'))return 'watch';
 return w.some(x=>/منخفضة/.test(x.condition_ar??'')||(x.wind_speed_kt??0)>=25)?'act':'calm'};
const apName=(a:Ap|undefined,code:string,lang:Lang)=>!a?code:lang==='ar'?(a.name_ar??a.name_en??code):lang==='en'?(a.name_en??code):(AL[code]?.[lang]??a.name_en??code);

function Lang_(){const {lang,setLang}=useCx();
 return <div className="lg" role="group">{LANGS.map(l=><button key={l} lang={l} aria-pressed={lang===l} onClick={()=>setLang(l)}>{LN[l]}</button>)}</div>}

function SignIn(){const {t}=useCx();
 const [em,setEm]=useState(''),[code,setCode]=useState(''),[step,setStep]=useState<'e'|'c'>('e'),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const send=async()=>{setBusy(true);setMsg('');
  const {error}=await sb.auth.signInWithOtp({email:em.trim(),options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname+'#my'}});
  setBusy(false);if(error){setMsg(t('errSend'));return}setStep('c')};
 const verify=async()=>{setBusy(true);setMsg('');
  const {error}=await sb.auth.verifyOtp({email:em.trim(),token:code.trim(),type:'email'});
  setBusy(false);if(error)setMsg(t('errCode'))};
 return <div className="box"><p className="mono">THE KING’S EYE</p><h1 style={{margin:'10px 0 8px'}}>{t('welcome')}</h1><p className="dim">{t('lead')}</p>
  {step==='e'?<><label>{t('email')}<input className="ltr" type="email" autoComplete="email" inputMode="email" value={em} onChange={e=>setEm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&em&&send()}/></label>
   <button className="cta f" disabled={busy||!/.+@.+\..+/.test(em)} onClick={send}>{t('send')}</button></>
  :<><p style={{marginTop:18}}>{t('sentTo',{e:'\u2066'+em+'\u2069'})}</p>
   <label>{t('code')}<input className="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>e.key==='Enter'&&code&&verify()}/></label>
   <button className="cta f" disabled={busy||code.length<6} onClick={verify}>{t('enter')}</button>
   <div><button className="g" onClick={()=>{setStep('e');setCode('');setMsg('')}}>{t('change')}</button></div></>}
  {msg&&<p className="err" role="alert">{msg}</p>}<p className="dim" style={{marginTop:36}}>{t('privacy')}</p></div>}

function Hero({trip,p,label}:{trip:Trip;p:Pulse;label:string}){const {t,loc}=useCx();
 const key={calm:['p_calm','calm1','calm2'],watch:['p_watch','watch1','watch2'],act:['p_act','act1','act2']}[p];
 const when=trip.at?new Date(trip.at).toLocaleString(loc,{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):t('dateNone');
 return <section className="scene" aria-label={label}><p className="mono">{label==='next'?'YOUR NEXT JOURNEY':'YOUR JOURNEY'}</p>
  <div className="city"><span>{trip.from}</span><i>→</i><span>{trip.to}</span></div><p style={{marginTop:8}}>{when}</p>
  <div className="eye"><span className="dot" style={{['--pc' as any]:COL[p]}}/><div><p className="pulse" style={{['--pc' as any]:COL[p]}}>{t(key[0])}</p><p className="say">{t(key[1])}</p><p className="dim">{t(key[2])}</p></div></div></section>}

function Detail({trip,ap,onBack,onDel}:{trip:Trip;ap:Record<string,Ap>;onBack:()=>void;onDel:()=>void}){const {t,lang,dir}=useCx();
 const [w,setW]=useState<Wx[]|null>(null),[err,setErr]=useState(false);
 useEffect(()=>{wxFor(trip.from,trip.to).then(setW).catch(()=>setErr(true))},[trip.from,trip.to]);
 const p=w?pulseOf(w):'watch';
 return <><button className="g" onClick={onBack}>{dir==='rtl'?'→':'←'} {t('trips')}</button><div style={{marginTop:6}}><Hero trip={trip} p={p} label="trip"/></div>
  <section className="sec"><h2>{t('wx')}</h2><p className="dim">{t('wxL')}</p>
   {err&&<p className="err">{t('wxErr')}</p>}{!w&&!err&&<p className="dim">{t('wait')}</p>}
   {w?.map((x,i)=><div key={x.airport_code} style={{marginTop:14}}><p>{t(i===0?'dep':'arr')}: {apName(ap[x.airport_code],x.airport_code,lang)} {L(x.airport_code)}</p>
    {x.obs_status==='CURRENT'?<><div className="row"><span>{t('vis')}</span><span>{t('c_'+(x.condition_ar??'غير محدد'))}{x.visibility?<> · {L(x.visibility)}</>:null}</span></div>
     <div className="row"><span>{t('wind')}</span><span>{x.wind_speed_kt!=null?L(`${x.wind_dir??''}° ${x.wind_speed_kt} kt`):t('unk')}</span></div>
     <div className="row"><span>{t('temp')}</span><span>{x.temp_c!=null?L(`${x.temp_c}°C`):t('unk')}</span></div>
     <div className="row"><span>{t('obs')}</span><span>{t('ago',{n:x.age_minutes??0})}</span></div></>
    :<p className="dim">{t('noObs')}</p>}</div>)}
   {w&&w.length>0&&<p className="dim" style={{marginTop:14}}>{t('official')}</p>}</section>
  <section className="sec"><h2>{t('eyeNow')}</h2><div className="row"><span>{t('watching',{a:trip.from,b:trip.to})}</span></div>
   {trip.who&&<div className="row"><span>{t('op')}</span><span>{trip.who} <small>{t('typed')}</small></span></div>}
   <p className="dim" style={{marginTop:10}}>{t(trip.ours?'oursL':'mine')}</p>
   {!trip.ours&&<button className="g" onClick={onDel}>{t('del')}</button>}</section></>}

function Add({ap,onDone}:{ap:Ap[];onDone:()=>void}){const {t,lang}=useCx();
 const [f,setF]=useState(''),[to,setTo]=useState(''),[at,setAt]=useState(''),[who,setWho]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const save=async()=>{setBusy(true);setErr('');
  if(DEMO){D_TR=[...D_TR,{id:'d'+Date.now(),from:f,to:to,at:at?new Date(at).toISOString():null,who:who.trim()||null,ours:false}];setBusy(false);onDone();return}
  const {error}=await sb.from('customer_trips').insert({origin_code:f,destination_code:to,departure_at:at?new Date(at).toISOString():null,operator_name:who.trim()||null});
  setBusy(false);if(error)setErr(t('errSave'));else onDone()};
 const opts=<><option value="">{t('pick')}</option>{ap.map(a=><option key={a.iata_code} value={a.iata_code}>{apName(a,a.iata_code,lang)} · {a.iata_code}</option>)}</>;
 return <><h1 style={{marginTop:14}}>{t('add')}</h1><p className="dim">{t('addL')}</p>
  <label>{t('from')}<select value={f} onChange={e=>setF(e.target.value)}>{opts}</select></label>
  <label>{t('to')}<select value={to} onChange={e=>setTo(e.target.value)}>{opts}</select></label>
  <label>{t('when')}<input className="ltr" type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/></label>
  <label>{t('who')}<input value={who} maxLength={80} onChange={e=>setWho(e.target.value)}/></label>
  <button className="cta f" disabled={busy||!f||!to||f===to} onClick={save}>{t('save')}</button>{err&&<p className="err" role="alert">{err}</p>}</>}

export default function CustomerApp(){const {t,dir,loc}=useCx();
 const [ses,setSes]=useState<Session|null|undefined>(undefined),[tab,setTab]=useState<'home'|'trips'|'add'|'mem'>('home'),[name,setName]=useState('');
 const [ap,setAp]=useState<Ap[]>([]),[trips,setTrips]=useState<Trip[]>([]),[open,setOpen]=useState<Trip|null>(null),[hw,setHw]=useState<Wx[]|null>(null);
 useEffect(()=>{if(DEMO){setSes({} as Session);return}sb.auth.getSession().then(r=>setSes(r.data.session));const {data}=sb.auth.onAuthStateChange((_e,s)=>setSes(s));return()=>data.subscription.unsubscribe()},[]);
 const load=useCallback(async()=>{
  if(DEMO){setAp(D_AP);setTrips([...D_TR].sort((x,y)=>Date.parse(x.at!)-Date.parse(y.at!)));return}
  const [a,mine,ours,pr]=await Promise.all([sb.from('airports').select('iata_code,name_ar,name_en').order('iata_code'),
   sb.from('customer_trips').select('id,origin_code,destination_code,departure_at,operator_name').order('departure_at',{ascending:true,nullsFirst:false}),
   sb.rpc('get_my_journey_briefs'),sb.from('profiles').select('full_name').maybeSingle()]);
  setAp((a.data??[]) as Ap[]);setName(pr.data?.full_name??'');
  const T:Trip[]=[...(mine.data??[]).map((r:any)=>({id:r.id,from:r.origin_code,to:r.destination_code,at:r.departure_at,who:r.operator_name,ours:false})),
   ...((ours.data??[]) as any[]).map(r=>({id:r.brief_id,from:r.origin_code,to:r.destination_code,at:r.departure_from,who:null,ours:true}))];
  T.sort((x,y)=>(x.at?Date.parse(x.at):9e15)-(y.at?Date.parse(y.at):9e15));setTrips(T)},[]);
 useEffect(()=>{if(ses)load()},[ses,load]);
 const upcoming=trips.filter(x=>!x.at||Date.parse(x.at)>Date.now()-6*3600e3),next=upcoming[0],past=trips.filter(x=>!upcoming.includes(x));
 useEffect(()=>{setHw(null);if(next)wxFor(next.from,next.to).then(setHw)},[next?.id]);
 const apm=Object.fromEntries(ap.map(a=>[a.iata_code,a]));
 const del=async(x:Trip)=>{if(DEMO){D_TR=D_TR.filter(y=>y.id!==x.id);setOpen(null);load();return}await sb.from('customer_trips').delete().eq('id',x.id);setOpen(null);load()};
 const go=(x:typeof tab)=>{setTab(x);setOpen(null);scrollTo({top:0})};
 const when=(x:Trip)=>x.at?new Date(x.at).toLocaleString(loc,{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):t('dateNone');
 const item=(x:Trip)=><button key={x.id} className="trip" onClick={()=>setOpen(x)}><b>{x.from} → {x.to}</b><br/><small>{when(x)}{x.ours?` · ${t('ours')}`:''}</small></button>;
 if(ses===undefined)return <div className="cx" style={{direction:dir}}/>;
 if(!ses)return <div className="cx" style={{direction:dir}}><div className="app"><div className="nav"><span className="mark">THE KING’S EYE</span><Lang_/></div><SignIn/></div></div>;
 const T=[['home','home'],['trips','trips'],['mem','mem']] as const;
 return <div className="cx" style={{direction:dir}}><div className="app"><div className="nav"><span className="mark">THE KING’S EYE</span><Lang_/>
  <nav aria-label={t('navAria')}>{T.map(x=><button key={x[0]} aria-current={tab===x[0]&&!open?'page':undefined} onClick={()=>go(x[0])}>{t(x[1])}</button>)}</nav>
  {DEMO?<span className="mono">DEMO · SIMULATION</span>:<button className="g" onClick={()=>sb.auth.signOut()}>{t('out')}</button>}</div>
  <main>{open?<Detail trip={open} ap={apm} onBack={()=>setOpen(null)} onDel={()=>del(open)}/>
  :tab==='add'?<Add ap={ap} onDone={()=>{load();go('trips')}}/>
  :tab==='trips'?<><h1 style={{marginTop:14}}>{t('trips')}</h1><p className="dim">{t('tripsLead')}</p>
    <div className="sec" style={{marginTop:24}}>{upcoming.map(item)}{!trips.length&&<p className="dim">{t('noTrips')}</p>}
     {past.length>0&&<><h2 style={{marginTop:36}}>{t('past')}</h2>{past.map(item)}</>}</div>
    <button className="cta f" onClick={()=>go('add')}>{t('add')}</button></>
  :tab==='mem'?<><h1 style={{marginTop:14}}>{t('mem')}</h1><p className="dim">{t('memLead')}</p><p style={{marginTop:28}}>{t('memNone')}</p><p className="dim">{t('memNote')}</p></>
  :<><p className="dim" style={{margin:'10px 0 18px'}}>{name?t('helloN',{n:name}):t('hello')}</p>
   {next?<button style={{display:'block',width:'100%'}} onClick={()=>setOpen(next)}><Hero trip={next} p={hw?pulseOf(hw):'watch'} label="next"/></button>
   :<section className="scene"><p className="mono">YOUR NEXT JOURNEY</p><p className="say">{t('noNext')}</p><p className="dim">{t('noNextL')}</p></section>}
   <button className="cta f" onClick={()=>go('add')}>{t('add')}</button></>}</main>
  <p className="foot">{DEMO&&<>{t('demo')} </>}{t('foot')}</p></div></div>}
