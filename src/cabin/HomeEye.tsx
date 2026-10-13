import {useMemo} from 'react';
import {useI18n} from '../i18n';
import {copy} from './copy';
import {hub,dist,flightMin,plot,rr} from './geo';
// رادار الصفحة الرئيسية كما في المعاينة المعتمدة: العين نفسها. حلقات رفيعة، قزحية تنبض على الرياض،
// نبضات بطيئة بين المدن، وخط ذهبي من القاهرة إلى الرياض. المواضع من الإحداثيات الحقيقية.
// لمس أي مدينة يفتح الكابينة وقد اختيرت الوجهة.
const RANGE=2200;
const CITIES=['CAI','IST','AMM','KWI','DMM','DXB','MED','JED'];
// نبضات بطيئة: [المدينة، التأخير بالثواني، تُخفى على الهاتف]
const PULSES:[string,number,boolean][]=[['CAI',0,false],['DXB',2,false],['JED',4,true],['IST',5.4,false],['KWI',6.8,true]];
const km10=(n:number)=>(Math.round(n/10)*10).toLocaleString('en');
const RINGS:[number,string][]=[[250,'250'],[1000,'1,000'],[2000,'2,000']];
export default function HomeEye({onGo}:{onGo:(iata:string)=>void}){
 const {lang}=useI18n(),c=copy(lang),L=lang;
 const F=hub('RUH'),nm=(i:string)=>L==='ar'?hub(i).ar:hub(i).en;
 const P=useMemo(()=>Object.fromEntries(CITIES.map(i=>[i,plot(F,hub(i),RANGE)])),[]);
 const ticks=useMemo(()=>Array.from({length:120},(_,i)=>{const a=i*Math.PI/60,r2=i%10===0?270:i%5===0?264:259;return{k:i,x1:300+252*Math.cos(a),y1:300+252*Math.sin(a),x2:300+r2*Math.cos(a),y2:300+r2*Math.sin(a)}}),[]);
 const fibers=useMemo(()=>Array.from({length:72},(_,j)=>{const a=j*Math.PI/36,r1=j%2?38:36,r2=j%3?50:58;return{k:j,x1:300+r1*Math.cos(a),y1:300+r1*Math.sin(a),x2:300+r2*Math.cos(a),y2:300+r2*Math.sin(a)}}),[]);
 const A=P.CAI,km=dist(F,hub('CAI')),m=flightMin(km);
 const dur=m<60?`${m} ${c.units.m}`:`${Math.floor(m/60)} ${c.units.h} ${String(m%60).padStart(2,'0')} ${c.units.m}`;
 const bend=`M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${((A.x+300)/2+4).toFixed(1)} ${((A.y+300)/2+6).toFixed(1)} 300 300`;
 const side=(x:number)=>x>400?{x:x-9,a:'end' as const}:{x:x+9,a:'start' as const};
 return <figure className="he">
  <svg id="radar" viewBox="0 0 600 600" role="img" aria-label={c.gl.radar}>
   <defs>
    <radialGradient id="he-ir" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#1b1408"/><stop offset=".34" stopColor="#1b1408"/><stop offset=".36" stopColor="#f2e2b4"/><stop offset=".7" stopColor="#d6bb82"/><stop offset="1" stopColor="#8d7440"/></radialGradient>
    <radialGradient id="he-gw" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ecd9a8" stopOpacity=".6"/><stop offset="1" stopColor="#ecd9a8" stopOpacity="0"/></radialGradient>
    <linearGradient id="he-sg" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#e3c98c" stopOpacity=".3"/><stop offset="1" stopColor="#e3c98c" stopOpacity="0"/></linearGradient>
   </defs>
   <g>{ticks.map(t=><line key={t.k} className="fib" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}/>)}</g>
   {RINGS.map(([k,l],i)=><circle key={k} className={`ring${i===2?' t':''}`} cx="300" cy="300" r={rr(k,RANGE)}/>)}
   {RINGS.map(([k,l])=><text key={'t'+k} className="rl" x="306" y={300-rr(k,RANGE)-4}>{l} {c.units.km}</text>)}
   <path className="sweep" d="M300 300 L570 300 A270 270 0 0 0 491 109 Z" fill="url(#he-sg)"/>
   <g>{fibers.map(t=><line key={t.k} className="fib" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}/>)}</g>
   <circle className="echo" cx="300" cy="300" r="34"/><circle className="echo" style={{animationDelay:'4s'}} cx="300" cy="300" r="34"/>
   {CITIES.map(i=>{const p=P[i],s=side(p.x);return <g key={i} className="city" tabIndex={0} role="button" aria-label={nm(i)} onClick={()=>onGo(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onGo(i)}}}>
    <circle className="hit" cx={p.x} cy={p.y} r="22"/><circle className="d" cx={p.x} cy={p.y} r="3.2"/><text x={s.x} y={p.y-3} textAnchor={s.a}>{nm(i)}</text></g>})}
   {PULSES.map(([i,d,x])=><circle key={i} className={`p${x?' x':''}`} style={{['--d' as any]:`${d}s`}} cx={P[i].x} cy={P[i].y} r="3"/>)}
   <path className="route" d={bend}/>
   <circle className="glow" cx="300" cy="300" r="46" fill="url(#he-gw)"/>
   <circle className="iris" cx="300" cy="300" r="30" fill="url(#he-ir)"/>
   <circle cx="300" cy="300" r="11.5" fill="#0f0c08"/>
   <circle cx="294" cy="294" r="3" fill="#fff8e4" opacity=".85"/>
   <text className="rn" x="300" y="352" textAnchor="middle">{nm('RUH')}</text>
  </svg>
  <figcaption className="cap">{c.ask.read(nm('CAI'),nm('RUH'),km10(km),dur)}</figcaption>
 </figure>;
}
