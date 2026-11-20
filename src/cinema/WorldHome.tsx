import {useEffect,useMemo,useRef,useState} from 'react';
import {useI18n} from '../i18n';
import {HUBS,hub,dist,flightMin,type Hub} from '../cabin/geo';
import {useWorld,waHub} from '../cabin/world';
import {readTrip} from './ImageHome';
import RafiqChat from './RafiqChat';
import './worldhome.css';
// الصفحة الرئيسية البديلة (?view=radar): خريطة العالم كرادار طيران + محاكاة الرحلة مرحلةً مرحلة. كل الأرقام تقدير وتُعلَّم بذلك.
type S={a:Hub;b:Hub;km:number;st:number[];tot:number;m:number};
const ROUTES=['JED-CAI','RUH-DXB','CAI-DXB','JED-RUH','DMM-DXB','RUH-CAI','DXB-LON','CAI-IST','JED-AMM','DXB-CDG','RUH-IST','DOH-CDG','JED-MED','AUH-RUH','KWI-DXB','RUH-LON','DXB-GVA','RUH-GVA','CAI-LON','CAI-CDG','DXB-TEB'];
const T={
 ar:{h:'وين رحلتك؟',sub:'اكتبها بكلامك، أو اختر خطًا من الشريط تحت. العين تتابعها معك من أول الباب.',ph:'مثال: من جدة إلى القاهرة',go:'ابدأ',no:'لم أجد مدينتين واضحتين. جرّب: من جدة إلى القاهرة',sim:'رحلتك · محاكاة تقديرية',km:'كم',left:'المتبقي',eta:'وصول (توقيت الوجهة)',pause:'إيقاف',play:'تشغيل',again:'من الأول',close:'إغلاق',req:'اطلب هذه الرحلة',strip:'خطوط السير · شغّل خطًا لبدء المتابعة',
  stg:['الانتقال إلى المطار','الصالة والإجراءات','الإقلاع','التحليق','الهبوط','إلى وجهتك'],
  d:(A:string,B:string,s:S,left:number)=>[
   [`من مكانك في ${A} إلى المطار أو الـFBO — حوالي ${s.st[0]} دقيقة`,'النقل الأرضي: يؤكده موظف بشري|UNKNOWN'],
   [`صالة خاصة وإنهاء الإجراءات وتحميل الأمتعة — حوالي ${s.st[1]} دقيقة`,'الطائرة والتوافر: تتطلب تأكيد المشغّل|UNKNOWN'],
   [`الإقلاع من ${A}`,'الطقس غير مربوط بمصدر حيّ هنا|UNKNOWN'],
   [`المسافة التقريبية ${Math.round(s.km)} كم · الزمن المتبقي على الوصول ${fm(left)}`,'محاكاة|SIM'],
   [`الاستعداد للهبوط في ${B}`,'الطقس والتراخيص تحتاج تأكيد|UNKNOWN'],
   [`النقل من المطار إلى وجهتك النهائية — حوالي ${s.st[5]} دقيقة`,'رحلة سعيدة. العين تراقب حتى آخر خطوة|EST']]},
 en:{h:'Where to?',sub:'Write your trip in your own words, or pick a route below. The Eye follows it with you from the front door.',ph:'e.g. from Jeddah to Cairo',go:'Start',no:'I couldn’t find two clear cities. Try: from Jeddah to Cairo',sim:'Your trip · estimated simulation',km:'km',left:'Remaining',eta:'Arrival (destination time)',pause:'Pause',play:'Play',again:'Restart',close:'Close',req:'Request this trip',strip:'Routes · switch one on to start following it',
  stg:['To the airport','Lounge & formalities','Take-off','In flight','Landing','To your destination'],
  d:(A:string,B:string,s:S,left:number)=>[
   [`From your place in ${A} to the airport or FBO — about ${s.st[0]} min`,'Ground transfer: confirmed by a human|UNKNOWN'],
   [`Private lounge, formalities and baggage — about ${s.st[1]} min`,'Aircraft & availability: operator confirmation required|UNKNOWN'],
   [`Departure from ${A}`,'Weather not connected to a live source here|UNKNOWN'],
   [`Approx. distance ${Math.round(s.km)} km · time left to arrival ${fm(left,true)}`,'Simulation|SIM'],
   [`Preparing to land in ${B}`,'Weather and permits need confirmation|UNKNOWN'],
   [`Transfer from the airport to your final destination — about ${s.st[5]} min`,'Have a good trip. The Eye watches to the last step.|EST']]}
};
const fm=(m:number,en?:boolean)=>{m=Math.max(0,Math.round(m));return m>=60?`${Math.floor(m/60)}${en?'h ':'س '}${m%60}${en?'m':'د'}`:`${m}${en?'m':'د'}`};
const MY=(la:number)=>Math.log(Math.tan(Math.PI/4+Math.max(-80,Math.min(84,la))*Math.PI/360))*180/Math.PI;
const arc=(p0:number[],p1:number[],t:number)=>{const mx=(p0[0]+p1[0])/2,my=(p0[1]+p1[1])/2,dx=p1[0]-p0[0],dy=p1[1]-p0[1],L=Math.hypot(dx,dy)||1,k=L*.2;
 const cx=mx+dy/L*k*Math.sign(dx||1),cy=my-Math.abs(dx)/L*k-Math.abs(dy)/L*k*.3,u=1-t;
 return{x:u*u*p0[0]+2*u*t*cx+t*t*p1[0],y:u*u*p0[1]+2*u*t*cy+t*t*p1[1],a:Math.atan2(2*u*(cy-p0[1])+2*t*(p1[1]-cy),2*u*(cx-p0[0])+2*t*(p1[0]-cx)),cx,cy}};
const mk=(a:Hub,b:Hub):S=>{const km=dist(a,b),cr=Math.max(20,flightMin(km)-30),st=[35,25,15,cr,15,30];return{a,b,km,st,tot:st.reduce((x,y)=>x+y,0),m:0}};
export default function WorldHome(){
 const {lang,setLang}=useI18n(),c=T[lang==='ar'?'ar':'en'],ar=lang==='ar',wa=useWorld();
 const cv=useRef<HTMLCanvasElement>(null),simR=useRef<S|null>(null),pausedR=useRef(false),land=useRef<number[][]>([]);
 const [sim,setSim]=useState<S|null>(null),[paused,setPaused]=useState(false),[say,setSay]=useState(''),[msg,setMsg]=useState(''),[,tick]=useState(0);
 const pool=useMemo(()=>[...HUBS,...(wa?wa.map(waHub):[])],[wa]);
 const nm=(h:Hub)=>ar?h.ar:h.en;
 const start=(a:Hub,b:Hub)=>{const s=mk(a,b);simR.current=s;pausedR.current=false;setPaused(false);setSim(s)};
 const stop=()=>{simR.current=null;setSim(null)};
 const submit=(e:React.FormEvent)=>{e.preventDefault();const r=readTrip(say,pool);if(!r?.from||!r.to||r.from.iata===r.to.iata){setMsg(c.no);return}setMsg('');start(r.from,r.to)};
 useEffect(()=>{fetch('/world-land.json').then(r=>r.json()).then((d:number[][])=>{land.current=d}).catch(()=>{})},[]);
 useEffect(()=>{const id=setInterval(()=>tick(x=>x+1),400);return()=>clearInterval(id)},[]);
 useEffect(()=>{const el=cv.current;if(!el)return;const cx=el.getContext('2d')!;let W=0,H=0,raf=0,D=1;
  const cam={x:45,y:27,s:8,ox:0},tg={x:45,y:27,s:8,ox:0};const defS=()=>Math.max(W/105,H/62);
  const size=()=>{D=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;el.width=W*D;el.height=H*D;cx.setTransform(D,0,0,D,0,0);if(!simR.current){tg.s=defS();cam.s=tg.s}};size();addEventListener('resize',size);
  const P=(lo:number,la:number):number[]=>[W/2+cam.ox+(lo-cam.x)*cam.s,H/2-(MY(la)-MY(cam.y))*cam.s];
  const amb=Array.from({length:7},()=>{let a=HUBS[Math.random()*HUBS.length|0],b=a;while(b===a)b=HUBS[Math.random()*HUBS.length|0];return{a,b,t:Math.random(),v:.0006+Math.random()*.0008}});
  let lastS:S|null=null;
  const frame=(now:number)=>{const s=simR.current;
   if(s!==lastS){lastS=s;if(s){const dl=Math.abs(s.a.lon-s.b.lon),dh=Math.abs(MY(s.a.lat)-MY(s.b.lat)),mob=W<760;tg.x=(s.a.lon+s.b.lon)/2;tg.y=(s.a.lat+s.b.lat)/2;tg.s=Math.min(Math.max(Math.min(W*(mob?.7:.5)/(dl+8),H*(mob?.3:.55)/(dh+6)),defS()),defS()*5);tg.ox=mob?0:(ar?-150:150);if(mob)tg.y-=3}else{tg.x=45;tg.y=27;tg.s=defS();tg.ox=0}}
   for(const k of['x','y','s','ox'] as const)cam[k]+=(tg[k]-cam[k])*.06;
   cx.clearRect(0,0,W,H);const g=cx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.7);g.addColorStop(0,'#0a1426');g.addColorStop(1,'#060b16');cx.fillStyle=g;cx.fillRect(0,0,W,H);
   cx.strokeStyle='rgba(120,160,200,.07)';cx.lineWidth=1;cx.beginPath();for(let lo=-180;lo<=180;lo+=15){const x=P(lo,0)[0];cx.moveTo(x,0);cx.lineTo(x,H)}for(let la=-60;la<=80;la+=10){const y=P(0,la)[1];cx.moveTo(0,y);cx.lineTo(W,y)}cx.stroke();
   cx.beginPath();for(const r of land.current){let mnx=1e9,mxx=-1e9,mny=1e9;for(let i=0;i<r.length;i+=2){if(r[i]<mnx)mnx=r[i];if(r[i]>mxx)mxx=r[i];if(r[i+1]<mny)mny=r[i+1]}if(mny<-60)continue;if(P(mxx,0)[0]<-50||P(mnx,0)[0]>W+50)continue;
    for(let i=0;i<r.length;i+=2){const p=P(r[i],r[i+1]);i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1])}cx.closePath()}
   cx.fillStyle='#101f36';cx.fill();cx.shadowColor='rgba(120,160,200,.5)';cx.shadowBlur=6;cx.strokeStyle='rgba(140,180,220,.5)';cx.lineWidth=.8;cx.stroke();cx.shadowBlur=0;
   {const d=new Date(),doy=(+d-Date.UTC(d.getUTCFullYear(),0,0))/864e5,dv=23.44*Math.sin(2*Math.PI*(doy-81)/365),dec=Math.sign(dv||1)*Math.max(.5,Math.abs(dv)),sl=-((d.getUTCHours()+d.getUTCMinutes()/60)-12)*15,R=Math.PI/180;
    const term=()=>{cx.beginPath();for(let lo=-180;lo<=180;lo+=3){const la=Math.atan(-Math.cos((lo-sl)*R)/Math.tan(dec*R))/R,p=P(lo,la);lo===-180?cx.moveTo(p[0],p[1]):cx.lineTo(p[0],p[1])}};
    term();const pe=dec>0?-84:84,e1=P(180,pe),e0=P(-180,pe);cx.lineTo(e1[0],e1[1]);cx.lineTo(e0[0],e0[1]);cx.closePath();cx.fillStyle='rgba(2,5,14,.5)';cx.fill();term();cx.strokeStyle='rgba(201,169,97,.25)';cx.stroke()}
   const oc=s?s.a:hub('RUH'),o=P(oc.lon,oc.lat),ph=(now/3000)%1;for(let k=0;k<3;k++){const q=(ph+k/3)%1;cx.strokeStyle=`rgba(201,169,97,${.22*(1-q)})`;cx.beginPath();cx.arc(o[0],o[1],q*Math.min(W,H)*.45,0,6.283);cx.stroke()}
   for(const p of amb){p.t+=p.v;if(p.t>1)p.t=0;const q=arc(P(p.a.lon,p.a.lat),P(p.b.lon,p.b.lat),p.t);cx.fillStyle='rgba(120,160,200,.8)';cx.beginPath();cx.arc(q.x,q.y,1.8,0,6.283);cx.fill()}
   cx.font='10px JetBrains Mono, monospace';for(const h of HUBS){const hot=!!s&&(h.iata===s.a.iata||h.iata===s.b.iata);if(!hot&&h.pri>4&&cam.s<defS()*1.8)continue;const p=P(h.lon,h.lat);cx.fillStyle=hot?'#c9a961':'rgba(244,236,220,.7)';cx.beginPath();cx.arc(p[0],p[1],hot?3.5:2,0,6.283);cx.fill();if(hot||h.pri<=2||cam.s>defS()*1.8){cx.fillStyle=hot?'#c9a961':'rgba(244,236,220,.5)';cx.fillText(h.iata,p[0]+6,p[1]-5)}}
   if(s){if(!pausedR.current)s.m=Math.min(s.tot,s.m+s.tot/32/60);
    const a=P(s.a.lon,s.a.lat),b=P(s.b.lon,s.b.lat),f0=s.st[0]+s.st[1],fl=s.st[2]+s.st[3]+s.st[4];let u=Math.min(1,Math.max(0,(s.m-f0)/fl));u=u*u*(3-2*u);
    const q0=arc(a,b,0);cx.strokeStyle='rgba(201,169,97,.35)';cx.setLineDash([4,6]);cx.beginPath();cx.moveTo(a[0],a[1]);cx.quadraticCurveTo(q0.cx,q0.cy,b[0],b[1]);cx.stroke();cx.setLineDash([]);
    cx.strokeStyle='#c9a961';cx.lineWidth=2;cx.beginPath();cx.moveTo(a[0],a[1]);for(let k=1;k<=40;k++){const z=arc(a,b,u*k/40);cx.lineTo(z.x,z.y)}cx.stroke();cx.lineWidth=1;
    const pl=arc(a,b,u);cx.save();cx.translate(pl.x,pl.y);cx.rotate(pl.a);cx.fillStyle='#f4ecdc';cx.shadowColor='#c9a961';cx.shadowBlur=14;cx.beginPath();cx.moveTo(9,0);cx.lineTo(-6,-5);cx.lineTo(-3,0);cx.lineTo(-6,5);cx.closePath();cx.fill();cx.restore()}
   raf=requestAnimationFrame(frame)};
  raf=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(raf);removeEventListener('resize',size)}},[ar]);
 const chips=ROUTES.map(r=>r.split('-').map(k=>hub(k)));
 const m=sim?.m??0;let i=0,acc=0;if(sim)for(;i<5&&m>=acc+sim.st[i];i++)acc+=sim.st[i];
 const left=sim?sim.tot-m:0,eta=sim?new Intl.DateTimeFormat(lang==='ar'?'ar-EG-u-nu-latn':'en-GB',{hour:'2-digit',minute:'2-digit',timeZone:sim.b.tz,hour12:false}).format(new Date(Date.now()+left*6e4)):'';
 const det=sim?c.d(nm(sim.a),nm(sim.b),sim,left)[i]:null,u3=sim?Math.min(1,Math.max(0,(m-acc)/sim.st[3])):0;
 return <div className="wh" dir={ar?'rtl':'ltr'}>
  <canvas ref={cv} aria-hidden="true"/>
  <header className="wh-top"><div className="wh-langs" role="group" aria-label="Language">{(['ar','en'] as const).map(l=><button key={l} type="button" className="wh-pill" aria-pressed={lang===l} lang={l} onClick={()=>setLang(l)}>{l==='ar'?'العربية':'English'}</button>)}</div><img src="/ijet-logo-light.png" alt="I JET" width="129" height="45"/></header>
  <div className={`wh-hero${sim?' off':''}`}><h1>{c.h}</h1><p>{c.sub}</p><form className="wh-say" onSubmit={submit}><input value={say} onChange={e=>{setSay(e.target.value);setMsg('')}} placeholder={c.ph} maxLength={120} autoComplete="off" aria-label={c.ph}/><button type="submit">{c.go} {ar?'←':'→'}</button></form><div className="wh-msg" aria-live="polite">{msg}</div></div>
  <aside className={`wh-panel${sim?' on':''}`} aria-live="off">{sim&&det&&<>
   <div className="wh-mono">{c.sim}</div><div className="wh-rt" dir="ltr">{sim.a.iata} → {sim.b.iata}</div>
   <div className="wh-grid"><div className="wh-kpi"><b>{Math.round(sim.km)}</b><span>{c.km}</span></div><div className="wh-kpi"><b>{fm(left,!ar)}</b><span>{c.left}</span></div><div className="wh-kpi"><b>{eta}</b><span>{c.eta}</span></div></div>
   <div className="wh-pb"><i style={{width:`${m/sim.tot*100}%`}}/></div>
   <ul className="wh-steps">{c.stg.map((s,k)=><li key={k} className={k<i?'d':k===i?'c':''}>{s}</li>)}</ul>
   <div className="wh-card"><h3>{c.stg[i]}</h3><p>{det[0]}</p><p>{det[1].split('|')[0]}<span className="wh-tag">{det[1].split('|')[1]}</span></p>
    {i===3&&<div className="wh-tele"><span>ALT {Math.round(41000*Math.sin(Math.PI*Math.min(1,u3*1.15)))} FT</span><span>GS {Math.round(760+u3*20)} KM/H</span><span>SIM</span></div>}</div>
   <div className="wh-ctl"><button type="button" onClick={()=>{pausedR.current=!pausedR.current;setPaused(pausedR.current)}}>{paused?'▶ '+c.play:'⏸ '+c.pause}</button><button type="button" onClick={()=>{if(simR.current){simR.current.m=0;pausedR.current=false;setPaused(false)}}}>↺ {c.again}</button><button type="button" onClick={stop}>✕ {c.close}</button><a className="go" href={`?view=cabin&from=${sim.a.iata}&to=${sim.b.iata}`}>{c.req}</a></div></>}</aside>
  <div className="wh-strip"><div className="wh-mono">{c.strip}</div><div className="wh-track">{[0,1].flatMap(d=>chips.map(([a,b])=>{const on=sim?.a.iata===a.iata&&sim.b.iata===b.iata;return <button key={d+a.iata+b.iata} type="button" className={`wh-chip${on?' on':''}`} aria-pressed={on} onClick={()=>on?stop():start(a,b)}><span><b>{a.iata} → {b.iata}</b><small>{nm(a)} · {nm(b)}</small></span><i className="wh-sw"/></button>}))}</div></div>
  <RafiqChat/>
 </div>;
}
