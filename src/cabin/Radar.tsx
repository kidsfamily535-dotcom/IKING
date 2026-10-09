import {useEffect,useMemo,useRef,useState} from 'react';
import './cabin.css';
import {between,plot,rr,type Hub} from './geo';
// الرادار هو واجهة الإدخال والمعنى معًا. الدوائر والمسارات في SVG، والمدن والطائرات أزرار HTML
// حتى تبقى أهداف اللمس 44px على أي شاشة والخطوط مقروءة (تتبع عرض الرادار لا عرض الصفحة).
export interface Blip{id:string;hub:string;dx:number;dy:number;sel:boolean;label:string;posFrom?:string}
interface Props{
 hubs:Hub[];from:string;to:string|null;hover:string|null;name:(h:Hub)=>string;
 range:number;blips:Blip[];scanning:boolean;plane:number|null;alt:string|null;hud:string;aria:string;
 warn?:string[];eye?:boolean;onHover:(i:string|null)=>void;onPick:(i:string)=>void;onBlip:(id:string)=>void;kmUnit:string;
}
const N=56;
// الشكل «العين»: اللوزة أعرض من الدائرة. نفس إحداثيات الرادار (0..600) تُزاح أفقيًا، وتحت اللوزة شريط للسطر الإخباري.
const EVW=760,EVH=660,LID=280,SW=16;
function Lid({vw}:{vw:number}){
 const L=8,R=vw-8,cx=vw/2,cy=300,Cy=cy-2*LID;
 const q=(t:number)=>({x:(1-t)*(1-t)*L+2*(1-t)*t*cx+t*t*R,y:(1-t)*(1-t)*cy+2*(1-t)*t*Cy+t*t*cy});
 const lashes=Array.from({length:17},(_,i)=>{const t=(i+1)/18,a=q(t),tx=2*(1-t)*(cx-L)+2*t*(R-cx),ty=2*(1-t)*(Cy-cy)+2*t*(cy-Cy),n=Math.hypot(tx,ty),nx=ty/n,ny=-tx/n,len=5+12*Math.sin(Math.PI*t);
  return <line key={i} x1={a.x} y1={a.y} x2={a.x+nx*len} y2={a.y+ny*len} stroke="#c9a961" strokeOpacity=".65" strokeWidth="1.4" strokeLinecap="round"/>});
 const lid=`M${L},${cy} Q${cx},${Cy} ${R},${cy} Q${cx},${cy+2*LID} ${L},${cy}Z`;
 return <g className="cr-lid" aria-hidden>
  <path d={lid} fill="#78a0c8" fillOpacity=".045"/>
  <path d={lid} fill="none" stroke="#c9a961" strokeOpacity=".22" strokeWidth="1" transform={`translate(${cx} ${cy}) scale(.955 .9) translate(${-cx} ${-cy})`}/>
  <path d={lid} fill="none" stroke="#c9a961" strokeOpacity=".9" strokeWidth="2"/>
  {lashes}
 </g>;
}
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
// تحريك سلس لمركز الرادار ومداه عند تغيير نقطة الانطلاق أو الوجهة
function useTween(t:{lat:number;lon:number;range:number}){
 const [v,setV]=useState(t),cur=useRef(t);
 useEffect(()=>{
  if(calm()){cur.current=t;setV(t);return}
  const a=cur.current,t0=performance.now();let raf=0;
  const tick=(n:number)=>{const k=Math.min(1,(n-t0)/900),e=1-Math.pow(1-k,3);
   const s={lat:a.lat+(t.lat-a.lat)*e,lon:a.lon+(t.lon-a.lon)*e,range:a.range+(t.range-a.range)*e};
   cur.current=s;setV(s);if(k<1)raf=requestAnimationFrame(tick)};
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[t.lat,t.lon,t.range]);
 return v;
}
const NICE=[250,500,1000,1500,2000,3000,4000,5000,6000,8000,10000];
export default function Radar(p:Props){
 const f=p.hubs.find(h=>h.iata===p.from)!,d=p.to?p.hubs.find(h=>h.iata===p.to)??null:null;
 const v=useTween({lat:f.lat,lon:f.lon,range:p.range});
 const box=useRef<HTMLDivElement>(null);
 const eye=!!p.eye,VW=eye?EVW:600,VH=eye?EVH:600,OFF=(VW-600)/2;
 const px=(n:number)=>`${((n+OFF)/VW*100).toFixed(2)}%`,py=(n:number)=>`${(n/VH*100).toFixed(2)}%`;
 const P=useMemo(()=>Object.fromEntries(p.hubs.map(h=>[h.iata,plot(v,h,v.range)])),[p.hubs,v]);
 const fx=P[f.iata],dx=d?P[d.iata]:null;
 // مسار الدائرة العظمى بين المنطلق والوجهة
 const route=useMemo(()=>d?Array.from({length:N+1},(_,i)=>plot(v,between(f,d,i/N),v.range)):[],[d,f,v]);
 const pts=(a:{x:number;y:number}[])=>a.map((q,i)=>`${i?'L':'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join('');
 const done=p.plane===null?route.length-1:Math.round(p.plane*N);
 const planeAt=route.length&&p.plane!==null?route[Math.min(done,N)]:null,prev=route.length&&p.plane!==null?route[Math.max(0,Math.min(done,N)-1)]:null,next=route.length&&p.plane!==null?route[Math.min(N,done+1)]:null;
 const hd=planeAt&&prev&&next?Math.atan2(next.x-prev.x,-(next.y-prev.y))*180/Math.PI:0;
 // حلقات المسافة (أرقام حقيقية بالكيلومتر، نصف القطر مضغوط)
 const rings=useMemo(()=>{const o:number[]=[];let last=-99;for(const k of NICE){if(k>=v.range)break;const r=rr(k,v.range);if(r>=70&&r-last>=52){o.push(k);last=r}}return o},[v.range]);
 // أي الأسماء تظهر: الأهم أولًا، ومن غير تصادم
 const shown=useMemo(()=>{
  const order=[...p.hubs].filter(h=>P[h.iata].d<=v.range*1.001).sort((a,b)=>{const w=(h:Hub)=>h.iata===p.from?-3:h.iata===p.to?-2:h.iata===p.hover?-4:h.pri;return w(a)-w(b)});
  const rects:{x0:number;x1:number;y0:number;y1:number}[]=[],out:Record<string,'r'|'l'>={};
  for(const h of order){const q=P[h.iata],w=p.name(h).length*10+16,must=h.iata===p.from||h.iata===p.to||h.iata===p.hover;
   for(const s of ['r','l'] as const){const x0=s==='r'?q.x+8:q.x-8-w,r={x0,x1:x0+w,y0:q.y-11,y1:q.y+11};
    if(r.x0<(eye?40-OFF:4)||r.x1>(eye?560+OFF:596))continue;if(!must&&rects.some(o=>r.x0<o.x1&&r.x1>o.x0&&r.y0<o.y1&&r.y1>o.y0))continue;
    rects.push(r);out[h.iata]=s;break}
   if(!out[h.iata]&&must)out[h.iata]=q.x>300?'l':'r'}
  return out;
 },[P,p.hubs,p.from,p.to,p.hover,p.name,v.range,eye,OFF]);
 const scrub=(e:React.PointerEvent)=>{
  const r=box.current?.getBoundingClientRect();if(!r)return;
  const x=(e.clientX-r.left)/r.width*VW-OFF,y=(e.clientY-r.top)/r.height*VH;let b:string|null=null,m=34;
  for(const h of p.hubs){const q=P[h.iata];if(q.d>v.range)continue;const k=Math.hypot(q.x-x,q.y-y);if(k<m){m=k;b=h.iata}}
  p.onHover(b);
 };
 const iris=dx?{x:Math.max(-1,Math.min(1,(dx.x-fx.x)/120))*7,y:Math.max(-1,Math.min(1,(dx.y-fx.y)/120))*7}:{x:0,y:0};
 return <div className={`cr${eye?' eye':''}`} ref={box} role="group" aria-label={p.aria} onPointerMove={scrub} onPointerLeave={()=>p.onHover(null)}>
  <svg viewBox={`0 0 ${VW} ${VH}`} aria-hidden>
   {eye&&<Lid vw={VW}/>}
   <g transform={eye?`translate(${OFF} 0)`:undefined}>
   <defs><radialGradient id="rdg" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#16264a" stopOpacity=".85"/><stop offset="1" stopColor="#060b16" stopOpacity="0"/></radialGradient></defs>
   <circle cx="300" cy="300" r="286" fill="url(#rdg)"/>
   {rings.map(k=><circle key={k} cx="300" cy="300" r={rr(k,v.range)} fill="none" stroke="#f4ecdc" strokeOpacity=".09"/>)}
   <circle cx="300" cy="300" r="270" fill="none" stroke="#f4ecdc" strokeOpacity=".16"/>
   {Array.from({length:72},(_,i)=>{const a=i*5*Math.PI/180,m=i%6?3:9;return <line key={i} x1={300+270*Math.sin(a)} y1={300-270*Math.cos(a)} x2={300+(270-m)*Math.sin(a)} y2={300-(270-m)*Math.cos(a)} stroke="#f4ecdc" strokeOpacity={i%6?.18:.4}/>})}
   {eye&&Array.from({length:36},(_,i)=>{const a=(x:number)=>x*Math.PI/180;return <line key={'sp'+i} x1={300+Math.sin(a(i*10))*54} y1={300-Math.cos(a(i*10))*54} x2={300+Math.sin(a(i*10))*270} y2={300-Math.cos(a(i*10))*270} stroke="#78a0c8" strokeOpacity={i%3?.05:.11}/>})}
   {eye?<g className="cr-sweep">{Array.from({length:9},(_,k)=>{const a=(x:number)=>x*Math.PI/180,a1=-(k+1)*3.4,a2=-k*3.4;return <path key={k} d={`M300,300 L${300+270*Math.sin(a(a1))},${300-270*Math.cos(a(a1))} A270,270 0 0 1 ${300+270*Math.sin(a(a2))},${300-270*Math.cos(a(a2))} Z`} fill="#78a0c8" fillOpacity={.17*(1-k/9)}/>})}<line x1="300" y1="300" x2="300" y2="30" stroke="#c9a961" strokeOpacity=".75" strokeWidth="1.3"/></g>
   :<g className="cr-sweep"><path d="M300,300 L300,30 A270,270 0 0 1 400,48 Z" fill="#c9a961" fillOpacity=".08"/><line x1="300" y1="300" x2="300" y2="30" stroke="#c9a961" strokeOpacity=".5"/></g>}
   {p.hover&&p.hover!==p.from&&P[p.hover]&&!p.to&&<path d={pts(Array.from({length:N+1},(_,i)=>plot(v,between(f,p.hubs.find(h=>h.iata===p.hover)!,i/N),v.range)))} fill="none" stroke="#f4ecdc" strokeOpacity=".55" strokeDasharray="2 6"/>}
   {route.length>0&&<><path d={pts(route)} fill="none" stroke="#f4ecdc" strokeOpacity=".28" strokeDasharray="2 7"/><path className="cr-arc" key={p.to??'x'} d={pts(route.slice(0,done+1))} pathLength={1} fill="none" stroke="#c9a961" strokeWidth="1.6" strokeLinecap="round"/></>}
   {p.blips.map(b=>{const o=P[b.hub];if(!o)return null;const q={x:o.x+b.dx,y:o.y+b.dy};return b.posFrom&&b.sel?<line key={b.id+'l'} x1={q.x} y1={q.y} x2={fx.x} y2={fx.y} stroke="#78a0c8" strokeOpacity=".8" strokeDasharray="3 5"/>:null})}
   {p.scanning&&<circle className="cr-scan" cx={fx.x} cy={fx.y} r="14" fill="none" stroke="#c9a961" style={{transformOrigin:`${fx.x}px ${fx.y}px`}}/>}
   {planeAt&&<g transform={`translate(${planeAt.x} ${planeAt.y}) rotate(${hd})`}><circle r="11" fill="#c9a961" fillOpacity=".18"/><path d="M0,-8 L5.5,7 L0,3.5 L-5.5,7Z" fill="#f4ecdc"/></g>}
   {p.alt&&dx&&<><circle cx={dx.x+18} cy={dx.y-14} r="9" fill="none" stroke="#e6c36a" strokeDasharray="2 3"/><line x1={dx.x} y1={dx.y} x2={dx.x+18} y2={dx.y-14} stroke="#e6c36a" strokeOpacity=".6"/></>}
   </g>
  </svg>
  {rings.map(k=><span key={'t'+k} className="cr-rl" style={{top:py(300-rr(k,v.range))}}>{k.toLocaleString('en')} {p.kmUnit}</span>)}
  {p.hubs.map(h=>{const q=P[h.iata];if(q.d>v.range*1.001)return null;const s=shown[h.iata],on=h.iata===p.from||h.iata===p.to,hot=h.iata===p.hover;
   return <button key={h.iata} type="button" className={`cr-n${p.warn?.includes(h.iata)?' warn':''}${on?' on':''}${hot?' hot':''}${h.iata===p.from?' org':''}`} style={{left:px(q.x),top:py(q.y),...(eye?{'--d':`${(((Math.atan2(q.x-300,300-q.y)*180/Math.PI+360)%360)/360*SW).toFixed(2)}s`} as React.CSSProperties:{})}} onClick={()=>p.onPick(h.iata)} aria-pressed={h.iata===p.to} aria-label={p.name(h)}>
    <i/>{s&&<span className={`cr-l ${s}`}>{p.name(h)}</span>}</button>})}
  <div className="cr-eye" style={{left:px(fx.x),top:py(fx.y)}} aria-hidden><span className="rg"/><span className="rg r2"/><span className="ir" style={{transform:`translate(${iris.x}px,${iris.y}px)`}}><i/></span></div>
  {p.blips.map(b=>{const o=P[b.hub];if(!o)return null;const q={x:o.x+b.dx,y:o.y+b.dy};
   return <button key={b.id} type="button" className={`cr-b${b.sel?' sel':''}`} style={{left:px(q.x),top:py(q.y)}} onClick={()=>p.onBlip(b.id)} aria-pressed={b.sel} aria-label={b.label}><i/></button>})}
  <p className="cr-hud" aria-live="polite">{p.hud}</p>
 </div>;
}
