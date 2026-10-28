import {useEffect,useMemo,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import LangSwitch from '../LangSwitch';
import {useT} from './copy';
import {AirCtx,type Run} from './ctx';
import type {Ap} from './geo';
import {Fld} from './ui';
import Inbox from './Inbox';import Hangar from './Hangar';import Offers from './Offers';import Bays from './Bays';import Pay from './Pay';
import './sky.css';
const IC=[<path key="0" d="M4 6h16v11H8l-4 4zM8 10h8M8 13h5"/>,<path key="1" d="M3 17h18M5 17V9l4 3 3-6 3 6 4-3v8"/>,<path key="2" d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2zM9 9h6M9 13h4"/>,<path key="3" d="M3 14l8-2 6-8c.7-.8 2 .3 1.3 1.2L15 11l5 1.5-.7 1.6L13 13.8 10.5 20l-1.7.2.4-5.6L3 15.7z"/>,<path key="4" d="M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2"/>];
const Ic=({i}:{i:number})=><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[i]}</svg>;
const Brand=({sub}:{sub:string})=><div className="sk-brand"><i aria-hidden="true"/><span><b>EYE KING</b><small>{sub}</small></span></div>;
function Login(){const T=useT();const [e,setE]=useState(''),[m,setM]=useState(''),[b,setB]=useState(false),[sent,setSent]=useState(false);
 const go=async()=>{setB(true);setM('');const r=await sb.auth.signInWithOtp({email:e.trim(),options:{emailRedirectTo:location.href}});setB(false);if(r.error){setM(T.err);return}setSent(true)};
 const valid=e.includes('@')&&e.includes('.');
 return <div className="sk-login"><div className="sk-lside" aria-hidden="true"><div className="sk-rings"><i/><i/><i/><b/></div></div>
  <div className="sk-lform"><Brand sub={T.brandSub}/><div className="sk-lbox"><LangSwitch/><h1>{T.loginH}</h1>
   {sent?<><p className="sk-okp" role="status">{T.sent}</p><button type="button" className="g" onClick={()=>setSent(false)}>{T.another}</button></>
   :<><p>{T.loginP}</p><Fld l={T.email} v={e} on={setE} type="email"/><button type="button" disabled={b||!valid} onClick={go}>{T.send}</button>{m&&<div className="sk-err" role="alert">{m}</div>}</>}
   <small>{T.side}</small></div></div></div>}
export default function Panel(){
 const {dir}=useI18n();const T=useT();
 const [ses,setSes]=useState<string|null|undefined>(undefined),[mail,setMail]=useState(''),[ok,setOk]=useState<boolean|null>(null),[tab,setTab]=useState(0),[err,setErr]=useState(''),[cnt,setCnt]=useState(0),[air,setAir]=useState<Map<string,Ap>>(new Map());
 useEffect(()=>{sb.auth.getSession().then(r=>{setSes(r.data.session?.user.id??null);setMail(r.data.session?.user.email??'')});const {data}=sb.auth.onAuthStateChange((_e,s)=>{setSes(s?.user.id??null);setMail(s?.user.email??'')});return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!ses){setOk(null);return}sb.from('profiles').select('role,status').eq('id',ses).maybeSingle().then(r=>setOk(r.data?.role==='operator'&&r.data?.status==='active'))},[ses]);
 useEffect(()=>{if(!ok)return;sb.from('airports').select('iata_code,name_ar,name_en,lat,lon').limit(1000).then(r=>setAir(new Map(((r.data??[]) as any[]).filter(x=>x.lat!=null&&x.lon!=null).map(x=>[x.iata_code,{code:x.iata_code,ar:x.name_ar,en:x.name_en,lat:Number(x.lat),lon:Number(x.lon)}]))))},[ok]);
 const run:Run=useMemo(()=>async f=>{setErr('');const r=await f();if(r.error){setErr(r.error.message||T.err);return false}return true},[T]);
 const go=(i:number)=>{setTab(i);setErr('')};
 if(ses===undefined||(ses&&ok===null))return <div className="sk" dir={dir}/>;
 if(!ses)return <div className="sk" dir={dir}><Login/></div>;
 if(!ok)return <div className="sk" dir={dir}><div className="sk-solo"><Brand sub={T.brandSub}/><p className="sk-quiet">{T.noop}</p><button type="button" className="g" onClick={()=>sb.auth.signOut()}>{T.out}</button></div></div>;
 return <AirCtx.Provider value={air}><div className="sk sk-app" dir={dir}>
  <header className="sk-top"><Brand sub={T.brandSub}/>
   <nav role="tablist" aria-label={T.title}>{T.tabs.map((x,i)=><button type="button" key={x} role="tab" aria-selected={tab===i} className={tab===i?'on':''} onClick={()=>go(i)}><Ic i={i}/><span>{x}</span>{i===0&&cnt>0&&<em aria-label={String(cnt)}>{cnt}</em>}</button>)}</nav>
   <div className="sk-who"><LangSwitch/><span dir="ltr">{mail}</span><button type="button" className="g" onClick={()=>sb.auth.signOut()}>{T.out}</button></div></header>
  <main><div className="sk-head"><h1>{T.tabs[tab]}</h1><p>{T.sub[tab]}</p></div>
   {err&&<div className="sk-err" role="alert">{err}</div>}
   {tab===0&&<Inbox run={run} onCount={setCnt} goHangar={()=>go(1)}/>}{tab===1&&<Hangar uid={ses} run={run} goFleet={()=>go(3)}/>}{tab===2&&<Offers uid={ses} goPay={()=>go(4)} goInbox={()=>go(0)}/>}{tab===3&&<Bays uid={ses} run={run}/>}{tab===4&&<Pay uid={ses} run={run}/>}
  </main></div></AirCtx.Provider>}
