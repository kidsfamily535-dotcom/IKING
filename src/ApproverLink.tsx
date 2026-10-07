import {useEffect,useMemo,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
import {Switch} from './cabin/Switch';
import './operator.css';
import './profile.css';

// صفحة صاحب القرار: تفتح من رابط آمن (?view=approve#t=الرمز) بلا حساب. الرمز بعد # فلا يصل لأي خادم ولا يظهر في سجلات الوصول.
// يرى ملخصًا من ثلاثة أسطر وزرّ «أوافق». الموافقة تسجّل نية حجز فقط (لا حجز تلقائي)، والتأكيد النهائي بعد مراجعة الوسيط والمشغّل.
// الرابط مربوط بعرض واحد، لقرار واحد، وينتهي بسرعة. لو تغيّر السعر أو الصلاحية بعد إصداره تتوقف الموافقة (CHANGED).
// الرفض يقفل الرابط فقط ويبقى العرض مفتوحًا للسكرتير. كل ذلك يتحقق منه الخادم في approver_link_view / approver_link_decide.
type Sum={origin_code:string;origin_ar:string|null;origin_en:string|null;destination_code:string;destination_ar:string|null;destination_en:string|null;travel_date:string|null;
 departure_period:string|null;passengers:number|null;cabin_label:string|null;price:number;currency:string;fees_included:boolean|null;fees_note:string|null;valid_until:string;prepared_by:string|null};
type View={state:'OPEN';approver_name:string|null;expires_at:string;summary:Sum}|{state:'ANSWERED';answer:'APPROVED'|'DECLINED';approver_name:string|null}|{state:'INVALID'|'EXPIRED'|'REVOKED'|'CLOSED'|'CHANGED'};
type L='ar'|'en';
const T:Record<L,Record<string,string>>={
ar:{brand:'THE KING\'S EYE',desk:'موافقة رحلة',load:'جارٍ فتح العرض…',neterr:'تعذّر الاتصال. تحقّق من الشبكة ثم أعد المحاولة.',retry:'إعادة المحاولة',
 INVALID:'هذا الرابط غير صالح',INVALID_s:'تأكد أنك فتحت الرابط كاملًا كما وصلك، أو اطلب رابطًا جديدًا ممن جهّز الرحلة.',
 EXPIRED:'انتهت صلاحية الرابط',EXPIRED_s:'اطلب رابطًا جديدًا ممن جهّز الرحلة إن كان العرض لا يزال يهمك.',
 REVOKED:'أُلغي هذا الرابط',REVOKED_s:'أصدر من جهّز الرحلة رابطًا أحدث. اطلب منه الرابط الجديد.',
 CLOSED:'لم يعد العرض متاحًا',CLOSED_s:'العرض أُغلق أو انتهت مدته، ولا يلزمك أي إجراء.',
 CHANGED:'العرض تغيّر',CHANGED_s:'تغيّر السعر أو مدة الصلاحية بعد إصدار هذا الرابط، فتوقفت الموافقة حمايةً لك. اطلب رابطًا جديدًا.',
 hello:'جهّز لك {by} رحلة تنتظر قرارك',helloN:'{n}، جهّز لك {by} رحلة تنتظر قرارك',helloNoBy:'رحلة تنتظر قرارك',to:'إلى',date:'التاريخ',period:'الوقت',pax:'الركاب',cabin:'الطائرة',price:'السعر',valid:'العرض صالح حتى',unspec:'لم يُحدَّد',
 morning:'صباحًا',noon:'ظهرًا',evening:'مساءً',night:'ليلًا',incl:'شامل الرسوم',excl:'لا يشمل بعض الرسوم',
 intent:'الموافقة تسجّل نية حجز فقط، وليست حجزًا مؤكدًا. نراجع التفاصيل مع المشغّل قبل أي التزام.',
 yes:'أوافق',yesS:'نية حجز، بلا التزام نهائي',no:'لا يناسبني',noS:'يبقى العرض مفتوحًا لمن جهّزه',note:'ملاحظة (اختياري)',failed:'تعذّر تسجيل قرارك. لم يُحفظ شيء، حاول مرة أخرى.',
 okY:'سجّلنا موافقتك',okYs:'هذه نية حجز وليست حجزًا مؤكدًا حتى نؤكد التفاصيل مع المشغّل.',okN:'سجّلنا قرارك',okNs:'سنبلغ من جهّز الرحلة. شكرًا لوقتك.',
 doneY:'سبق أن وافقت على هذا العرض',doneN:'سبق أن سجّلت قرارك بشأن هذا العرض',expires:'ينتهي الرابط'},
en:{brand:'THE KING\'S EYE',desk:'Trip approval',load:'Opening the offer…',neterr:'Could not connect. Check your network and try again.',retry:'Try again',
 INVALID:'This link is not valid',INVALID_s:'Make sure you opened the full link as it was sent, or ask the person who prepared the trip for a new one.',
 EXPIRED:'This link has expired',EXPIRED_s:'Ask the person who prepared the trip for a new link if the offer still matters to you.',
 REVOKED:'This link was cancelled',REVOKED_s:'A newer link was issued. Ask the person who prepared the trip for it.',
 CLOSED:'The offer is no longer available',CLOSED_s:'The offer was closed or has run out, and nothing is needed from you.',
 CHANGED:'The offer changed',CHANGED_s:'The price or validity changed after this link was issued, so approval is paused to protect you. Ask for a new link.',
 hello:'{by} prepared a trip that awaits your decision',helloN:'{n}, {by} prepared a trip that awaits your decision',helloNoBy:'A trip awaits your decision',to:'to',date:'Date',period:'Time',pax:'Passengers',cabin:'Aircraft',price:'Price',valid:'Offer valid until',unspec:'Not specified',
 morning:'Morning',noon:'Midday',evening:'Evening',night:'Night',incl:'All fees included',excl:'Some fees excluded',
 intent:'Approving records a booking intent only, not a confirmed booking. We review the details with the operator before any commitment.',
 yes:'I approve',yesS:'Booking intent, no final commitment',no:'Not for me',noS:'The offer stays open for whoever prepared it',note:'Note (optional)',failed:'Could not record your decision. Nothing was saved; try again.',
 okY:'Your approval is recorded',okYs:'This is a booking intent, not a confirmed booking, until we confirm the details with the operator.',okN:'Your decision is recorded',okNs:'We will let whoever prepared the trip know. Thank you for your time.',
 doneY:'You already approved this offer',doneN:'You already recorded a decision on this offer',expires:'Link expires'}};
const readToken=()=>{try{return new URLSearchParams(location.hash.replace(/^#/,'')).get('t')??''}catch{return''}};
const BAD=new Set(['INVALID','EXPIRED','REVOKED','CLOSED','CHANGED']);
export default function ApproverLink(){
 const {lang,setLang}=useI18n();const l:L=lang==='ar'?'ar':'en';const t=T[l];
 const token=useMemo(readToken,[]);
 const [v,setV]=useState<View|null>(null),[neterr,setNeterr]=useState(false),[note,setNote]=useState('');
 const [busy,setBusy]=useState(false),[err,setErr]=useState(''),[done,setDone]=useState<'APPROVED'|'DECLINED'|null>(null);
 useEffect(()=>{document.title=`${t.desk} · THE KING'S EYE`;
  for(const [n,c] of [['robots','noindex,nofollow'],['referrer','no-referrer']]){let m=document.querySelector(`meta[name=${n}]`);if(!m){m=document.createElement('meta');m.setAttribute('name',n);document.head.appendChild(m)}m.setAttribute('content',c)}},[t.desk]);
 const load=async()=>{setNeterr(false);setV(null);
  if(!/^[0-9a-f]{64}$/.test(token)){setV({state:'INVALID'});return}
  const {data,error}=await sb.rpc('approver_link_view',{p_token:token});
  if(error||!data){setNeterr(true);return}setV(data as View)};
 useEffect(()=>{load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const decide=async(accept:boolean)=>{setBusy(true);setErr('');
  const {data,error}=await sb.rpc('approver_link_decide',{p_token:token,p_accept:accept,p_note:note.trim()||null});
  setBusy(false);
  if(error||!data){setErr(t.failed);return}
  const r=data as {ok:boolean;state:string};
  if(r.ok){setDone(r.state==='APPROVED'?'APPROVED':'DECLINED');return}
  if(r.state==='ANSWERED'){load();return}
  setV({state:(BAD.has(r.state)?r.state:'INVALID') as 'INVALID'})};
 const nf=useMemo(()=>new Intl.NumberFormat(l==='ar'?'ar-u-nu-latn':'en-US',{maximumFractionDigits:0}),[l]);
 const dt=(d:string|null)=>d?new Date(d+'T00:00:00').toLocaleDateString(l==='ar'?'ar-u-nu-latn':'en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):t.unspec;
 const dtm=(s:string)=>new Date(s).toLocaleString(l==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const Shell=({children}:{children:React.ReactNode})=><div className="ol" lang={l} dir={l==='ar'?'rtl':'ltr'}>
  <header><span className="ol-brand"><i aria-hidden/>{t.brand}<small>{t.desk}</small></span>
   <div className="ol-l" role="group" aria-label="Language"><button className={l==='ar'?'on':''} onClick={()=>setLang('ar')} aria-pressed={l==='ar'}>عربي</button><button className={l==='en'?'on':''} onClick={()=>setLang('en')} aria-pressed={l==='en'}>EN</button></div></header>
  <main>{children}</main></div>;
 if(neterr)return <Shell><div className="ol-msg" role="alert"><p>{t.neterr}</p><button onClick={load}>{t.retry}</button></div></Shell>;
 if(done)return <Shell><div className="ol-msg" role="status"><h1>{done==='APPROVED'?t.okY:t.okN}</h1><p>{done==='APPROVED'?t.okYs:t.okNs}</p></div></Shell>;
 if(!v)return <Shell><p className="ol-load" role="status">{t.load}</p></Shell>;
 if(v.state==='ANSWERED')return <Shell><div className="ol-msg"><h1>{v.answer==='APPROVED'?t.doneY:t.doneN}</h1><p>{v.answer==='APPROVED'?t.okYs:t.okNs}</p></div></Shell>;
 if(v.state!=='OPEN')return <Shell><div className="ol-msg"><h1>{t[v.state]}</h1><p>{t[v.state+'_s']}</p></div></Shell>;
 const s=v.summary,nm=(c:string,ar:string|null,en:string|null)=>l==='ar'?(ar??en??c):(en??ar??c);
 const per=s.departure_period?t[s.departure_period]??s.departure_period:t.unspec;
 const by=s.prepared_by??'',hello=by?(v.approver_name?t.helloN.replace('{n}',v.approver_name):t.hello).replace('{by}',by):t.helloNoBy;
 return <Shell>
  <p className="ap-hello">{hello}</p>
  <section className="ol-slip" aria-label={hello}>
   <h1 className="ol-route"><span dir="ltr">{s.origin_code}</span><i aria-hidden>{l==='ar'?'←':'→'}</i><span dir="ltr">{s.destination_code}</span></h1>
   <p className="ol-names"><bdi>{nm(s.origin_code,s.origin_ar,s.origin_en)}</bdi> {t.to} <bdi>{nm(s.destination_code,s.destination_ar,s.destination_en)}</bdi></p>
   <dl className="ol-led"><dt>{t.date}</dt><dd>{dt(s.travel_date)}</dd><dt>{t.period}</dt><dd>{per}</dd><dt>{t.pax}</dt><dd>{s.passengers==null?t.unspec:<bdi>{s.passengers}</bdi>}</dd>
    {s.cabin_label&&<><dt>{t.cabin}</dt><dd><bdi>{s.cabin_label}</bdi></dd></>}
    <dt>{t.price}</dt><dd className="ap-price" dir="ltr">{nf.format(s.price)} {s.currency}<small style={{display:'block',fontSize:'.7em',color:'#0b1322b3'}}>{s.fees_included==null?'':s.fees_included?t.incl:t.excl}{s.fees_note?` · ${s.fees_note}`:''}</small></dd>
    <dt>{t.valid}</dt><dd>{dtm(s.valid_until)}</dd></dl>
   <p className="ol-priv">{t.intent}</p>
  </section>
  <section className="ap-sw">
   <label style={{width:'100%'}}>{t.note}<input value={note} maxLength={300} onChange={e=>setNote(e.target.value)}/></label>
   {err&&<p className="ol-err" role="alert">{err}</p>}
   <Switch primary busy={busy} disabled={busy} label={t.yes} sub={t.yesS} onActivate={()=>decide(true)}/>
   <Switch small disabled={busy} label={t.no} sub={t.noS} onActivate={()=>decide(false)}/>
   <p className="ol-exp">{t.expires}: {dtm(v.expires_at)}</p>
  </section>
 </Shell>;
}
