import {useEffect,useMemo,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
import './operator.css';
// شاشة المشغّل: صفحة مستقلة تمامًا عن العميل والوسيط. تفتح من رابط بالبريد (?view=operator#t=الرمز) بلا حساب.
// الرمز في الجزء بعد # فلا يصل إلى أي خادم ولا يظهر في سجلات الوصول. المشغّل يرى تفاصيل الرحلة التشغيلية فقط.
// لا هوية عميل، لا نص الطلب الخام، لا أسعار داخلية ولا عروض منافسين: الدالة في القاعدة لا ترجعها أصلًا.
type Trip={origin_code:string;origin_ar:string|null;origin_en:string|null;destination_code:string;destination_ar:string|null;destination_en:string|null;travel_date:string|null;departure_period:string|null;passengers:number|null;baggage_note:string|null;return_requested:boolean|null};
type Offer={aircraft_type:string;price:number;currency:string;includes_fees:boolean;valid_until:string;flight_minutes:number|null;restrictions:string|null};
type View={state:'OPEN';operator_name:string;expires_at:string;trip:Trip}|{state:'ANSWERED';answer:'OFFER'|'DECLINED';operator_name:string;answered_at:string;offer:Offer|null}|{state:'INVALID'|'EXPIRED'|'CLOSED'};
type L='ar'|'en';
const T:Record<L,Record<string,string>>={
ar:{brand:'THE KING\'S EYE',desk:'مكتب المشغّل',load:'جارٍ فتح الطلب…',neterr:'تعذّر الاتصال. تحقّق من الشبكة ثم أعد المحاولة.',retry:'إعادة المحاولة',
 INVALID:'هذا الرابط غير صالح',INVALID_s:'تأكد أنك فتحت الرابط كاملًا كما وصلك. إن استمرت المشكلة فاطلب رابطًا جديدًا من فريقنا.',
 EXPIRED:'انتهت صلاحية الرابط',EXPIRED_s:'اطلب من فريقنا رابطًا جديدًا إن كان الطلب لا يزال مهمًا لك.',
 CLOSED:'أُغلق هذا الطلب',CLOSED_s:'لم يعد الطلب مفتوحًا، ولا يلزمك أي إجراء. شكرًا لوقتك.',
 hello:'طلب عرض لرحلة',to:'إلى',date:'التاريخ',period:'فترة المغادرة',pax:'عدد الركاب',bag:'الأمتعة',ret:'العودة',
 morning:'صباحًا',noon:'ظهرًا',evening:'مساءً',night:'ليلًا',unspec:'لم تُحدَّد',yes:'مطلوبة',no:'ذهاب فقط',
 priv:'لا تُشارَك معك هوية الراكب. هذه تفاصيل الرحلة المطلوبة للرد فقط.',
 q:'هل تستطيعون تنفيذ هذه الرحلة؟',av:'نعم، متاح وسأقدّم عرضًا',avs:'عرض بسعر إجمالي واحد',un:'غير متاح',uns:'اعتذار بلا التزام',
 type:'نوع الطائرة',price:'السعر الإجمالي',cur:'العملة',fees:'هل يشمل السعر كل الرسوم؟',feesH:'الهبوط والمناولة والتصاريح والوقود وأي رسوم أخرى',feesY:'نعم، شامل',feesN:'لا، لا يشمل بعضها',
 valid:'مدة صلاحية العرض',h:'ساعة',flt:'زمن الطيران التقديري (دقيقة)',fltH:'اختياري',restr:'شروط أو قيود',restrH:'اختياري: مثل موعد تأكيد التصريح أو قيود المطار',
 reason:'سبب الاعتذار',reasonH:'اختياري',review:'مراجعة قبل الإرسال',send:'إرسال الرد',sending:'جارٍ الإرسال…',back:'تعديل',
 final:'بعد الإرسال لا يمكن تعديل الرد من هنا. هذا السعر هو التزامك الإجمالي خلال مدة الصلاحية.',
 e_type:'اكتب نوع الطائرة',e_price:'أدخل سعرًا إجماليًا صحيحًا',e_fees:'حدّد هل السعر يشمل كل الرسوم',e_flt:'زمن الطيران بين 10 و1200 دقيقة',e_pick:'اختر: متاح أو غير متاح',
 failed:'تعذّر إرسال الرد. لم يُحفظ شيء، يمكنك المحاولة مرة أخرى.',
 sent:'وصل ردّك',sentO:'استلمنا عرضك. يراجعه فريقنا قبل أن يُبنى عليه أي شيء، وسنتواصل معك إن احتجنا إلى تأكيد.',sentD:'سجّلنا اعتذارك. شكرًا على سرعة ردك.',
 yours:'ما سجّلناه',valUntil:'صالح حتى',incl:'شامل الرسوم',excl:'لا يشمل بعض الرسوم',min:'د',expires:'ينتهي الرابط'},
en:{brand:'THE KING\'S EYE',desk:'Operator desk',load:'Opening the request…',neterr:'Could not connect. Check your network and try again.',retry:'Try again',
 INVALID:'This link is not valid',INVALID_s:'Make sure you opened the full link as it was sent. If it still fails, ask our team for a new one.',
 EXPIRED:'This link has expired',EXPIRED_s:'Ask our team for a new link if the request still matters to you.',
 CLOSED:'This request is closed',CLOSED_s:'The request is no longer open and nothing is needed from you. Thank you for your time.',
 hello:'Quote request',to:'to',date:'Date',period:'Departure window',pax:'Passengers',bag:'Baggage',ret:'Return',
 morning:'Morning',noon:'Midday',evening:'Evening',night:'Night',unspec:'Not specified',yes:'Requested',no:'One way',
 priv:'The passenger\'s identity is not shared with you. These are only the trip details needed to reply.',
 q:'Can you operate this trip?',av:'Yes, available — I\'ll quote',avs:'One all-in price',un:'Not available',uns:'Decline, no commitment',
 type:'Aircraft type',price:'All-in price',cur:'Currency',fees:'Does the price include all fees?',feesH:'Landing, handling, permits, fuel and any other charges',feesY:'Yes, all-inclusive',feesN:'No, some are excluded',
 valid:'Offer validity',h:'h',flt:'Estimated flight time (min)',fltH:'Optional',restr:'Conditions or restrictions',restrH:'Optional: e.g. permit confirmation time, airport limits',
 reason:'Reason for declining',reasonH:'Optional',review:'Review before sending',send:'Send reply',sending:'Sending…',back:'Edit',
 final:'Once sent, the reply cannot be edited from here. This price is your all-in commitment for the validity period.',
 e_type:'Enter the aircraft type',e_price:'Enter a valid all-in price',e_fees:'State whether the price includes all fees',e_flt:'Flight time must be 10 to 1200 minutes',e_pick:'Choose: available or not available',
 failed:'Could not send your reply. Nothing was saved; you can try again.',
 sent:'Your reply was received',sentO:'We received your offer. Our team reviews it before anything is built on it, and we will contact you if we need confirmation.',sentD:'We recorded your decline. Thank you for the quick answer.',
 yours:'What we recorded',valUntil:'Valid until',incl:'All fees included',excl:'Some fees excluded',min:'min',expires:'Link expires'}};
const MODELS=['Citation XLS+','Praetor 600','Challenger 350','Global 6000','Legacy 650'];
const readToken=()=>{try{return new URLSearchParams(location.hash.replace(/^#/,'')).get('t')??''}catch{return''}};
export default function OperatorLink(){
 const {lang,setLang}=useI18n();const l:L=lang==='ar'?'ar':'en';const t=T[l];
 const token=useMemo(readToken,[]);
 const [v,setV]=useState<View|null>(null),[neterr,setNeterr]=useState(false);
 const [av,setAv]=useState<boolean|null>(null),[type,setType]=useState(''),[price,setPrice]=useState(''),[cur,setCur]=useState('USD'),[fees,setFees]=useState<boolean|null>(null),[hrs,setHrs]=useState('24'),[mins,setMins]=useState(''),[restr,setRestr]=useState(''),[why,setWhy]=useState('');
 const [step,setStep]=useState<'form'|'review'|'sent'>('form'),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[sentAs,setSentAs]=useState<'OFFER'|'DECLINED'|null>(null);
 useEffect(()=>{document.title=`${t.desk} · THE KING'S EYE`;
  for(const [n,c] of [['robots','noindex,nofollow'],['referrer','no-referrer']]){let m=document.querySelector(`meta[name=${n}]`);if(!m){m=document.createElement('meta');m.setAttribute('name',n);document.head.appendChild(m)}m.setAttribute('content',c)}},[t.desk]);
 const load=async()=>{setNeterr(false);setV(null);
  if(!/^[0-9a-f]{64}$/.test(token)){setV({state:'INVALID'});return}
  const {data,error}=await sb.rpc('operator_link_view',{p_token:token});
  if(error||!data){setNeterr(true);return}setV(data as View)};
 useEffect(()=>{load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const nf=useMemo(()=>new Intl.NumberFormat(l==='ar'?'ar-u-nu-latn':'en-US'),[l]);
 const dt=(d:string|null)=>d?new Date(d+'T00:00:00').toLocaleDateString(l==='ar'?'ar-u-nu-latn':'en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):t.unspec;
 const dtm=(s:string)=>new Date(s).toLocaleString(l==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const check=():string=>{
  if(av===null)return t.e_pick;if(av===false)return'';
  if(type.trim().length<2)return t.e_type;
  const p=Number(price);if(!price||!isFinite(p)||p<=0)return t.e_price;
  if(fees===null)return t.e_fees;
  if(mins&&(!/^\d+$/.test(mins)||+mins<10||+mins>1200))return t.e_flt;return''};
 const toReview=()=>{const e=check();setErr(e);if(!e)setStep('review')};
 const send=async()=>{setBusy(true);setErr('');
  const {error}=await sb.rpc('operator_link_reply',{p_token:token,p_available:av,p_aircraft_type:av?type.trim():null,p_price:av?Number(price):null,p_currency:av?cur:null,p_includes_fees:av?fees:null,
   p_valid_hours:av?Number(hrs):null,p_flight_minutes:av&&mins?Number(mins):null,p_restrictions:av&&restr.trim()?restr.trim():null,p_reason:av===false&&why.trim()?why.trim():null});
  setBusy(false);
  if(error){const m=error.message??'';if(m.includes('expired')){setV({state:'EXPIRED'});return}if(m.includes('already has a reply')){load();return}setErr(t.failed);return}
  setSentAs(av?'OFFER':'DECLINED');setStep('sent')};
 const Shell=({children}:{children:React.ReactNode})=><div className="ol" lang={l} dir={l==='ar'?'rtl':'ltr'}>
  <header><span className="ol-brand"><i aria-hidden/>{t.brand}<small>{t.desk}</small></span>
   <div className="ol-l" role="group" aria-label="Language"><button className={l==='ar'?'on':''} onClick={()=>setLang('ar')} aria-pressed={l==='ar'}>عربي</button><button className={l==='en'?'on':''} onClick={()=>setLang('en')} aria-pressed={l==='en'}>EN</button></div></header>
  <main>{children}</main></div>;
 if(neterr)return <Shell><div className="ol-msg" role="alert"><p>{t.neterr}</p><button onClick={load}>{t.retry}</button></div></Shell>;
 if(!v)return <Shell><p className="ol-load" role="status">{t.load}</p></Shell>;
 if(v.state==='INVALID'||v.state==='EXPIRED'||v.state==='CLOSED')return <Shell><div className="ol-msg"><h1>{t[v.state]}</h1><p>{t[v.state+'_s']}</p></div></Shell>;
 if(v.state==='ANSWERED'||step==='sent'){
  const o=v.state==='ANSWERED'?v.offer:null,kind=v.state==='ANSWERED'?v.answer:sentAs;
  const x:Offer=o??{aircraft_type:type.trim(),price:Number(price),currency:cur,includes_fees:!!fees,valid_until:'',flight_minutes:mins?Number(mins):null,restrictions:restr.trim()||null};
  return <Shell><div className="ol-msg"><h1>{t.sent}</h1><p>{kind==='OFFER'?t.sentO:t.sentD}</p>
   {kind==='OFFER'&&<dl className="ol-sum"><dt>{t.yours}</dt><dd/><dt>{t.type}</dt><dd>{x.aircraft_type}</dd><dt>{t.price}</dt><dd dir="ltr">{nf.format(x.price)} {x.currency}</dd><dt>{t.fees}</dt><dd>{x.includes_fees?t.incl:t.excl}</dd>{x.valid_until&&<><dt>{t.valUntil}</dt><dd>{dtm(x.valid_until)}</dd></>}{x.restrictions&&<><dt>{t.restr}</dt><dd>{x.restrictions}</dd></>}</dl>}</div></Shell>}
 if(v.state!=='OPEN')return null;
 const tr=v.trip,nm=(c:string,ar:string|null,en:string|null)=>l==='ar'?(ar??en??c):(en??ar??c);
 const per=tr.departure_period?t[tr.departure_period]??tr.departure_period:t.unspec;
 return <Shell>
  <section className="ol-slip" aria-label={t.hello}>
   <p className="ol-k">{t.hello}</p>
   <h1 className="ol-route"><span dir="ltr">{tr.origin_code}</span><i aria-hidden>{l==='ar'?'←':'→'}</i><span dir="ltr">{tr.destination_code}</span></h1>
   <p className="ol-names"><bdi>{nm(tr.origin_code,tr.origin_ar,tr.origin_en)}</bdi> {t.to} <bdi>{nm(tr.destination_code,tr.destination_ar,tr.destination_en)}</bdi></p>
   <dl className="ol-led"><dt>{t.date}</dt><dd>{dt(tr.travel_date)}</dd><dt>{t.period}</dt><dd>{per}</dd><dt>{t.pax}</dt><dd>{tr.passengers==null?t.unspec:<bdi>{tr.passengers}</bdi>}</dd><dt>{t.bag}</dt><dd><bdi>{tr.baggage_note||t.unspec}</bdi></dd><dt>{t.ret}</dt><dd>{tr.return_requested==null?t.unspec:tr.return_requested?t.yes:t.no}</dd></dl>
   <p className="ol-priv">{t.priv}</p>
  </section>
  {step==='form'&&<section className="ol-ans">
   <h2>{t.q}</h2>
   <div className="ol-pick" role="radiogroup" aria-label={t.q}>
    <button role="radio" aria-checked={av===true} className={av===true?'on':''} onClick={()=>{setAv(true);setErr('')}}><b>{t.av}</b><small>{t.avs}</small></button>
    <button role="radio" aria-checked={av===false} className={av===false?'on':''} onClick={()=>{setAv(false);setErr('')}}><b>{t.un}</b><small>{t.uns}</small></button></div>
   {av===true&&<div className="ol-form">
    <label>{t.type}<input list="ol-models" value={type} onChange={e=>setType(e.target.value)} maxLength={80} autoComplete="off"/><datalist id="ol-models">{MODELS.map(m=><option key={m} value={m}/>)}</datalist></label>
    <div className="ol-two"><label>{t.price}<input inputMode="decimal" dir="ltr" value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9.]/g,''))}/></label>
     <label>{t.cur}<select value={cur} onChange={e=>setCur(e.target.value)}><option>USD</option><option>SAR</option><option>AED</option></select></label></div>
    <fieldset><legend>{t.fees}</legend><p className="ol-h">{t.feesH}</p><div className="ol-yn"><button type="button" role="radio" aria-checked={fees===true} className={fees===true?'on':''} onClick={()=>setFees(true)}>{t.feesY}</button><button type="button" role="radio" aria-checked={fees===false} className={fees===false?'on':''} onClick={()=>setFees(false)}>{t.feesN}</button></div></fieldset>
    <div className="ol-two"><label>{t.valid}<select value={hrs} onChange={e=>setHrs(e.target.value)}>{[2,6,12,24,48,72].map(h=><option key={h} value={h}>{h} {t.h}</option>)}</select></label>
     <label>{t.flt}<input inputMode="numeric" dir="ltr" value={mins} onChange={e=>setMins(e.target.value.replace(/\D/g,''))} placeholder={t.fltH}/></label></div>
    <label>{t.restr}<textarea rows={3} maxLength={500} value={restr} onChange={e=>setRestr(e.target.value)} placeholder={t.restrH}/></label></div>}
   {av===false&&<div className="ol-form"><label>{t.reason}<textarea rows={2} maxLength={300} value={why} onChange={e=>setWhy(e.target.value)} placeholder={t.reasonH}/></label></div>}
   {err&&<p className="ol-err" role="alert">{err}</p>}
   {av!==null&&<button className="ol-go" onClick={av?toReview:()=>{setErr('');setStep('review')}}>{t.review}</button>}
  </section>}
  {step==='review'&&<section className="ol-ans">
   <h2>{t.review}</h2>
   <dl className="ol-sum">{av?<><dt>{t.type}</dt><dd>{type.trim()}</dd><dt>{t.price}</dt><dd dir="ltr">{nf.format(Number(price))} {cur}</dd><dt>{t.fees}</dt><dd>{fees?t.incl:t.excl}</dd><dt>{t.valid}</dt><dd>{hrs} {t.h}</dd>{mins&&<><dt>{t.flt}</dt><dd>{mins} {t.min}</dd></>}{restr.trim()&&<><dt>{t.restr}</dt><dd>{restr.trim()}</dd></>}</>:<><dt>{t.un}</dt><dd>{why.trim()||'—'}</dd></>}</dl>
   <p className="ol-final">{av?t.final:t.uns}</p>
   {err&&<p className="ol-err" role="alert">{err}</p>}
   <div className="ol-row"><button className="ol-go" disabled={busy} onClick={send}>{busy?t.sending:t.send}</button><button className="ol-ghost" disabled={busy} onClick={()=>setStep('form')}>{t.back}</button></div>
   <p className="ol-exp">{t.expires}: {dtm(v.expires_at)}</p>
  </section>}
 </Shell>;
}
