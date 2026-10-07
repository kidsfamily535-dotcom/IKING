import {useCallback,useEffect,useMemo,useState} from 'react';
import './eye/watch.css';
import {realApi,routeWeatherPublic,addWatchedTrip} from './data/supabaseApi';
import {sb} from './lib/supabase';
import {useI18n,airportName} from './i18n';
import LangSwitch from './LangSwitch';
import WRadar from './cabin/WRadar';
import {Switch,Toggle} from './cabin/Switch';
import type {Airport,MyTrip,RouteWx} from './data/types';
// «راقب رحلتك»: الباب العام للمنتج. العميل يكتب رحلته (حتى لو على طيران تجاري) ويرى العين تعمل له قبل أي عرض.
// ما هو حقيقي هنا: الطقس الرسمي (METAR) من دالة عامة للقراءة فقط (يراه الزائر قبل أي بريد)، والرحلة المحفوظة (customer_trips). المسافة والزمن تقدير محسوب من الإحداثيات وموسوم تقديرًا.
// ما ليس مفعّلًا: تنبيهات الإيميل التلقائية. الصفحة تقول ذلك صراحة ولا توحي بغيره، ولا تعرض خيارًا خاصًا لم يؤكده مشغّل.
const C={
 ar:{h:'اكتب رحلتك. العين تراقبها.',sub:'أي رحلة، حتى لو على طيران تجاري. بلا مقابل.',from:'من',to:'إلى',pick:'اختر مطارًا',when:'موعد الإقلاع (اختياري)',email:'بريدك الإلكتروني',
  consent:'أوافق أن تحتفظ العين برحلتي وبريدي لتراقبها لي، وأن يصلني رابط الدخول.',alerts:'أبلغني بالإيميل عندما تُفعَّل تنبيهات الطقس (اختياري).',start:'ابدأ المراقبة',starting:'لحظة',same:'اختر مطارين مختلفين.',needEmail:'اكتب بريدًا صحيحًا وأكّد الموافقة.',err:'تعذّر الحفظ. حاول مرة أخرى.',
  dist:'المسافة',time:'زمن الطيران الخاص',est:'تقدير',km:'كم',hm:(h:number,m:number)=>`${h} س ${m} د`,
  sentH:'أرسلتُ لك رابط الدخول.',sentB:(e:string)=>`افتح الرسالة على ${e} وستجد رحلتك محفوظة والعين تقرأ طقس المطارين.`,sentN:'الطقس يتجدد في القاعدة كل عشرين دقيقة تقريبًا.',see:'اعرض طقس رحلتي',keepH:'أبقِ العين على رحلتك',keepB:'أرسل لك رابط دخول فتبقى الرحلة محفوظة، وتجد الطقس محدَّثًا كلما فتحتها.',keepGo:'احفظ رحلتي وأرسل الرابط',change:'غيّر الرحلة',
  ok:'الطقس مناسب في الطرفين.',part:'عندي رصد حديث لمطار واحد فقط حتى الآن.',bad:(a:string)=>`الجو في ${a} يستحق انتباهك.`,none:'لا يوجد رصد حديث للمطارين الآن، وفريقنا سيتحقق.',
  dep:'الإقلاع',arr:'الوصول',altH:(a:string)=>`إن تعذّر الهبوط في ${a}`,altOk:(a:string,k:number)=>`أقرب مطار رصده سليم الآن هو ${a}، على بعد ${k} كم.`,altNone:'لا أجد الآن مطارًا قريبًا برصد حديث سليم، وسأتابع.',
  doH:'ما تفعله العين لرحلتك',do1:'تقرأ الرصد الرسمي لمطاري الرحلة وتحدّثه كل عشر دقائق ما دامت الصفحة مفتوحة.',do2:'تنبّهك هنا إذا ساء الجو، وتقترح مطارًا بديلًا قريبًا برصد سليم.',do3:'لا تراسلك بالبريد بعد. هذا غير مفعّل، وأقول لك ذلك بدل أن أوهمك.',
  privH:'وماذا عن الطيران الخاص؟',privB:'لا أعرض عليك خيارًا خاصًا إلا إذا أكّده مشغّل فعلًا. ولن أخترع واحدًا لأجذبك.',
  mine:'رحلاتك',remove:'احذف الرحلة',another:'راقب رحلة أخرى',nodate:'الموعد غير محدد',loading:'العين تقرأ الرصد',wxfail:'تعذّر جلب الطقس الآن.'},
 en:{h:'Write your trip. The Eye watches it.',sub:'Any flight, even a commercial one. Free.',from:'From',to:'To',pick:'Choose an airport',when:'Departure time (optional)',email:'Your email',
  consent:'I agree the Eye keeps my trip and email to watch it for me, and that I receive a sign-in link.',alerts:'Email me when weather alerts are switched on (optional).',start:'Start watching',starting:'One moment',same:'Choose two different airports.',needEmail:'Enter a valid email and confirm consent.',err:'Could not save. Please try again.',
  dist:'Distance',time:'Private flight time',est:'Estimate',km:'km',hm:(h:number,m:number)=>`${h} h ${m} min`,
  sentH:'I sent you a sign-in link.',sentB:(e:string)=>`Open the message at ${e}. Your trip will be saved and the Eye will be reading the weather at both airports.`,sentN:'Weather refreshes in the database about every twenty minutes.',see:'Show my trip weather',keepH:'Keep the Eye on your trip',keepB:'I send you a sign-in link so the trip stays saved and the weather is current whenever you open it.',keepGo:'Save my trip and send the link',change:'Change trip',
  ok:'Weather looks fine at both ends.',part:'I only have a recent report for one airport so far.',bad:(a:string)=>`Conditions at ${a} deserve your attention.`,none:'No recent report for either airport right now. Our team will check.',
  dep:'Departure',arr:'Arrival',altH:(a:string)=>`If landing at ${a} is not possible`,altOk:(a:string,k:number)=>`The nearest airport reporting good conditions now is ${a}, ${k} km away.`,altNone:'I cannot find a nearby airport with a recent, good report right now. I will keep looking.',
  doH:'What the Eye does for your trip',do1:'Reads the official report for both airports and refreshes it every ten minutes while this page is open.',do2:'Tells you here if conditions worsen, and suggests a nearby alternate with a good report.',do3:'Does not email you yet. That is not enabled, and I tell you so rather than imply it.',
  privH:'And private aviation?',privB:'I only show you a private option once an operator has actually confirmed it. I will not invent one to attract you.',
  mine:'Your trips',remove:'Remove trip',another:'Watch another trip',nodate:'Time not set',loading:'The Eye is reading the report',wxfail:'Could not fetch the weather now.'}
};
const km=(a:Airport,b:Airport)=>{const r=Math.PI/180,dl=(b.lon-a.lon)*r,p1=a.lat*r,p2=b.lat*r;return 6371*Math.acos(Math.min(1,Math.sin(p1)*Math.sin(p2)+Math.cos(p1)*Math.cos(p2)*Math.cos(dl)))};
const LOC={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'} as const;
const BAD=new Set(['MVFR','IFR','LIFR']);
type Alt={leg:'dep'|'arr';code:string;near?:{code:string;km:number}};
export default function Watch(){
 const {t,lang,dir}=useI18n();const c=lang==='ar'?C.ar:C.en,rtl=dir==='rtl';
 const [ap,setAp]=useState<Airport[]>([]),[authed,setAuthed]=useState<boolean|null>(null),[trips,setTrips]=useState<MyTrip[]>([]),[sel,setSel]=useState(0),[adding,setAdding]=useState(false);
 const [o,setO]=useState(''),[d,setD]=useState(''),[at,setAt]=useState(''),[em,setEm]=useState(''),[ok,setOk]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[al,setAl]=useState(false),[sent,setSent]=useState(''),[pv,setPv]=useState<{o:string;d:string;at:string|null}|null>(null);
 const [wx,setWx]=useState<RouteWx[]|null>(null),[wxErr,setWxErr]=useState(false),[alts,setAlts]=useState<Alt[]>([]);
 const nm=useCallback((a:Airport)=>airportName(a),[lang]);
 const name=(code:string)=>{const a=ap.find(x=>x.iata===code);return a?nm(a):code};
 const A=ap.find(x=>x.iata===o),B=ap.find(x=>x.iata===d);
 const loadTrips=useCallback(()=>realApi.listMyTrips().then(x=>{setTrips(x);setSel(0)}).catch(()=>setTrips([])),[]);
 useEffect(()=>{realApi.listAirports().then(setAp);
  sb.auth.getSession().then(({data:{session}})=>{setAuthed(!!session);if(session)loadTrips()})},[loadTrips]);
 const cur=authed&&!adding&&trips.length?trips[Math.min(sel,trips.length-1)]:undefined;
 const src=cur?{o:cur.origin,d:cur.destination}:pv&&!sent?{o:pv.o,d:pv.d}:null,key=src?src.o+'-'+src.d:'';
 // الطقس يتجدد في القاعدة كل 20 دقيقة تقريبًا، فنعيد القراءة كل 10 دقائق ما دامت الصفحة مفتوحة
 useEffect(()=>{setWx(null);setWxErr(false);setAlts([]);if(!src)return;let live=true;
  const go=()=>routeWeatherPublic(src.o,src.d).then(r=>{if(live){setWx(r);setWxErr(false)}}).catch(()=>{if(live)setWxErr(true)});
  go();const i=setInterval(go,600000);return()=>{live=false;clearInterval(i)}},[key]);
 // مطار بديل: فقط للطرف الذي رصده حدّي أو سيئ، ومن أقرب 3 مطارات رصدها سليم وحديث فعلًا. لا نخمّن.
 useEffect(()=>{if(!wx||!ap.length)return;let live=true;
  (async()=>{const out:Alt[]=[];
   for(const r of wx){if(r.status!=='CURRENT'||!r.cat||!BAD.has(r.cat))continue;
    const home=ap.find(x=>x.iata===r.code);if(!home)continue;
    const near=ap.filter(x=>x.iata!==r.code).map(x=>({x,k:km(home,x)})).filter(z=>z.k<=450).sort((p,q)=>p.k-q.k).slice(0,3);
    let found:Alt['near'];
    for(const z of near){try{const w=await routeWeatherPublic(z.x.iata,z.x.iata);if(w[0]?.status==='CURRENT'&&w[0].cat==='VFR'){found={code:z.x.iata,km:Math.round(z.k)};break}}catch{/* نكمل للتالي */}}
    out.push({leg:r.leg,code:r.code,near:found})}
   if(live)setAlts(out)})();return()=>{live=false}},[wx,ap]);
 const est=useMemo(()=>{if(!A||!B||A.iata===B.iata)return null;const k=km(A,B),m=Math.round(k/800*60+20);return{k:Math.round(k),h:Math.floor(m/60),m:m%60}},[A,B]);
 const iso=()=>at?new Date(at).toISOString():null;
 const start=async()=>{setErr('');if(!o||!d||o===d){setErr(c.same);return}
  if(!authed){setPv({o,d,at:iso()});return}
  setBusy(true);
  try{await addWatchedTrip(o,d,iso(),al);await loadTrips();setAdding(false);setO('');setD('');setAt('');setAl(false)}catch{setErr(c.err)}finally{setBusy(false)}};
 const keep=async()=>{setErr('');if(!pv)return;if(!em.includes('@')||!ok){setErr(c.needEmail);return}
  setBusy(true);
  try{try{localStorage.setItem('iking_want',JSON.stringify({o:pv.o,d:pv.d,at:pv.at,a:al}))}catch{/* التخزين غير متاح */}
   const r=await sb.auth.signInWithOtp({email:em.trim(),options:{emailRedirectTo:location.origin}});
   if(r.error)throw r.error;setSent(em.trim())}catch{setErr(c.err)}finally{setBusy(false)}};
 const del=async(id:string)=>{try{await realApi.removeMyTrip(id);await loadTrips()}catch{setErr(c.err)}};
 const when=(v:string|null)=>v?new Date(v).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'}):c.nodate;
 const curWx=wx?wx.filter(r=>r.status==='CURRENT'):[],badLeg=curWx.find(r=>r.cat&&BAD.has(r.cat));
 const warnCodes=curWx.filter(r=>r.cat&&BAD.has(r.cat)).map(r=>r.code);
 const pickAp=(i:string)=>{if(!o)setO(i);else if(i===o)setO('');else setD(i)};
 const head=!wx?c.loading:badLeg?c.bad(name(badLeg.code)):curWx.length===2?c.ok:curWx.length===1?c.part:c.none;
 const dirTxt=(v:string|null)=>v&&/^\d+$/.test(v)?v+'°':v;
 const leg=(r:RouteWx)=>{const live=r.status==='CURRENT';
  const det=live?[r.windKt!=null?t('wx.wind',{d:dirTxt(r.windDir)??'',k:r.windKt}):'',r.vis?t('wx.vis',{v:r.vis+' SM'}):'',r.ageMin!=null?t('wx.age',{n:r.ageMin}):''].filter(Boolean).join('، '):'';
  return <li key={r.leg}><span className="k">{r.leg==='dep'?c.dep:c.arr} <bdi>{name(r.code)}</bdi></span>
   <b className={live&&r.cat&&BAD.has(r.cat)?'w':''}>{live?t(r.cat?'wx.cat.'+r.cat:'wx.cat.none'):t('wx.unknown')}</b>{det&&<small>{det}</small>}</li>};
 const Wx=<>{wxErr&&<p className="er" role="alert">{c.wxfail}</p>}
   {wx&&<ul className="wxl">{wx.map(leg)}</ul>}
   {alts.map(a=><p className="alt" key={a.leg}><b>{c.altH(name(a.code))}</b><br/>{a.near?c.altOk(name(a.near.code),a.near.km):c.altNone}</p>)}
   {curWx.length>0&&<p className="dim sm">{t('wx.src')}</p>}</>;
 const form=<div className="form">
  <div className="pair">
   <label>{c.from}<select value={o} onChange={e=>setO(e.target.value)}><option value="">{c.pick}</option>{ap.map(a=><option key={a.iata} value={a.iata}>{nm(a)} · {a.iata}</option>)}</select></label>
   <label>{c.to}<select value={d} onChange={e=>setD(e.target.value)}><option value="">{c.pick}</option>{ap.map(a=><option key={a.iata} value={a.iata}>{nm(a)} · {a.iata}</option>)}</select></label></div>
  {est&&<p className="est"><span>{c.dist} <bdi>{est.k} {c.km}</bdi></span><span>{c.time} <bdi>{c.hm(est.h,est.m)}</bdi></span><em>{c.est}</em></p>}
  <label>{c.when}<input type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/></label>
  {authed&&<Toggle checked={al} onChange={setAl}>{c.alerts}</Toggle>}
  {err&&<p className="er" role="alert">{err}</p>}
  <Switch primary busy={busy} disabled={authed===null} label={busy?c.starting:authed?c.start:c.see} onActivate={start}/></div>;
 return <div className="wt" dir={dir} lang={lang}><div className="wrap">
  <header><span className="mark">{lang==='ar'?'عين الملك':'The King’s Eye'}</span><LangSwitch/></header>
  {sent?<main className="sent" aria-live="polite"><div className="wr"><WRadar ap={ap} a={ap.find(x=>x.iata===pv?.o)} b={ap.find(x=>x.iata===pv?.d)} nm={nm} warn={warnCodes}/></div><h1>{c.sentH}</h1><p className="lead">{c.sentB(sent)}</p><p className="dim">{c.sentN}</p></main>
  :cur?<main aria-live="polite"><div className="wr"><WRadar ap={ap} a={ap.find(x=>x.iata===cur.origin)} b={ap.find(x=>x.iata===cur.destination)} nm={nm} warn={warnCodes}/></div>
   <h1>{head}</h1><p className="dim">{when(cur.departureAt)}</p>
   {Wx}
   <section className="does"><h2>{c.doH}</h2><p>{c.do1}</p><p>{c.do2}</p><p>{c.do3}</p></section>
   <section className="does"><h2>{c.privH}</h2><p>{c.privB}</p></section>
   {trips.length>1&&<section className="does"><h2>{c.mine}</h2><div className="chips">{trips.map((x,i)=><button key={x.id} className={i===sel?'on':''} onClick={()=>setSel(i)}><bdi>{x.origin}</bdi> – <bdi>{x.destination}</bdi></button>)}</div></section>}
   <div className="row2"><Switch small label={c.another} onActivate={()=>setAdding(true)}/><Switch small label={c.remove} onActivate={()=>del(cur.id)}/></div></main>
  :pv?<main aria-live="polite"><div className="wr"><WRadar ap={ap} a={ap.find(x=>x.iata===pv.o)} b={ap.find(x=>x.iata===pv.d)} nm={nm} warn={warnCodes}/></div>
   <h1>{head}</h1><p className="dim">{when(pv.at)}</p>{Wx}
   <section className="keep"><h2>{c.keepH}</h2><p className="dim">{c.keepB}</p>
    <div className="form"><label>{c.email}<input type="email" autoComplete="email" inputMode="email" value={em} onChange={e=>setEm(e.target.value)}/></label>
     <Toggle checked={ok} onChange={setOk}>{c.consent}</Toggle>
     <Toggle checked={al} onChange={setAl}>{c.alerts}</Toggle>
     {err&&<p className="er" role="alert">{err}</p>}
     <Switch primary busy={busy} label={busy?c.starting:c.keepGo} onActivate={keep}/></div></section>
   <section className="does"><h2>{c.doH}</h2><p>{c.do1}</p><p>{c.do2}</p><p>{c.do3}</p></section>
   <div className="row2"><Switch small label={c.change} onActivate={()=>{setPv(null);setErr('')}}/></div></main>
  :<main><div className="wr"><WRadar ap={ap} a={A} b={B} nm={nm} warn={warnCodes}onPick={pickAp}/></div><h1>{c.h}</h1><p className="lead">{c.sub}</p>{form}</main>}
 </div></div>;
}
