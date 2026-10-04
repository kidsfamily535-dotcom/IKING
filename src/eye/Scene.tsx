import {useEffect,useMemo,useState} from 'react';
import './scene.css';
import {api} from '../data/api';
import HoldRing from '../Hold';
import type {Airport,AgentState,Opportunity,ParkedAircraft,CalendarEvent} from '../data/types';
import {useI18n} from '../i18n';
import {useCopy} from './copy';
import {DAY,DAYTXT,type Tone} from './day';
// المشهد الواحد: لحظة ذكاء واحدة في كل شاشة. المعنى أولًا، ثم ما فحصته العين، ثم توصية واحدة وموافقة بشرية.
// الأعداد في اللحظات الحية من القاعدة. لحظات «يوم في حياة العين» محاكاة ومعلّمة هكذا.
const SAT=['AIRCRAFT','WEATHER','DEMAND','AIRPORTS','CLIENTS'];
const ANG=[-112,-56,0,56,112];
const META:[[string,string]|null,number[]][]=[[['DXB','RUH'],[0,2,3]],[null,[1,3]],[['DXB','CAI'],[0,2]],[['AUH','RUH'],[0,3]],[['RUH','JED'],[4]],[['RUH','JED'],[0,1,3]],[['RUH','JED'],[3,4]],[['RUH','MED'],[0,3]],[['RUH','JED'],[0]],[null,[]]];
const AS:Record<Tone,AgentState>={opp:'DISCOVERING',watch:'MONITORING',risk:'DECIDING',calm:'WATCHING'};
const LOC:Record<string,string>={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'};
interface M{key:string;tone:Tone;time?:string;title:string;noticed:string;why?:string;checked:string[];rec?:string;arc?:[string,string];focus?:string;sat:number[];sim:boolean;approve?:boolean;lines?:string[];foot?:string;over?:boolean}
function pt(a:Airport,c:Airport){const r=Math.PI/180,dl=(a.lon-c.lon)*r,p1=c.lat*r,p2=a.lat*r;
 const d=6371*Math.acos(Math.min(1,Math.sin(p1)*Math.sin(p2)+Math.cos(p1)*Math.cos(p2)*Math.cos(dl)));
 const th=Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl));
 const k=Math.min(d,2200)/2200*270;return{x:300+k*Math.sin(th),y:300-k*Math.cos(th)}}
function World({airports,arc,focus,k}:{airports:Airport[];arc?:[string,string];focus?:string;k:string}){
 const c=airports.find(a=>a.iata==='RUH');if(!c)return null;
 const P:Record<string,{x:number;y:number}>=Object.fromEntries(airports.map(a=>[a.iata,pt(a,c)]));
 const e=arc&&P[arc[0]]&&P[arc[1]]?[P[arc[0]],P[arc[1]]]:null;
 const d=e?`M${e[0].x},${e[0].y} Q${(e[0].x+e[1].x)/2},${Math.min(e[0].y,e[1].y)-70} ${e[1].x},${e[1].y}`:'';
 const hot=new Set([...(arc??[]),...(focus?[focus]:[])]);
 return <svg className="sc-map" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
  {[67,135,202,270].map(r=><circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#f4ecdc" strokeOpacity=".06"/>)}
  <path className="sc-sweep" d="M300,300 L300,30 A270,270 0 0 1 470,90 Z" fill="#c9a961" fillOpacity=".07"/>
  {airports.map(a=>{const p=P[a.iata],h=hot.has(a.iata);return <g key={a.iata}>
   {h&&<circle className="sc-ping" cx={p.x} cy={p.y} r="7" fill="none" stroke="#c9a961" style={{transformOrigin:`${p.x}px ${p.y}px`}}/>}
   <circle cx={p.x} cy={p.y} r={h?3.6:1.8} fill={h?'#c9a961':'#f4ecdc'} fillOpacity={h?1:.45}/>
   <text x={p.x+7} y={p.y-6} fill="#f4ecdc" fillOpacity={h?.85:.28} fontSize="8.5" fontFamily="JetBrains Mono" letterSpacing="1.5">{a.iata}</text></g>})}
  {e&&<g key={k}><path className="sc-arc" d={d} pathLength={1} fill="none" stroke="#c9a961" strokeWidth="1.4"/>
   <circle r="3.2" fill="#f4ecdc"><animateMotion dur="5s" repeatCount="indefinite" path={d}/></circle></g>}
 </svg>;
}
function useBrief(on:boolean,real:boolean){
 const cp=useCopy();const {lang}=useI18n();
 const [b,setB]=useState<{lines:string[];fail:string[];at:Date}|null>(null);
 useEffect(()=>{if(!on)return;let live=true;setB(null);const fail:string[]=[];
  Promise.all([api.listOpportunities().catch(()=>{fail.push(cp('c.opp'));return [] as Opportunity[]}),
   api.parkedAircraft().catch(()=>{fail.push(cp('l.rev'));return [] as ParkedAircraft[]}),
   api.demandCalendar(14).catch(()=>{fail.push(cp('l.opp'));return [] as CalendarEvent[]})]).then(([o,p,c])=>{if(!live)return;
   const pend=o.filter(x=>x.status==='ACTIVATION_PENDING').length,hot=p.filter(a=>a.related_demand_signals>0||a.open_explicit_requests>0).length,
    reqs=p.reduce((n,a)=>n+a.open_explicit_requests,0),ev=c.filter(x=>x.days_until<=14).length,lines:string[]=[];
   if(pend)lines.push(cp('c.opp.pend',{n:pend}));if(hot)lines.push(cp('c.opp.park',{n:hot}));if(ev)lines.push(cp('c.opp.ev',{n:ev}));if(reqs)lines.push(cp('c.client.n',{n:reqs}));
   setB({lines,fail,at:new Date()})});
  return()=>{live=false}},[on,real,lang]);
 return b}
export default function Scene({mode,real,airports,onState}:{mode:'operator'|'customer';real:boolean;airports:Airport[];onState:(s:AgentState)=>void}){
 const cp=useCopy();const {lang,t}=useI18n();const op=mode==='operator';
 const b=useBrief(op,real);
 const [idx,setIdx]=useState(0),[play,setPlay]=useState(false),[done,setDone]=useState<string[]>([]);
 const ms=useMemo(():M[]=>{
  const tx=DAYTXT[lang],day=(i:number):M=>({key:'d'+i,tone:DAY[i].tone,time:DAY[i].time,...tx[i],arc:META[i][0]??undefined,focus:META[i][0]?undefined:'RUH',sat:META[i][1],sim:true,approve:DAY[i].approve});
  if(!op)return [{key:'c0',tone:'calm',title:t('j.eye.title'),noticed:t('table.empty'),checked:['aircraft','weather','airport','ground','route'].map(k=>t('item.'+k)),why:t('j.items.cap'),arc:['RUH','JED'],sat:[0,1,3],sim:true},...[5,6,7,8,9].map(day)];
  const time=b?.at.toLocaleTimeString(LOC[lang],{hour:'2-digit',minute:'2-digit'})??'';
  const over:M=b?{key:'o',over:true,tone:b.lines.length?'opp':'calm',title:cp('greet'),noticed:b.lines.length?cp('greet.sub'):cp('greet.none'),checked:[],lines:b.lines,sat:[0,1,2,3,4],sim:!real,
   foot:b.fail.length?cp('checked.fail',{x:b.fail.join('، ')}):`${cp('checked')} ${cp('checked.at',{t:time})}`}
   :{key:'o',over:true,tone:'watch',title:cp('loading'),noticed:'',checked:[],sat:[0,1,2,3,4],sim:!real};
  return [over,...DAY.map((_,i)=>day(i))]},[lang,op,b,real]);
 const m=ms[Math.min(idx,ms.length-1)],last=idx>=ms.length-1;
 useEffect(()=>{if(!play)return;if(last){setPlay(false);return}const id=setTimeout(()=>setIdx(i=>i+1),8000);return()=>clearTimeout(id)},[play,idx,last]);
 useEffect(()=>{onState(play?AS[m.tone]:'WATCHING')},[play,idx,m.tone]);
 useEffect(()=>()=>onState('WATCHING'),[]);
 const go=(i:number)=>{setPlay(false);setIdx(Math.max(0,Math.min(ms.length-1,i)))};
 const tgt=m.arc?m.arc[1]:m.focus,c=airports.find(a=>a.iata==='RUH'),a=airports.find(x=>x.iata===tgt);
 const q=c&&a?pt(a,c):{x:300,y:300},ix=Math.max(-14,Math.min(14,(q.x-300)/270*22)),iy=Math.max(-14,Math.min(14,(q.y-300)/270*22));
 const ok=done.includes(m.key),pending=!!m.approve&&!ok;
 return <section id="room" className={`sc-stage t-${m.tone}`} aria-live="polite">
  <World airports={airports} arc={m.arc} focus={m.focus} k={m.key}/><div className="sc-vig"/>
  <div className="sc-eye-wrap" style={{['--ix' as string]:`${ix}px`,['--iy' as string]:`${iy}px`}}>
   <div className={`sc-eye${play?' live':''}`} role="img" aria-label={cp('tone.'+m.tone)}><span className="rg"/><span className="rg r2"/><span className="ir"><i/></span></div>
   {SAT.map((s,i)=><span key={s} className={`sat${m.sat.includes(i)?' on':''}`} style={{['--a' as string]:`${ANG[i]}deg`}}>{s}</span>)}
  </div>
  <span className="sc-pill">{m.sim?cp('badge.sim'):cp('badge.live')}</span>
  <div className="sc-copy" key={m.key}>
   {m.time&&<span className="sc-time">{m.time}</span>}
   <h2 className="rv" style={{['--d' as string]:'0s'}}>{m.title}</h2>
   {m.noticed&&<p className="sc-lead rv" style={{['--d' as string]:'.5s'}}>{m.noticed}</p>}
   {m.lines?.map((l,i)=><p key={l} className="sc-line rv" style={{['--d' as string]:`${1+i*.7}s`}}><i/>{l}</p>)}
   {m.why&&<p className="sc-why rv" style={{['--d' as string]:'1.1s'}}>{m.why}</p>}
   {m.checked.length>0&&<ul className="sc-chk">{m.checked.map((x,i)=><li key={x} className="rv" style={{['--d' as string]:`${1.5+i*.55}s`}}>{x}</li>)}</ul>}
   {m.rec&&<p className="sc-rec rv" style={{['--d' as string]:`${1.8+m.checked.length*.55}s`}}><small>{cp('st.rec')}</small>{m.rec}</p>}
   {pending&&<div className="sc-act rv" style={{['--d' as string]:`${2.2+m.checked.length*.55}s`}}><HoldRing onDone={()=>{setDone(d=>[...d,m.key]);setPlay(false)}}/><span>{cp('st.approve')}</span></div>}
   {m.approve&&ok&&<p className="sc-done" role="status">{cp('st.draft')}</p>}
   {m.over&&b&&<div className="sc-act rv" style={{['--d' as string]:`${1.4+(m.lines?.length??0)*.7}s`}}><button onClick={()=>{setIdx(1);setPlay(true)}}>{cp('day.run')}</button></div>}
   {m.foot&&<p className="sc-foot">{m.foot}</p>}
  </div>
  <nav className="sc-rail" aria-label={cp('day.pick')}>
   <button className="nx" onClick={()=>go(idx-1)} disabled={idx===0} aria-label="‹">‹</button>
   {ms.map((x,i)=><button key={x.key} className={`rd t-${x.tone}${i===idx?' on':''}${i>idx&&play?' later':''}`} onClick={()=>go(i)} aria-current={i===idx} aria-label={x.time??x.title}><i/>{i===idx&&x.time&&<b>{x.time}</b>}</button>)}
   <button className="nx" onClick={()=>go(idx+1)} disabled={last} aria-label="›">›</button>
  </nav>
  {m.sim&&<p className="sc-sim">{cp('day.sim')}</p>}
 </section>;
}
