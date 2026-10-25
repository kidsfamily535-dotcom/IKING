import {useEffect,useRef,useState} from 'react';
import './cinema.css';
// الصفحة الافتتاحية: الخليج ليلًا من الفضاء، ومسارات طيران ذهبية بين مدنه. بلا جداول ولا لوحات.
// الإحداثيات نسب من صورة /earth-night.jpg (1920×1088) وقعت على عناقيد إضاءة المدن نفسها.
const IW=1920,IH=1088,PX=.5,PY=.78;
const HUB:Record<string,[number,number]>={CAI:[.136,.592],JED:[.314,.805],RUH:[.459,.72],KWI:[.472,.589],DOH:[.518,.676],DXB:[.626,.72]};
const ROUTES:[string,string][]=[['RUH','JED'],['DXB','RUH'],['JED','CAI'],['DOH','JED'],['KWI','DXB'],['CAI','KWI']];
type T={name:string;line:string;open:string;more:string};
const COPY:Record<string,T>={
 ar:{name:'عين الملك',line:'عينٌ تسبق رحلتك',open:'افتح عينك',more:'استكشف'},
 en:{name:'Eye King',line:'An eye ahead of every journey',open:'Open your eye',more:'Explore'},
 ru:{name:'Око Короля',line:'Око, опережающее ваш путь',open:'Откройте око',more:'Исследовать'},
 tr:{name:'Kralın Gözü',line:'Yolculuğunuzdan önce gören göz',open:'Gözünüzü açın',more:'Keşfedin'}
};
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease=(x:number)=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));

function Routes(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const cv=ref.current;if(!cv)return;const cx=cv.getContext('2d');if(!cx)return;
  const still=calm();let W=0,H=0,dpr=1,raf=0;const t0=performance.now();
  const fit=()=>{const r=cv.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;if(still)draw(99)};
  const P=(k:string):[number,number]=>{const s=Math.max(W/IW,H/IH),ox=(W-IW*s)*PX,oy=(H-IH*s)*PY,h=HUB[k];return[ox+h[0]*IW*s,oy+h[1]*IH*s]};
  const at=(a:[number,number],b:[number,number],u:number):[number,number]=>{
   const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2-Math.hypot(b[0]-a[0],b[1]-a[1])*.34,v=1-u;
   return[v*v*a[0]+2*v*u*mx+u*u*b[0],v*v*a[1]+2*v*u*my+u*u*b[1]]};
  function draw(t:number){
   cx!.setTransform(dpr,0,0,dpr,0,0);cx!.clearRect(0,0,W,H);cx!.lineCap='round';
   ROUTES.forEach(([f,g],i)=>{
    const a=P(f),b=P(g),st=3.2+i*.8,p=ease(clamp((t-st)/3));if(p<=0)return;
    cx!.beginPath();for(let n=0;n<=64;n++){const q=at(a,b,p*n/64);n?cx!.lineTo(q[0],q[1]):cx!.moveTo(q[0],q[1])}
    cx!.strokeStyle='rgba(232,205,140,.5)';cx!.lineWidth=1.1;cx!.shadowColor='rgba(232,190,100,.7)';cx!.shadowBlur=8;cx!.stroke();cx!.shadowBlur=0;
    if(p>=1&&!still){const u=((t-st-3)/7+i*.19)%1;
     for(let n=0;n<14;n++){const q=at(a,b,Math.max(0,u-n*.006));cx!.fillStyle=`rgba(255,236,190,${(1-n/14)*.55})`;cx!.beginPath();cx!.arc(q[0],q[1],2.1*(1-n/20),0,6.3);cx!.fill()}
     const h=at(a,b,u);cx!.shadowColor='#ffe9b0';cx!.shadowBlur=16;cx!.fillStyle='#fff6dc';cx!.beginPath();cx!.arc(h[0],h[1],2.3,0,6.3);cx!.fill();cx!.shadowBlur=0}
   });
   Object.keys(HUB).forEach((k,i)=>{const q=P(k),a=clamp((t-2.6-i*.25)/1.2);if(a<=0)return;
    const pu=still?0:(Math.sin(t*1.3+i)+1)/2;
    cx!.strokeStyle=`rgba(232,205,140,${.35*a*(1-pu*.6)})`;cx!.lineWidth=1;cx!.beginPath();cx!.arc(q[0],q[1],4+pu*7,0,6.3);cx!.stroke();
    cx!.fillStyle=`rgba(255,240,205,${a})`;cx!.shadowColor='#f0cf86';cx!.shadowBlur=12;cx!.beginPath();cx!.arc(q[0],q[1],2.6,0,6.3);cx!.fill();cx!.shadowBlur=0})}
  const loop=()=>{draw((performance.now()-t0)/1000);raf=requestAnimationFrame(loop)};
  fit();addEventListener('resize',fit);if(!still)raf=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(raf);removeEventListener('resize',fit)}},[]);
 return <canvas ref={ref} className="cn-routes" aria-hidden="true"/>;
}

export default function CinemaHome({real,lang}:{real:boolean;lang:string}){
 const c=COPY[lang]||COPY.en,[lid,setLid]=useState(!calm()),root=useRef<HTMLElement>(null);
 useEffect(()=>{const el=root.current;if(!el||calm())return;let f=0;
  const mv=(e:PointerEvent)=>{cancelAnimationFrame(f);f=requestAnimationFrame(()=>{el.style.setProperty('--px',String(e.clientX/innerWidth-.5));el.style.setProperty('--py',String(e.clientY/innerHeight-.5))})};
  addEventListener('pointermove',mv);return()=>{removeEventListener('pointermove',mv);cancelAnimationFrame(f)}},[]);
 return <section className={`cn${lang==='ar'?' ar':''}`} ref={root} aria-labelledby="cn-h">
  <div className="cn-stage"><div className="cn-par">
   <img className="cn-img" src="/earth-night.jpg" alt="" fetchPriority="high" decoding="async" style={{objectPosition:`${PX*100}% ${PY*100}%`}}/>
   <Routes/>
  </div></div>
  <div className="cn-shade" aria-hidden="true"/><div className="cn-grain" aria-hidden="true"/>
  <div className="cn-copy">
   <svg className="cn-mark" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C9 2 31 2 38 12 31 22 9 22 2 12Z" fill="none" stroke="#d9bf86" strokeWidth="1.2"/><circle cx="20" cy="12" r="4.6" fill="#d9bf86"/><circle cx="20" cy="12" r="1.8" fill="#02040a"/></svg>
   <h1 id="cn-h" className="cn-title">{c.name}</h1>
   <p className="cn-line">{c.line}</p>
  </div>
  <div className="cn-cta">
   {!real&&<a className="cn-btn main" href="?view=cabin">{c.open}</a>}
   <a className="cn-btn quiet" href={'/inside-the-kings-eye.html?lang='+lang}>{c.more}</a>
  </div>
  {lid&&<svg className="cn-lid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
   <defs><mask id="cn-m"><rect width="100" height="100" fill="#fff"/><path className="cn-hole" d="M-1 50Q50 -18 101 50Q50 118 -1 50Z" fill="#000"/></mask></defs>
   <rect width="100" height="100" fill="#02040a" mask="url(#cn-m)"/>
   <path className="cn-hole cn-rim" d="M-1 50Q50 -18 101 50Q50 118 -1 50Z" fill="none" stroke="#e6cf94" strokeWidth="1.4" vectorEffect="non-scaling-stroke" onAnimationEnd={()=>setLid(false)}/>
  </svg>}
 </section>;
}
