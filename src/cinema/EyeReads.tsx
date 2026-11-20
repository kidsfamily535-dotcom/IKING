import {useEffect,useState} from 'react';
import {routeWeatherPublic} from '../data/supabaseApi';
import type {RouteWx} from '../data/types';
import {CertBadge} from './EyeFollowCard';
import type {Hub} from '../cabin/geo';
// «العين قرأت رحلتك»: ما يمكن معرفته فعلًا فور اختيار المسار. المسافة والزمن والفرق الزمني وفئات الطائرات المناسبة تقديرات محسوبة، والطقس رصد رسمي حيّ أو يُكتب «غير معروف حاليًا». لا توفر ولا سعر هنا أبدًا.
const T:Record<string,Record<string,string>>={
 ar:{h:'العين قرأت رحلتك',dist:'المسافة',time:'زمن الطيران',tz:'فرق التوقيت',fit:'فئات تناسب ركّابك',none:'لا فئة مرجعية تناسب هذه المواصفات، سيبحث الفريق بنفسه.',same:'نفس التوقيت',ahead:'الوجهة أسبق بـ',behind:'الوجهة أبطأ بـ',wx:'الطقس',dep:'المغادرة',arr:'الوصول',unk:'غير معروف حاليًا وسيتحقق منه فريقنا',src:'رصد رسمي وقت الرصد المذكور. القرار النهائي للمشغّل والطاقم.',ago:'قبل {n} د',VFR:'رؤية جيدة',MVFR:'رؤية حدّية',IFR:'رؤية منخفضة',LIFR:'رؤية منخفضة جدًا',kt:'عقدة',hr:'س'},
 en:{h:'The Eye read your trip',dist:'Distance',time:'Flight time',tz:'Time difference',fit:'Categories that fit your group',none:'No reference category fits these requirements; the team will search by hand.',same:'Same time zone',ahead:'Destination is ahead by',behind:'Destination is behind by',wx:'Weather',dep:'Departure',arr:'Arrival',unk:'Currently unknown; our team will check it',src:'Official observation at the time shown. The operator and crew make the final call.',ago:'{n} min ago',VFR:'Good visibility',MVFR:'Marginal visibility',IFR:'Low visibility',LIFR:'Very low visibility',kt:'kt',hr:'h'}};
const off=(tz:string,d:Date)=>{try{const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,timeZoneName:'longOffset'}).formatToParts(d).find(x=>x.type==='timeZoneName')?.value||'GMT';const m=/GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(p);return m?(m[1]==='-'?-1:1)*(+m[2]+(+(m[3]||0))/60):0}catch{return 0}};
export default function EyeReads({lang,from,to,km,dur,date,fit}:{lang:string;from:Hub;to:Hub;km:number;dur:string;date:string;fit:string[]}){
 const c={...T.en,...(T[lang]||{})},ar=lang==='ar';
 const [wx,setWx]=useState<RouteWx[]|null>(null);
 useEffect(()=>{let live=true;setWx(null);routeWeatherPublic(from.iata,to.iata).then(r=>{if(live)setWx(r)}).catch(()=>{if(live)setWx([])});return()=>{live=false}},[from.iata,to.iata]);
 const d=new Date(date+'T12:00:00'),diff=off(to.tz,d)-off(from.tz,d),ad=Math.abs(diff);
 const tzTxt=ad<.01?c.same:`${diff>0?c.ahead:c.behind} ${ad%1?ad.toFixed(1):ad} ${c.hr}`;
 const cell=(leg:'dep'|'arr',h:Hub)=>{const w=wx?.find(x=>x.leg===leg);const ok=w&&w.status==='CURRENT';
  return <div className="er-wx" key={leg}><small>{c[leg]} · <bdi dir="ltr">{h.iata}</bdi></small>
   {wx===null?<span className="er-mute">…</span>:ok?<span>{c[w!.cat||'']||''}{w!.windKt!=null&&<> · <bdi dir="ltr">{w!.windKt} {c.kt}</bdi></>}{w!.tempC!=null&&<> · <bdi dir="ltr">{Math.round(Number(w!.tempC))}°</bdi></>}<em className="er-mute"> · {c.ago.replace('{n}',String(w!.ageMin??''))}</em></span>:<span className="er-mute">{c.unk}</span>}</div>};
 const anyLive=!!wx?.some(x=>x.status==='CURRENT');
 return <section className="er" aria-label={c.h}>
  <header><span className="er-eye" aria-hidden="true"/><b>{c.h}</b><CertBadge kind="est" lang={lang}/></header>
  <dl><div><dt>{c.dist}</dt><dd><bdi dir="ltr">{(Math.round(km/10)*10).toLocaleString('en')}</bdi> {ar?'كم':'km'}</dd></div><div><dt>{c.time}</dt><dd>{dur}</dd></div><div><dt>{c.tz}</dt><dd>{tzTxt}</dd></div></dl>
  <p className="er-fit"><span>{c.fit}</span> {fit.length?fit.join(ar?'، ':', '):c.none}</p>
  <div className="er-wxh"><span>{c.wx}</span></div>
  <div className="er-wxg">{cell('dep',from)}{cell('arr',to)}</div>
  {anyLive&&<p className="er-src">{c.src}</p>}
 </section>;
}
