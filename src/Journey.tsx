import {useEffect,useRef,useState} from 'react';
import {api} from './data/api';
import type {Airport,MemoryItem,ParsedRequest} from './data/types';
import {useI18n,airportName,catL} from './i18n';
import {useCopy} from './eye/copy';
import MyTrips from './MyTrips';
import {sb} from './lib/supabase';
const EX=['j.ex1','j.ex2'];
const LT=(s:string|number)=><span dir="ltr">{s}</span>;
const bz=(t:number,a:number,b:number)=>(1-t)*(1-t)*a+2*(1-t)*t*((a+b)/2)+t*t*b;
// شاشة العميل. الترتيب: حالة العين (المشهد فوقها) ثم الطلب ثم رحلاتي (الرحلة والطقس) ثم الذاكرة.
// أدوات المحاكاة (تشغيل ×1 ×3 ×10 والتأخير المحاكى) تظهر فقط في وضع العرض (demo)، لا للعميل.
export default function JourneyRoom({airports,demo=false,real=false,ask,guest=false}:{airports:Airport[];demo?:boolean;real?:boolean;ask?:string;guest?:boolean}){
 const {t,lang,dir}=useI18n();const cp=useCopy();const dur=(m:number)=>`${Math.floor(m/60)}${t('unit.h')} ${m%60}${t('unit.m')}`;
 const [txt,setTxt]=useState(''),[p,setP]=useState<ParsedRequest|null>(null),[th,setTh]=useState(false);
 const [mem,setMem]=useState<MemoryItem[]>([]),[ed,setEd]=useState<string|null>(null),[val,setVal]=useState('');
 const [prog,setProg]=useState(0),[play,setPlay]=useState(false),[spd,setSpd]=useState(1),[appr,setAppr]=useState(false),[rev,setRev]=useState(false);
 const inp=useRef<HTMLInputElement>(null);
 useEffect(()=>{api.listMemory().then(setMem)},[lang]);
 useEffect(()=>{if(!play)return;const i=setInterval(()=>setProg(x=>{const n=Math.min(1,x+.002*spd);if(n>=1)setPlay(false);return n}),200);return()=>clearInterval(i)},[play,spd]);
 const send=async(t:string)=>{setTxt(t);setP(null);setTh(true);setP(await api.parseRequest(t));setTh(false)};
 useEffect(()=>{if(ask)send(ask)},[]);
 const [want,setWant]=useState<string|null>(null),[em,setEm]=useState(''),[gm,setGm]=useState(''),[gb,setGb]=useState(false),[won,setWon]=useState<string|null>(null);
 const wantIt=async(id:string)=>{if(!p?.origin||!p.destination)return;setGm('');
  if(real){try{await api.addMyTrip(p.origin,p.destination,null);setWon(id)}catch{setGm(t('mt.err'))}}else setWant(id)};
 const sendLink=async()=>{if(!p?.origin||!p.destination)return;setGb(true);setGm('');
  try{localStorage.setItem('iking_want',JSON.stringify({o:p.origin,d:p.destination}))}catch{/* التخزين غير متاح */}
  const r=await sb.auth.signInWithOtp({email:em.trim(),options:{emailRedirectTo:location.origin}});
  setGm(r.error?t('gate.err'):t('gate.sent'));setGb(false)};
 const submit=()=>{if(txt.trim())send(txt);else inp.current?.focus()};
 const nm=(c?:string)=>{const a=airports.find(x=>x.iata===c);return a?airportName(a):c};
 const memV=(m:MemoryItem)=>m.value??t('memv.'+m.key);
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
 const total=95,left=Math.round(total*(1-prog)),dist=Math.round(850*(1-prog)),late=demo&&prog>.4;
 const x=bz(prog,80,520),y=bz(prog,170,110)-Math.sin(prog*Math.PI)*60;
 const tl=[['j.tl.1','06:15'],['j.tl.2','06:30'],['j.tl.3','07:00'],['j.tl.4','07:30'],['j.tl.5','09:05'],['j.tl.6','09:30']];
 return <>
  {!guest&&<nav className="jnav" aria-label={t('j.trips.title')}>
   <button className="g" onClick={()=>jump('tell')}>{t('j.tell.title')}</button>
   <button className="g" onClick={()=>jump('trips')}>{t('j.trips.title')}</button>
   {!real&&<button className="g" onClick={()=>jump('mem')}>{t('j.mem.title')}</button>}
  </nav>}
  <section className="sec" id="tell"><div className="mono">{t('j.cap.tell')}</div><h2>{t('j.tell.title')}</h2>
   <div className="ask"><input ref={inp} aria-label={t('j.req.aria')} placeholder={t('j.req.ph')} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/><button className="send" disabled={th} onClick={submit}>{t('j.send')}</button></div>
   <div className="act">{EX.map(k=><button className="g" key={k} onClick={()=>send(t(k))}>{t(k)}</button>)}</div>
   {th&&<div className="mono">{t('j.thinking')}<span className="badge b">{cp('badge.sim')}</span></div>}
   {p&&<><div className="mono" style={{margin:'14px 0 4px'}}>{t('j.understood')}</div>
    {[['j.from',nm(p.origin)],['j.to',nm(p.destination)],['j.pax',p.passengers],['j.date',p.when?t('when.'+p.when):undefined]].map(([k,v])=><div className="row" key={String(k)}><span>{t(String(k))}</span><span style={{direction:dir}}>{v??t('j.unspecified')}</span></div>)}
    {p.missing.length>0&&<div className="nt">{t('j.missing',{list:p.missing.map(m=>t('miss.'+m)).join(t('sep'))})}</div>}
    {p.options.map(o=><div className="card" key={o.id}><h3>{t('opt.'+o.id)}</h3>
     <div className="row"><span>{t('j.category')}</span><span style={{direction:dir}}>{catL(o.category)}</span></div>
     <div className="row"><span>{t('j.departure')}</span><span>{LT(o.departure)}</span></div>
     <div className="row"><span>{t('j.duration')}</span><span>{dur(o.durationMin)} <span className="badge b">{t('b.estimate')}</span></span></div>
     <div className="row"><span>{t('j.availability')}</span><span>{t('b.waiting')}</span></div>
     <div className="row"><span>{t('j.refPrice')}</span><span>{LT(`$${o.priceLo.toLocaleString()}–${o.priceHi.toLocaleString()}`)} <span className="badge b">{t('b.example')}</span></span></div>
     <small style={{color:'var(--dim)'}}>{t('j.priceNote')}</small>
     {o.usesMemory&&<div className="nt">{t('j.usesMemory')}</div>}
     {p.origin&&p.destination&&won!==o.id&&<div className="act"><button onClick={()=>wantIt(o.id)}>{t('opt.want')}</button></div>}
     {won===o.id&&<div className="nt e" role="status">{t('want.done')}</div>}
     {want===o.id&&!real&&<div className="gate"><div className="mono">{t('gate.title')}</div>
      <div className="ask"><input type="email" aria-label={t('gate.email')} placeholder={t('gate.email')} autoComplete="email" value={em} onChange={e=>setEm(e.target.value)}/><button className="send" disabled={gb||!em.includes('@')} onClick={sendLink}>{t('gate.send')}</button></div></div>}
     {gm&&(want===o.id||won===null)&&<div className="nt" role="status">{gm}</div>}</div>)}</>}
  </section>
  {!guest&&<section className="sec" id="trips"><div className="mono">{t('j.cap.trips')}{!real&&<span className="badge b">{cp('badge.sim')}</span>}</div><h2>{t('j.trips.title')}</h2>
   {real?<MyTrips airports={airports}/>:<>
   <div className="card"><div className="mono">{LT('RUH → JED')}<span className="badge b">{cp('badge.sim')}</span></div>
    <h3>{nm('RUH')} · {nm('JED')}</h3>
    <div className="row"><span>{t('st.label')}</span><span>{t('table.empty')}</span></div>
    <div className="radar"><svg viewBox="0 0 600 260" role="img" aria-label={t('j.trips.title')}><rect width="600" height="260" fill="#131110"/>{[1,2,3].map(i=><line key={i} x1="0" x2="600" y1={i*65} y2={i*65} stroke="#f5f0e8" strokeOpacity=".07"/>)}
     <path d="M80,170 Q300,-10 520,110" fill="none" stroke="#c6a15b" strokeOpacity=".55"/><circle cx="80" cy="170" r="3" fill="#f5f0e8"/><circle cx="520" cy="110" r="3" fill="#f5f0e8"/>
     <text x="70" y="192" fill="#f5f0e899" fontSize="10" fontFamily="JetBrains Mono">RUH</text><text x="490" y="132" fill="#f5f0e899" fontSize="10" fontFamily="JetBrains Mono">JED</text>
     <circle cx={x} cy={y} r="5" fill="#c6a15b"/></svg></div>
    <div className="parts" style={{gridTemplateColumns:'repeat(3,1fr)'}}><div><small>{t('j.progress')}</small><b>{Math.round(prog*100)}%</b></div><div><small>{t('j.remainKm')}</small><b>{dist}</b></div><div><small>{t('j.timeLeft')}</small><b>{left}{t('unit.m')}</b></div></div>
    {demo&&<div className="act"><span className="mono">DEMO TOOLS</span><button className="g" onClick={()=>setPlay(!play)}>{play?t('j.pause'):t('j.play')}</button>{[1,3,10].map(s=><button key={s} className={spd===s?'':'g'} onClick={()=>setSpd(s)}>{LT(`×${s}`)}</button>)}</div>}
    {late&&<div className="nt"><span className="mono">{t('j.noticed')}<span className="badge b">{cp('badge.sim')}</span></span><p>{t('j.late')}</p>
     {!appr&&!rev&&<><p>{t('j.proposal')}</p><div className="act"><span className="mono">{cp('st.approve')}</span><button onClick={()=>setAppr(true)}>{t('j.agree')}</button><button className="g" onClick={()=>setRev(true)}>{t('j.review')}</button></div></>}
     {appr&&<p>{t('j.approvedSim')}</p>}{rev&&<p>{t('j.left')}</p>}</div>}</div>
   <div className="mono" style={{margin:'20px 0 4px'}}>{t('j.cap.wx')}<span className="badge b">{cp('badge.sim')}</span></div>
   {['RUH','JED'].map(c=><div className="row" key={c}><span>{nm(c)}</span><span>{t('j.wx.row')}</span></div>)}
   <small style={{color:'var(--dim)'}}>{t('j.wx.note')}</small>
   <div className="mono" style={{margin:'20px 0 8px'}}>{t('j.cap.d2d')}<span className="badge b">ESTIMATED</span></div>
   <ul className="tl" style={{listStyle:'none',padding:0,borderInlineStart:'1px solid var(--gold)',marginInlineStart:6}}>{tl.map(([a,b])=><li key={a} style={{padding:'2px 18px 10px'}}>{t(a)} · {LT(b)}</li>)}</ul>
   <small style={{color:'var(--dim)'}}>{t('j.tl.note')}</small>
   </>}
   {lang==='ar'&&<div className="act"><button className="g" onClick={()=>{location.href='?view=journeys'}}>{t('j.trips.open')}</button></div>}</section>}
  {!guest&&!real&&<section className="sec" id="mem"><div className="mono">{t('j.cap.mem')}</div><h2>{t('j.mem.title')}</h2>
   {mem.map(m=><div className="row" key={m.key}><span>{t('mem.'+m.key)}</span><span style={{direction:dir}}>{ed===m.key?<><input aria-label={t('mem.'+m.key)} value={val} onChange={e=>setVal(e.target.value)} style={{background:'none',border:0,borderBottom:'1px solid var(--gold)',color:'var(--ink)',font:'inherit',width:130}}/> <button className="g" style={{padding:'2px 12px'}} onClick={async()=>{await api.saveMemory(m.key,val);setMem(await api.listMemory());setEd(null)}}>{t('j.save')}</button></>:<>{memV(m)} <button className="g" style={{padding:'0 10px'}} onClick={()=>{setEd(m.key);setVal(memV(m))}}>{t('j.edit')}</button></>}</span></div>)}
   <small style={{color:'var(--dim)'}}>{t('j.mem.note')}</small></section>}</>;
}
