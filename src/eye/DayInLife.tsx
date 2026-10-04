import {useEffect,useState} from 'react';
import HoldRing from '../Hold';
import type {AgentState} from '../data/types';
import {useI18n} from '../i18n';
import {useCopy} from './copy';
import {DAY,DAYTXT,type Tone} from './day';
import {EyeMark,StoryCard} from './parts';
const AS:Record<Tone,AgentState>={opp:'DISCOVERING',watch:'MONITORING',risk:'DECIDING',calm:'WATCHING'};
export default function DayInLife({onState}:{onState:(s:AgentState)=>void}){
 const cp=useCopy();const {lang}=useI18n();const txt=DAYTXT[lang];
 const [shown,setShown]=useState(DAY.length),[sel,setSel]=useState(0),[play,setPlay]=useState(false),[done,setDone]=useState<number[]>([]);
 useEffect(()=>{if(!play)return;onState(AS[DAY[sel].tone]);
  if(shown>=DAY.length){setPlay(false);onState('WATCHING');return}
  const t=setTimeout(()=>{setShown(shown+1);setSel(shown)},2400);return()=>clearTimeout(t)},[play,shown]);
 useEffect(()=>()=>onState('WATCHING'),[]);
 const start=()=>{setDone([]);setShown(1);setSel(0);setPlay(true)};
 const ev=DAY[sel],tx=txt[sel],ok=done.includes(sel);
 return <section className="sec" aria-labelledby="day-h">
  <div className="mono">A DAY IN THE EYE<span className="badge b">SIM</span></div><h2 id="day-h">{cp('day.title')}</h2>
  <p className="lead" style={{margin:'0 0 6px'}}>{cp('day.lead')}</p>
  <p className="ke-note">{cp('day.sim')}</p>
  <div className="act"><button className="g" onClick={start} disabled={play}>{shown<DAY.length||play?cp('day.run'):cp('day.rerun')}</button></div>
  <div className="day">
   <ol className="tl" aria-label={cp('day.pick')}>
    {DAY.map((d,i)=><li key={d.time} className={i>=shown?'later':''}>
     <button type="button" className={`tl-row t-${d.tone}${i===sel?' on':''}`} aria-current={i===sel} disabled={i>=shown} onClick={()=>{setPlay(false);setSel(i)}}>
      <span className="tm">{d.time}</span><span className="dot"/><span className="tt">{txt[i].title}</span></button></li>)}
   </ol>
   <div className="stage"><EyeMark tone={ev.tone} label/>
    <StoryCard key={sel} tone={ev.tone} sim title={`${ev.time} · ${tx.title}`} noticed={tx.noticed} why={tx.why} checked={tx.checked} rec={tx.rec}
     action={ev.approve?(ok?<div className="nt e" role="status">{cp('st.draft')}</div>:<div className="act"><HoldRing onDone={()=>setDone(d=>[...d,sel])}/><span className="ke-note">{cp('st.approve')}</span></div>):undefined}/>
   </div>
  </div></section>;
}
