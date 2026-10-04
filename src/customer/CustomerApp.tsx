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
const GR=['#0d1a2e,#2a3550','#0d1a2e,#3a3524','#0d1a2e,#26394f','#0d1a2e,#1f3a40'];
const L=(s:string)=><span dir="ltr">{s}</span>;
// الحالة تُحسب من رصد الطقس الرسمي فقط. لا نقول "كل شيء جاهز" لأننا لا نعرف حال الطائرة أو السائق عند مشغّل آخر.
const pulseOf=(w:Wx[]):Pulse=>{if(!w.length||w.some(x=>x.obs_status!=='CURRENT'))return 'watch';
 return w.some(x=>/منخفضة/.test(x.condition_ar??'')||(x.wind_speed_kt??0)>=25)?'act':'calm'};
const apName=(a:Ap|undefined,code:string,lang:Lang)=>!a?code:lang==='ar'?(a.name_ar??a.name_en??code):lang==='en'?(a.name_en??code):(AL[code]?.[lang]??a.name_en??code);

function LangSel(){const {t,lang,setLang}=useCx();
 return <select className="xsel" aria-label={t('lang')} value={lang} onChange={e=>setLang(e.target.value as Lang)}>{LANGS.map(l=><option key={l} value={l}>{LN[l]}</option>)}</select>}

function SignIn(){const {t}=useCx();
 const [em,setEm]=useState(''),[code,setCode]=useState(''),[step,setStep]=useState<'e'|'c'>('e'),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const send=async()=>{setBusy(true);setMsg('');
  const {error}=await sb.auth.signInWithOtp({email:em.trim(),options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname+'#my'}});
  setBusy(false);if(error){setMsg(t('errSend'));return}setStep('c')};
 const verify=async()=>{setBusy(true);setMsg('');
  const {error}=await sb.auth.verifyOtp({email:em.trim(),token:code.trim(),type:'email'});
  setBusy(false);if(error)setMsg(t('errCode'))};
 return <div style={{marginTop:14,maxWidth:420}}><h1>{t('welcome')}</h1><p className="xlead" style={{marginTop:8}}>{t('lead')}</p>
  {step==='e'?<><label className="xfield">{t('email')}<input className="xin xltr" type="email" autoComplete="email" inputMode="email" value={em} onChange={e=>setEm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&em&&send()}/></label>
   <button className="xcta xf" disabled={busy||!/.+@.+\..+/.test(em)} onClick={send}>{t('send')}</button></>
  :<><p style={{marginTop:18}}>{t('sentTo',{e:'\u2066'+em+'\u2069'})}</p>
   <label className="xfield">{t('code')}<input className="xin xltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>e.key==='Enter'&&code&&verify()}/></label>
   <button className="xcta xf" disabled={busy||code.length<6} onClick={verify}>{t('enter')}</button>
   <div><button className="xsub" style={{marginTop:14,textDecoration:'underline'}} onClick={()=>{setStep('e');setCode('');setMsg('')}}>{t('change')}</button></div></>}
  {msg&&<p className="xerr" role="alert">{msg}</p>}<p className="xsub" style={{marginTop:36}}>{t('privacy')}</p></div>}

function ring(p:Pulse,pct:number){const c=2*Math.PI*34;return <div className="xring" style={{['--pc' as any]:COL[p]}}><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="#f4ecdc2e" strokeWidth="2"/><circle cx="40" cy="40" r="34" fill="none" stroke={COL[p]} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct/100)}/></svg><div className="xc"><i/></div></div>}

function Hero({trip,p,pct,next}:{trip:Trip;p:Pulse;pct:number;next:boolean}){const {t,loc}=useCx();
 const k={calm:['p_calm','calm1','calm2'],watch:['p_watch','watch1','watch2'],act:['p_act','act1','act2']}[p];
 const when=trip.at?new Date(trip.at).toLocaleString(loc,{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):t('dateNone');
 return <section className="xscene"><svg className="xsky" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#f4ecdc" strokeOpacity=".1"><circle cx="400" cy="400" r="140"/><circle cx="400" cy="400" r="260"/><circle cx="400" cy="400" r="380"/></g><path d="M-20,340 Q260,120 560,200 T840,90" fill="none" stroke="#f4ecdc" strokeOpacity=".5" strokeDasharray="2 9"/><g fill="#f4ecdc"><circle cx="90" cy="60" r="1.2"/><circle cx="210" cy="110" r="1"/><circle cx="330" cy="40" r="1.4"/><circle cx="470" cy="80" r="1"/></g></svg>
  <p className="xmono">{next?'YOUR NEXT JOURNEY':'YOUR JOURNEY'}</p><div className="xcity"><span>{trip.from}</span><i>→</i><span>{trip.to}</span></div><p className="xwhen">{when}</p>
  <div className="xeye">{ring(p,pct)}<div><p className="xpulse" style={{['--pc' as any]:COL[p]}}>{t(k[0])}</p><p className="xsay">{t(k[1])}</p><p className="xsub">{t(k[2])}</p></div></div></section>}

function Trip_({trip,ap,wx,onDel}:{trip:Trip;ap:Record<string,Ap>;wx:Wx[]|null;onDel:()=>void}){const {t,lang,loc}=useCx();
 const [sel,setSel]=useState(0);useEffect(()=>setSel(0),[trip.id]);
 const p=wx?pulseOf(wx):'watch',cur=wx?.filter(x=>x.obs_status==='CURRENT').length??0,pct=wx&&wx.length?Math.round(cur/wx.length*100):0;
 const dep=trip.at?Date.parse(trip.at):null,now=Date.now(),idx=dep==null||now<dep?0:now<dep+12*3600e3?1:2;
 const tm=trip.at?new Date(trip.at).toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'}):t('unk');
 const stops=[[t('stopDep'),`${apName(ap[trip.from],trip.from,lang)} · ${tm}`],[t('stopArr'),`${apName(ap[trip.to],trip.to,lang)} · ${t('unk')}`]];
 const x=wx?.[sel];
 return <><div style={{marginTop:10}}><Hero trip={trip} p={p} pct={pct} next={false}/></div>
  <section className="xsec"><h2>{t('path')}</h2><p className="xsub">{t('pathL')}</p><ol className="xstops xpath">{stops.map((s,i)=><li key={i} className={i<idx?'xd':i===idx?'xn':''}>{s[0]}<small>{s[1]}</small></li>)}</ol></section>
  <section className="xsec xdoing"><h2>{t('eyeNow')}</h2><ul><li>{t('watching',{a:trip.from,b:trip.to})}</li>{trip.who&&<li>{t('op')}: {trip.who} <small>{t('typed')}</small></li>}</ul>
   <p className="xsub" style={{marginTop:12}}>{wx?t('cov',{n:cur,m:wx.length}):t('wait')} {t(trip.ours?'oursL':'mine')}</p></section>
  <section className="xsec"><h2>{t('explore')}</h2><p className="xsub">{t('wxL')}</p>
   <div className="xchips">{(wx??[]).map((w,i)=><button key={w.airport_code} className="xchip" aria-pressed={sel===i} onClick={()=>setSel(i)}>{t(i===0?'dep':'arr')} · {w.airport_code}</button>)}</div>
   {x&&(x.obs_status==='CURRENT'?<dl className="xfact"><dt>{t('vis')}</dt><dd>{t('c_'+(x.condition_ar??'غير محدد'))}{x.visibility?<> · {L(x.visibility)}</>:null}</dd>
    <dt>{t('wind')}</dt><dd>{x.wind_speed_kt!=null?L(`${x.wind_dir??''}° ${x.wind_speed_kt} kt`):t('unk')}</dd><dt>{t('temp')}</dt><dd>{x.temp_c!=null?L(`${x.temp_c}°C`):t('unk')}</dd><dt>{t('obs')}</dt><dd>{t('ago',{n:x.age_minutes??0})}</dd></dl>
    :<p className="xbig">{t('noObs')}</p>)}
   {x&&x.obs_status==='CURRENT'&&<p className="xsub" style={{marginTop:12}}>{t('official')}</p>}
   {!trip.ours&&<button className="xchip" style={{marginTop:22}} onClick={onDel}>{t('del')}</button>}</section></>}

function Add({ap,onDone}:{ap:Ap[];onDone:()=>void}){const {t,lang}=useCx();
 const [f,setF]=useState(''),[to,setTo]=useState(''),[at,setAt]=useState(''),[who,setWho]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const save=async()=>{setBusy(true);setErr('');
  if(DEMO){D_TR=[...D_TR,{id:'d'+Date.now(),from:f,to:to,at:at?new Date(at).toISOString():null,who:who.trim()||null,ours:false}];setBusy(false);onDone();return}
  const {error}=await sb.from('customer_trips').insert({origin_code:f,destination_code:to,departure_at:at?new Date(at).toISOString():null,operator_name:who.trim()||null});
  setBusy(false);if(error)setErr(t('errSave'));else onDone()};
 const opts=<><option value="">{t('pick')}</option>{ap.map(a=><option key={a.iata_code} value={a.iata_code}>{apName(a,a.iata_code,lang)} · {a.iata_code}</option>)}</>;
 return <><h1 style={{marginTop:14}}>{t('add')}</h1><div className="xchat"><div className="xb xe">{t('addL')}</div></div>
  <label className="xfield">{t('from')}<select className="xin" value={f} onChange={e=>setF(e.target.value)}>{opts}</select></label>
  <label className="xfield">{t('to')}<select className="xin" value={to} onChange={e=>setTo(e.target.value)}>{opts}</select></label>
  <label className="xfield">{t('when')}<input className="xin xltr" type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/></label>
  <label className="xfield">{t('who')}<input className="xin" value={who} maxLength={80} onChange={e=>setWho(e.target.value)}/></label>
  <button className="xcta xf" disabled={busy||!f||!to||f===to} onClick={save}>{t('save')}</button>{err&&<p className="xerr" role="alert">{err}</p>}</>}

export default function CustomerApp(){const {t,dir,loc}=useCx();
 const [ses,setSes]=useState<Session|null|undefined>(undefined),[tab,setTab]=useState<'home'|'trips'|'add'|'mem'>('home'),[name,setName]=useState('');
 const [ap,setAp]=useState<Ap[]>([]),[trips,setTrips]=useState<Trip[]>([]),[open,setOpen]=useState<Trip|null>(null),[wx,setWx]=useState<Wx[]|null>(null);
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
 const upcoming=trips.filter(x=>!x.at||Date.parse(x.at)>Date.now()-6*3600e3),cur=open??upcoming[0];
 useEffect(()=>{setWx(null);if(cur)wxFor(cur.from,cur.to).then(setWx)},[cur?.id]);
 const apm=Object.fromEntries(ap.map(a=>[a.iata_code,a]));
 const del=async(x:Trip)=>{if(DEMO){D_TR=D_TR.filter(y=>y.id!==x.id)}else await sb.from('customer_trips').delete().eq('id',x.id);setOpen(null);load()};
 const go=(x:typeof tab)=>{setTab(x);if(x!=='trips')setOpen(null);scrollTo({top:0})};
 const pick=(x:Trip)=>{setOpen(x);setTab('trips');scrollTo({top:0})};
 const cards=(list:Trip[])=><div className="xmem">{list.map((x,i)=><button key={x.id} className="xm" style={{background:`linear-gradient(170deg,${GR[i%4]})`}} onClick={()=>pick(x)}><b>{x.to}</b><span>{x.from} → {x.to} · {x.at?new Date(x.at).toLocaleDateString(loc,{day:'numeric',month:'short'}):t('dateNone')}</span></button>)}</div>;
 const others=trips.filter(x=>x.id!==cur?.id);
 const top=<div className="xnav"><span className="xmark">THE KING’S EYE</span>{DEMO&&<span className="xsim">DEMO · SIMULATION</span>}<LangSel/>{ses&&<nav id="nav" aria-label={t('navAria')}>{(['home','trips','mem'] as const).map(k=><button key={k} aria-current={tab===k?'page':undefined} onClick={()=>go(k)}>{t(k)}</button>)}</nav>}</div>;
 const foot=<p className="xfoot">{DEMO&&<>{t('demo')} </>}{t('foot')}{ses&&!DEMO&&<> <button style={{textDecoration:'underline'}} onClick={()=>sb.auth.signOut()}>{t('out')}</button></>}</p>;
 if(ses===undefined)return <div className="cx" dir={dir}/>;
 return <div className="cx" dir={dir}><div className="xapp">{top}<main>{!ses?<SignIn/>
  :tab==='add'?<Add ap={ap} onDone={()=>{load();go('trips')}}/>
  :tab==='mem'?<><h1 style={{marginTop:14}}>{t('mem')}</h1><p className="xlead">{t('memLead')}</p><div className="xsec"><p className="xline">{t('memNone')}<small>{t('memNote')}</small></p></div></>
  :tab==='trips'?(cur?<><Trip_ trip={cur} ap={apm} wx={wx} onDel={()=>del(cur)}/>{others.length>0&&<section className="xsec"><h2>{t('yourTrips')}</h2><p className="xsub">{t('yourTripsL')}</p>{cards(others)}</section>}<button className="xcta xf" onClick={()=>go('add')}>{t('add')}</button></>
   :<><h1 style={{marginTop:14}}>{t('trips')}</h1><p className="xlead">{t('noTrips')}</p><button className="xcta xf" onClick={()=>go('add')}>{t('add')}</button></>)
  :<><p className="xsub" style={{margin:'10px 0 18px'}}>{name?t('helloN',{n:name}):t('hello')}</p>
   {cur?<button style={{display:'block',width:'100%'}} onClick={()=>pick(cur)}><Hero trip={cur} p={wx?pulseOf(wx):'watch'} pct={wx&&wx.length?Math.round(wx.filter(x=>x.obs_status==='CURRENT').length/wx.length*100):0} next/></button>
   :<section className="xscene"><p className="xmono">YOUR NEXT JOURNEY</p><p className="xsay">{t('noNext')}</p><p className="xsub">{t('noNextL')}</p></section>}
   {others.length>0&&<section className="xsec"><h2>{t('yourTrips')}</h2><p className="xsub">{t('yourTripsL')}</p>{cards(others)}</section>}
   <button className="xcta xf" onClick={()=>go('add')}>{t('add')}</button></>}</main>{foot}</div></div>}
