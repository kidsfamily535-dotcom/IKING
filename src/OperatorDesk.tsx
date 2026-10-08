import {useEffect,useMemo,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
import './operator.css';
// مكتب المشغّل: رابط ثابت لكل مشغّل (?view=desk#t=الرمز) بلا حساب، يضيف منه رحلاته الفاضية ويسحبها.
// الرمز بعد # فلا يصل إلى أي خادم. ما يدخله المشغّل يُحفظ كـ«مستلَم» فقط: لا يظهر لأي عميل ولا يصير توفّرًا أو فرصة قبل تحقق الوسيط.
type Ap={code:string;ar:string|null;en:string|null};
type Leg={id:string;origin:string;destination:string|null;from:string;until:string;model:string;seats:number;price:number|null;currency:string|null;status:'RECEIVED'|'WITHDRAWN'|'REJECTED'|'CONVERTED'};
type View={state:'OPEN';operator_name:string;expires_at:string;airports:Ap[];models:string[];legs:Leg[]}|{state:'INVALID'|'EXPIRED'};
type L='ar'|'en';
const T:Record<L,Record<string,string>>={
ar:{brand:'THE KING\'S EYE',desk:'مكتب المشغّل',load:'جارٍ فتح مكتبك…',neterr:'تعذّر الاتصال. تحقّق من الشبكة ثم أعد المحاولة.',retry:'إعادة المحاولة',
 INVALID:'هذا الرابط غير صالح',INVALID_s:'تأكد أنك فتحت الرابط كاملًا كما وصلك، أو اطلب رابطًا جديدًا من فريقنا.',EXPIRED:'انتهت صلاحية الرابط',EXPIRED_s:'اطلب من فريقنا رابطًا جديدًا.',
 hello:'مرحبًا',lead:'أضف هنا الرحلات الفاضية المتاحة لديك. يراجعها فريقنا ويتحقق منها معك قبل أن يُبنى عليها أي شيء، ولا يراها أي عميل قبل ذلك.',
 add:'إضافة رحلة فاضية',origin:'من',dest:'إلى',flex:'وجهة مرنة (أي وجهة)',pick:'اختر مطارًا',from:'بداية نافذة الإقلاع',until:'نهاية نافذة الإقلاع',model:'نوع الطائرة',seats:'عدد المقاعد',
 price:'سعر استرشادي (اختياري)',cur:'العملة',notes:'ملاحظات (اختياري)',review:'مراجعة قبل الإرسال',send:'إرسال الرحلة',sending:'جارٍ الإرسال…',back:'تعديل',
 final:'هذه معلومة منك، ولا تُعرض لأحد حتى يتحقق منها فريقنا.',
 e_origin:'اختر مطار الإقلاع',e_same:'اختر مطارين مختلفين',e_win:'حدّد نافذة إقلاع صحيحة لم تنتهِ بعد',e_far:'نافذة الإقلاع بعيدة جدًا (الحد 30 يومًا)',e_model:'اكتب نوع الطائرة',e_seats:'عدد المقاعد بين 1 و40',e_price:'أدخل سعرًا صحيحًا أو اتركه فارغًا',
 failed:'تعذّر الإرسال. لم يُحفظ شيء، يمكنك المحاولة مرة أخرى.',limit:'بلغتَ حد الإضافة اليومي. حاول غدًا أو تواصل مع فريقنا.',
 mine:'رحلاتك',none:'لا رحلات مضافة بعد.',withdraw:'سحب',withdrawn:'سُحبت',any:'أي وجهة',
 RECEIVED:'استلمناها، بانتظار تحقق فريقنا',WITHDRAWN:'سُحبت',REJECTED:'لم نعتمدها',CONVERTED:'اعتُمدت',seatsN:'مقاعد',expires:'ينتهي الرابط',done:'وصلت رحلتك'},
en:{brand:'THE KING\'S EYE',desk:'Operator desk',load:'Opening your desk…',neterr:'Could not connect. Check your network and try again.',retry:'Try again',
 INVALID:'This link is not valid',INVALID_s:'Make sure you opened the full link as it was sent, or ask our team for a new one.',EXPIRED:'This link has expired',EXPIRED_s:'Ask our team for a new link.',
 hello:'Welcome',lead:'Add the empty legs you have available. Our team reviews and verifies them with you before anything is built on them, and no customer sees them before that.',
 add:'Add an empty leg',origin:'From',dest:'To',flex:'Flexible destination (any)',pick:'Choose an airport',from:'Departure window starts',until:'Departure window ends',model:'Aircraft type',seats:'Seats',
 price:'Indicative price (optional)',cur:'Currency',notes:'Notes (optional)',review:'Review before sending',send:'Send leg',sending:'Sending…',back:'Edit',
 final:'This is information from you. It is shown to no one until our team verifies it.',
 e_origin:'Choose the departure airport',e_same:'Choose two different airports',e_win:'Set a valid departure window that has not ended',e_far:'Departure window is too far ahead (30 days max)',e_model:'Enter the aircraft type',e_seats:'Seats must be 1 to 40',e_price:'Enter a valid price or leave it empty',
 failed:'Could not send. Nothing was saved; you can try again.',limit:'You reached the daily limit. Try tomorrow or contact our team.',
 mine:'Your legs',none:'No legs added yet.',withdraw:'Withdraw',withdrawn:'Withdrawn',any:'Any destination',
 RECEIVED:'Received, awaiting our verification',WITHDRAWN:'Withdrawn',REJECTED:'Not accepted',CONVERTED:'Accepted',seatsN:'seats',expires:'Link expires',done:'Your leg was received'}};
const readToken=()=>{try{return new URLSearchParams(location.hash.replace(/^#/,'')).get('t')??''}catch{return''}};
export default function OperatorDesk(){
 const {lang,setLang}=useI18n();const l:L=lang==='ar'?'ar':'en';const t=T[l];
 const token=useMemo(readToken,[]);
 const [v,setV]=useState<View|null>(null),[neterr,setNeterr]=useState(false);
 const [o,setO]=useState(''),[d,setD]=useState(''),[from,setFrom]=useState(''),[until,setUntil]=useState(''),[model,setModel]=useState(''),[seats,setSeats]=useState('4'),[price,setPrice]=useState(''),[cur,setCur]=useState('USD'),[notes,setNotes]=useState('');
 const [step,setStep]=useState<'form'|'review'>('form'),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[ok,setOk]=useState(false);
 useEffect(()=>{document.title=`${t.desk} · IKING`;
  for(const [n,c] of [['robots','noindex,nofollow'],['referrer','no-referrer']]){let m=document.querySelector(`meta[name=${n}]`);if(!m){m=document.createElement('meta');m.setAttribute('name',n);document.head.appendChild(m)}m.setAttribute('content',c)}},[t.desk]);
 const load=async()=>{setNeterr(false);
  if(!/^[0-9a-f]{64}$/.test(token)){setV({state:'INVALID'});return}
  const {data,error}=await sb.rpc('operator_desk_view',{p_token:token});
  if(error||!data){setNeterr(true);return}setV(data as View)};
 useEffect(()=>{load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const dtm=(s:string)=>new Date(s).toLocaleString(l==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const apName=(c:string|null)=>{if(!c)return t.any;const a=v&&v.state==='OPEN'?v.airports.find(x=>x.code===c):undefined;return a?(l==='ar'?(a.ar??a.en??c):(a.en??a.ar??c)):c};
 const check=():string=>{
  if(!o)return t.e_origin;if(d&&d===o)return t.e_same;
  const f=new Date(from),u=new Date(until);
  if(!from||!until||isNaN(+f)||isNaN(+u)||u<f||+u<Date.now())return t.e_win;
  if(+f>Date.now()+30*864e5)return t.e_far;
  if(model.trim().length<2)return t.e_model;
  const n=Number(seats);if(!/^\d+$/.test(seats)||n<1||n>40)return t.e_seats;
  if(price){const p=Number(price);if(!isFinite(p)||p<=0)return t.e_price}
  return''};
 const toReview=()=>{const e=check();setErr(e);if(!e)setStep('review')};
 const fail=(m:string)=>{if(m.includes('expired')){setV({state:'EXPIRED'});return true}if(m.includes('invalid link')){setV({state:'INVALID'});return true}return false};
 const send=async()=>{setBusy(true);setErr('');
  const {error}=await sb.rpc('operator_desk_add_leg',{p_token:token,p_origin:o,p_destination:d||null,p_from:new Date(from).toISOString(),p_until:new Date(until).toISOString(),p_model:model.trim(),p_seats:Number(seats),p_price:price?Number(price):null,p_currency:price?cur:null,p_notes:notes.trim()||null});
  setBusy(false);
  if(error){const m=error.message??'';if(fail(m))return;setErr(m.includes('daily limit')?t.limit:t.failed);return}
  setO('');setD('');setFrom('');setUntil('');setModel('');setSeats('4');setPrice('');setNotes('');setStep('form');setOk(true);await load()};
 const withdraw=async(id:string)=>{setErr('');const {error}=await sb.rpc('operator_desk_withdraw_leg',{p_token:token,p_leg:id});if(error&&!fail(error.message??''))setErr(t.failed);await load()};
 const Shell=({children}:{children:React.ReactNode})=><div className="ol" lang={l} dir={l==='ar'?'rtl':'ltr'}>
  <header><span className="ol-brand"><i aria-hidden/>{t.brand}<small>{t.desk}</small></span>
   <div className="ol-l" role="group" aria-label="Language"><button className={l==='ar'?'on':''} onClick={()=>setLang('ar')} aria-pressed={l==='ar'}>عربي</button><button className={l==='en'?'on':''} onClick={()=>setLang('en')} aria-pressed={l==='en'}>EN</button></div></header>
  <main>{children}</main></div>;
 if(neterr)return <Shell><div className="ol-msg" role="alert"><p>{t.neterr}</p><button onClick={load}>{t.retry}</button></div></Shell>;
 if(!v)return <Shell><p className="ol-load" role="status">{t.load}</p></Shell>;
 if(v.state!=='OPEN')return <Shell><div className="ol-msg"><h1>{t[v.state]}</h1><p>{t[v.state+'_s']}</p></div></Shell>;
 const sel=(val:string,set:(x:string)=>void,flex:boolean)=><select value={val} onChange={e=>set(e.target.value)}><option value="">{flex?t.flex:t.pick}</option>{v.airports.map(a=><option key={a.code} value={a.code}>{(l==='ar'?(a.ar??a.en):(a.en??a.ar))??a.code} · {a.code}</option>)}</select>;
 return <Shell>
  <section className="ol-slip"><p className="ol-k">{t.hello}</p><h1 className="ol-names"><bdi>{v.operator_name}</bdi></h1><p className="ol-priv">{t.lead}</p></section>
  {ok&&<p className="ol-msg" role="status">{t.done}</p>}
  <section className="ol-ans">
   <h2>{step==='form'?t.add:t.review}</h2>
   {step==='form'&&<div className="ol-form">
    <div className="ol-two"><label>{t.origin}{sel(o,setO,false)}</label><label>{t.dest}{sel(d,setD,true)}</label></div>
    <div className="ol-two"><label>{t.from}<input type="datetime-local" dir="ltr" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>{t.until}<input type="datetime-local" dir="ltr" value={until} onChange={e=>setUntil(e.target.value)}/></label></div>
    <div className="ol-two"><label>{t.model}<input list="od-models" value={model} onChange={e=>setModel(e.target.value)} maxLength={80} autoComplete="off"/><datalist id="od-models">{v.models.map(m=><option key={m} value={m}/>)}</datalist></label>
     <label>{t.seats}<input inputMode="numeric" dir="ltr" value={seats} onChange={e=>setSeats(e.target.value.replace(/\D/g,''))}/></label></div>
    <div className="ol-two"><label>{t.price}<input inputMode="decimal" dir="ltr" value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9.]/g,''))}/></label>
     <label>{t.cur}<select value={cur} onChange={e=>setCur(e.target.value)}><option>USD</option><option>SAR</option><option>AED</option></select></label></div>
    <label>{t.notes}<textarea rows={2} maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    {err&&<p className="ol-err" role="alert">{err}</p>}
    <button className="ol-go" onClick={()=>{setOk(false);toReview()}}>{t.review}</button></div>}
   {step==='review'&&<>
    <dl className="ol-sum"><dt>{t.origin}</dt><dd>{apName(o)}</dd><dt>{t.dest}</dt><dd>{apName(d||null)}</dd><dt>{t.from}</dt><dd>{dtm(new Date(from).toISOString())}</dd><dt>{t.until}</dt><dd>{dtm(new Date(until).toISOString())}</dd>
     <dt>{t.model}</dt><dd>{model.trim()}</dd><dt>{t.seats}</dt><dd>{seats}</dd>{price&&<><dt>{t.price}</dt><dd dir="ltr">{price} {cur}</dd></>}{notes.trim()&&<><dt>{t.notes}</dt><dd>{notes.trim()}</dd></>}</dl>
    <p className="ol-final">{t.final}</p>
    {err&&<p className="ol-err" role="alert">{err}</p>}
    <div className="ol-row"><button className="ol-go" disabled={busy} onClick={send}>{busy?t.sending:t.send}</button><button className="ol-ghost" disabled={busy} onClick={()=>setStep('form')}>{t.back}</button></div></>}
  </section>
  <section className="ol-ans"><h2>{t.mine}</h2>
   {!v.legs.length&&<p className="ol-priv">{t.none}</p>}
   {v.legs.map(x=><dl className="ol-sum" key={x.id}><dt dir="ltr">{x.origin} → {x.destination??'—'}</dt><dd>{apName(x.origin)} · {apName(x.destination)}</dd>
    <dt>{dtm(x.from)} – {dtm(x.until)}</dt><dd><bdi>{x.model}</bdi> · {x.seats} {t.seatsN}{x.price?<> · <span dir="ltr">{x.price} {x.currency}</span></>:null}</dd>
    <dt>{t[x.status]}</dt><dd>{x.status==='RECEIVED'&&<button className="ol-ghost" onClick={()=>withdraw(x.id)}>{t.withdraw}</button>}</dd></dl>)}
   <p className="ol-exp">{t.expires}: {dtm(v.expires_at)}</p></section>
 </Shell>;
}
