import {useEffect,useState} from 'react';
import {useI18n} from '../i18n';
import {copy} from './copy';
import {HUBS,hub,dist,flightMin,rangeFor} from './geo';
import Radar from './Radar';
// رادار الصفحة الرئيسية: يعرض العين وهي تعمل (وجهات تتبدّل وطائرة تمشي على المسار)، ولمس أي مدينة يدخلك الكابينة بها.
const DEST=['JED','DXB','LON','CAI','IST','DOH','CDG'];
const km10=(n:number)=>(Math.round(n/10)*10).toLocaleString('en');
export default function HomeRadar({onGo}:{onGo:(iata:string)=>void}){
 const {lang}=useI18n(),c=copy(lang),L=lang;
 const [i,setI]=useState(0),[hover,setHover]=useState<string|null>(null),[p,setP]=useState(0);
 const to=hover&&hover!=='RUH'?hover:DEST[i%DEST.length];
 const F=hub('RUH'),D=hub(to),km=dist(F,D);
 // دورة العرض: الطائرة تمشي ثم تتبدّل الوجهة. تتوقف عند اللمس أو تمرير الإصبع.
 useEffect(()=>{setP(0);if(hover)return;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){setP(1);return}
  const t0=performance.now();let raf=0;
  const tick=(n:number)=>{const k=Math.min(1,(n-t0)/5200);setP(k);if(k<1)raf=requestAnimationFrame(tick);else setTimeout(()=>setI(x=>x+1),900)};
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[i,hover,to]);
 const nm=(h:{ar:string;en:string})=>L==='ar'?h.ar:h.en;
 const m=flightMin(km),dur=m<60?`${m} ${c.units.m}`:`${Math.floor(m/60)} ${c.units.h} ${String(m%60).padStart(2,'0')} ${c.units.m}`;
 return <Radar hubs={HUBS} from="RUH" to={to} hover={hover} name={nm} range={rangeFor(km)} blips={[]} scanning={false} plane={p} alt={null}
  hud={`${c.ask.read(nm(F),nm(D),km10(km),dur)}`} aria={c.gl.radar} kmUnit={c.units.km} onHover={setHover} onPick={id=>id!=='RUH'&&onGo(id)} onBlip={()=>{}}/>;
}
