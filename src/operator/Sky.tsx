import {useMemo} from 'react';
import {useI18n} from '../i18n';
import {useT} from './copy';
import {useAir,tm,dt} from './ctx';
import {W,H,frame,arcPath,type Ap} from './geo';
// القطعة المميّزة: سماء ليلية فيها المطارات نجوم، والرحلة قوس ذهبي يُرسم مرة واحدة وتسير عليه نقطة هادئة.
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export function ArcStage({a,b,label}:{a?:Ap;b?:Ap|null;label:string}){
 const air=useAir();
 const g=useMemo(()=>{
  if(!a)return null;const f=frame(a,b??null);
  const near=[...air.values()].filter(x=>x.code!==a.code&&x.code!==b?.code&&Math.abs(x.lat-f.cLat)<f.halfLat&&Math.abs(x.lon-f.cLon)<f.halfLon).slice(0,60).map(x=>({code:x.code,p:f.P(x)}));
  const lines:{k:string;x1:number;y1:number;x2:number;y2:number}[]=[];
  const s=f.step,lat0=Math.ceil((f.cLat-f.halfLat)/s)*s,lon0=Math.ceil((f.cLon-f.halfLon)/s)*s;
  for(let la=lat0;la<=f.cLat+f.halfLat;la+=s){const y=f.P({lat:la,lon:f.cLon})[1];lines.push({k:'a'+la,x1:0,y1:y,x2:W,y2:y})}
  for(let lo=lon0;lo<=f.cLon+f.halfLon;lo+=s){const x=f.P({lat:f.cLat,lon:lo})[0];lines.push({k:'o'+lo,x1:x,y1:0,x2:x,y2:H})}
  const p=f.P(a),q=b?f.P(b):null;
  return {near,lines,p,q,path:q?arcPath(p,q):''};
 },[a,b,air]);
 if(!g||!a)return <div className="sk-map sk-void" role="img" aria-label={label}/>;
 const left=g.q?g.p[0]<=g.q[0]:true;const mv=!reduced();
 return <svg key={a.code+(b?.code??'')} className="sk-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="skg"><stop offset="0" stopColor="#c6a15b" stopOpacity=".55"/><stop offset="1" stopColor="#c6a15b" stopOpacity="0"/></radialGradient>
   <linearGradient id="ska" x1="0" x2="1"><stop offset="0" stopColor="#8f7a43"/><stop offset=".55" stopColor="#e2cb94"/><stop offset="1" stopColor="#c6a15b"/></linearGradient></defs>
  <g className="sk-grat">{g.lines.map(l=><line key={l.k} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}/>)}</g>
  <g className="sk-stars">{g.near.map(n=><circle key={n.code} cx={n.p[0]} cy={n.p[1]} r="1.6"/>)}</g>
  {g.q&&<><path className="sk-trace" d={g.path} fill="none"/><path className="sk-draw" d={g.path} pathLength={1} fill="none" stroke="url(#ska)"/>
   {mv&&<circle className="sk-fly" r="4.2"><animateMotion dur="7s" begin="1.6s" repeatCount="indefinite" path={g.path} keyPoints="0;1" keyTimes="0;1" calcMode="linear"/></circle>}</>}
  <g className="sk-pin" transform={`translate(${g.p[0]},${g.p[1]})`}><circle r="26" fill="url(#skg)"/><circle r="5"/><text x={g.q?(left?-14:14):0} y={g.q?5:-18} textAnchor={g.q?(left?'end':'start'):'middle'}>{a.code}</text></g>
  {g.q&&b&&<g className="sk-pin" transform={`translate(${g.q[0]},${g.q[1]})`}><circle r="26" fill="url(#skg)"/><circle r="5"/><text x={left?14:-14} y="5" textAnchor={left?'start':'end'}>{b.code}</text></g>}
 </svg>;
}
// ساعة السماء: 24 ساعة في حلقة، الظهيرة فوق ومنتصف الليل تحت. نافذة الإقلاع قوس ذهبي على توقيت جهازك.
export function SkyClock({from,until}:{from:string;until:string}){
 const {lang}=useI18n();const t=useT();const f=new Date(from),u=new Date(until);
 const R=46,C=60;const th=(d:Date)=>((d.getHours()+d.getMinutes()/60)/24)*2*Math.PI+Math.PI;
 const pt=(x:number):[number,number]=>[C+R*Math.sin(x),C-R*Math.cos(x)];
 const span=(+u-+f)/36e5,full=span>=23.5,dot=span<0.25;
 const p1=pt(th(f)),p2=pt(th(u));const big=span>12?1:0;
 const ticks=Array.from({length:24},(_,i)=>{const x=(i/24)*2*Math.PI,r1=i%6===0?R-9:R-5,r2=R-1;return <line key={i} x1={C+r1*Math.sin(x)} y1={C-r1*Math.cos(x)} x2={C+r2*Math.sin(x)} y2={C-r2*Math.cos(x)}/>});
 return <figure className="sk-clock" aria-label={`${t.clock} ${tm(f,lang)}${dot?'':' – '+tm(u,lang)}`}>
  <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="sk-ring" cx={C} cy={C} r={R}/><g className="sk-tick">{ticks}</g>
   {full?<circle className="sk-win" cx={C} cy={C} r={R}/>:dot?<circle className="sk-dot" cx={p1[0]} cy={p1[1]} r="4"/>:<path className="sk-win" d={`M${p1[0]},${p1[1]} A${R},${R} 0 ${big} 1 ${p2[0]},${p2[1]}`} fill="none"/>}
   <text x={C} y={C+3} textAnchor="middle" className="sk-ct">{tm(f,lang)}</text><text x={C} y={C+17} textAnchor="middle" className="sk-cd">{dt(f,lang)}</text></svg>
  {!dot&&!full&&<figcaption>{t.until} {tm(u,lang)}</figcaption>}</figure>;
}
