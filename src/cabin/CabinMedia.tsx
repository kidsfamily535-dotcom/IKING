import {useState} from 'react';
import {useMedia} from './media';
import type {Copy} from './copy';
const MAXLEN=16; // م. مقياس موحّد كي تظهر فروق الحجم بين الفئات
// صورة الفئة. إن لم توجد صورة أو فشل التحميل، لا يظهر شيء ويبقى البطاقة كما كانت.
export function Thumb({cat,c}:{cat:string;c:Copy}){
 const m=useMedia(cat),[bad,setBad]=useState(false);
 if(!m?.img||bad)return null;
 return <span className="cb-ph" aria-hidden><img src={m.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setBad(true)}/><i>{c.media.rep(m.name)}</i></span>;
}
// مخطط الكابينة بمقياس رسم حقيقي من الطول والعرض. لا مقاعد مرسومة لأن التوزيع الفعلي عند المشغّل.
function Plan({len,wid}:{len:number;wid:number}){
 const W=300,x0=8,L=(len/MAXLEN)*(W-x0*2),H=Math.max(18,(wid/MAXLEN)*(W-x0*2)*2.2),y=34-H/2,r=Math.min(H/2,14);
 return <svg className="cb-plan" viewBox="0 0 300 64" aria-hidden><path d={`M${x0+r} ${y}H${x0+L}V${y+H}H${x0+r}Q${x0} ${y+H} ${x0} ${y+H/2}Q${x0} ${y} ${x0+r} ${y}Z`}/>
  <path className="tk" d={`M${x0} 58V62M${x0+L} 58V62M${x0} 60H${x0+L}`}/></svg>;
}
export function Spec({cat,guests,c,L}:{cat:string;guests:number;c:Copy;L:string}){
 const m=useMedia(cat),[bad,setBad]=useState(false);
 if(!m)return null;
 const f=(v:number|null,u:string)=>v==null?null:`${v.toLocaleString(L==='ar'?'ar-u-nu-latn':L,{maximumFractionDigits:2})} ${u}`;
 const rows:[string,string|null][]=[[c.media.len,f(m.len,c.media.m)],[c.media.wid,f(m.wid,c.media.m)],[c.media.hei,f(m.hei,c.media.m)],[c.media.bag,f(m.bag,c.media.m3)],[c.media.rng,m.rangeKm?f(m.rangeKm,c.units.km):null],[c.media.pax,m.pax?String(m.pax):null]];
 const fits=m.pax!=null&&m.pax>=guests;
 return <figure className="cb-media">
  {m.img&&!bad&&<div className="cb-shot"><img src={m.img} alt={m.name} decoding="async" referrerPolicy="no-referrer" onError={()=>setBad(true)}/><figcaption>{c.media.rep(m.name)}</figcaption></div>}
  {m.len!=null&&m.wid!=null&&<Plan len={m.len} wid={m.wid}/>}
  <dl className="cb-dims">{rows.filter(r=>r[1]).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  {m.pax!=null&&<p className={`cb-fit${fits?' ok':''}`}>{c.media.fit(guests,m.pax,fits)}</p>}
  <p className="cb-medianote">{c.media.note}</p></figure>;
}
