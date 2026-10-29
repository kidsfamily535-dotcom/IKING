import {useMemo,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n,type Lang} from '../i18n';
import './readiness.css';
// قسم «جاهزية السفر» في الصفحة الرئيسية: ثلاثة أسئلة ← بطاقة معلومات صادقة (وضع رسمي + طقس) ← إشارة طلب يصرّح بها الزائر نفسه.
// لا حجز ولا وعد بمقعد ولا طائرة. بيانات التواصل اختيارية وبموافقة صريحة.
type Win='72H'|'7D'|'30D'|'LATER';
type State='NORMAL'|'CAUTION'|'CRISIS'|'UNKNOWN';
type Wx={airport_code:string;condition_ar?:string|null;obs_status:string;age_minutes:number|null;wind_speed_kt:number|null;visibility:string|null;temp_c:number|null};
type Card={state:State;verifiedAt:string|null;wx:Wx[]};
const ORIGINS=['RUH','JED','DMM','DXB','DOH','KWI'];
const DESTS=['CAI','AMM','IST','MCT','LHR','GVA'];
const WINS:Win[]=['72H','7D','30D','LATER'];
type C={h:string;lead:string;q1:string;q2:string;q3:string;from:string;to:string;wins:Record<Win,string>;show:string;next:string;people:string;
 cardT:string;official:string;st:Record<State,string>;stale:string;wcalm:string;wmod:string;wstrong:string;checked:string;weather:string;current:(m:number)=>string;unknown:string;wind:string;vis:string;temp:string;
 note:string;contactT:string;contactPh:string;consent:string;send:string;sent:string;again:string;err:string;busy:string;rate:string;city:Record<string,string>};
const COPY:Record<'ar'|'en',C>={
 ar:{h:'جاهزية السفر',lead:'ثلاثة أسئلة قصيرة، وتحصل على صورة واضحة لوضع مسارك الآن. لا حجز ولا التزام.',q1:'كم عدد المسافرين؟',q2:'متى تقريبًا قد تسافر؟',q3:'من أين وإلى أين؟',from:'من',to:'إلى',
  wins:{'72H':'خلال 72 ساعة','7D':'خلال أسبوع','30D':'خلال شهر','LATER':'لاحقًا، أستعد فقط'},show:'اعرض بطاقتي',next:'التالي',people:'مسافرون',
  cardT:'بطاقة جاهزيتك',official:'الوضع الرسمي',st:{NORMAL:'لا يوجد تحذير رسمي مرتفع حاليًا',CAUTION:'توجد تنبيهات رسمية سارية، راجعها قبل أي قرار',CRISIS:'تحذيرات رسمية مشددة، راجع الجهات الرسمية',UNKNOWN:'لا تتوفر لدينا حاليًا حالة رسمية حديثة لهذا المطار. راجع الجهات الرسمية قبل أي قرار'},stale:'قد تكون قديمة',wcalm:'رياح هادئة',wmod:'رياح معتدلة',wstrong:'رياح قوية',checked:'آخر تحقق',
  weather:'الطقس',current:m=>`رصد قبل ${m} دقيقة`,unknown:'غير معروف حاليًا، سيتحقق منه فريقنا',wind:'الرياح',vis:'الرؤية',temp:'الحرارة',
  note:'هذه معلومات فقط، وليست حجزًا ولا وعدًا بمقعد أو طائرة. أي توافر يؤكده المشغّل وحده، والقرار النهائي للمشغّل والطاقم.',
  contactT:'تحب أن يتواصل معك أحد من فريقنا؟ (اختياري)',contactPh:'بريدك أو رقمك',consent:'أوافق أن يتواصل معي فريق iKing بخصوص هذا الطلب فقط',send:'أرسل',sent:'وصلنا. لن نتواصل معك إلا بموافقتك التي أعطيتها.',again:'ابدأ من جديد',err:'تعذّر الإرسال الآن، حاول لاحقًا.',busy:'جارٍ التحميل…',rate:'الخدمة مزدحمة الآن، البطاقة تعمل لكن طلبك لم يُسجَّل.',
  city:{RUH:'الرياض',JED:'جدة',DMM:'الدمام',DXB:'دبي',DOH:'الدوحة',KWI:'الكويت',CAI:'القاهرة',AMM:'عمّان',IST:'إسطنبول',MCT:'مسقط',LHR:'لندن',GVA:'جنيف'}},
 en:{h:'Travel readiness',lead:'Three short questions, and you get a clear picture of your route right now. No booking, no commitment.',q1:'How many travellers?',q2:'Roughly when might you travel?',q3:'From where to where?',from:'From',to:'To',
  wins:{'72H':'Within 72 hours','7D':'Within a week','30D':'Within a month','LATER':'Later, just preparing'},show:'Show my card',next:'Next',people:'travellers',
  cardT:'Your readiness card',official:'Official status',st:{NORMAL:'No elevated official warning at the moment',CAUTION:'Official advisories are in force; review them before deciding',CRISIS:'Strong official warnings; check the official authorities',UNKNOWN:'We have no recent official status for this airport right now. Check the official authorities before deciding'},stale:'may be outdated',wcalm:'Calm wind',wmod:'Moderate wind',wstrong:'Strong wind',checked:'Last verified',
  weather:'Weather',current:m=>`Observed ${m} min ago`,unknown:'Currently unknown; our team will verify',wind:'Wind',vis:'Visibility',temp:'Temp',
  note:'This is information only, not a booking and not a promise of a seat or an aircraft. Availability is confirmed only by the operator, and the final decision rests with the operator and crew.',
  contactT:'Would you like someone from our team to contact you? (optional)',contactPh:'Your email or phone',consent:'I agree that the iKing team may contact me about this request only',send:'Send',sent:'Received. We will contact you only with the consent you gave.',again:'Start again',err:'Could not send right now, please try later.',busy:'Loading…',rate:'The service is busy; your card works but your request was not recorded.',
  city:{RUH:'Riyadh',JED:'Jeddah',DMM:'Dammam',DXB:'Dubai',DOH:'Doha',KWI:'Kuwait',CAI:'Cairo',AMM:'Amman',IST:'Istanbul',MCT:'Muscat',LHR:'London',GVA:'Geneva'}}};
const refParam=()=>{try{const r=new URLSearchParams(location.search).get('ref')||'';return /^[A-Za-z0-9_-]{1,24}$/.test(r)?r:null}catch{return null}};

export default function Readiness(){
 const {lang}=useI18n(),L:'ar'|'en'=(lang as Lang)==='ar'?'ar':'en',c=COPY[L];
 const [n,setN]=useState(4),[win,setWin]=useState<Win|''>(''),[o,setO]=useState('RUH'),[d,setD]=useState(''),[hp,setHp]=useState('');
 const [step,setStep]=useState<1|2|3|4>(1),[busy,setBusy]=useState(false),[card,setCard]=useState<Card|null>(null),[sid,setSid]=useState<string|null>(null),[note,setNote]=useState('');
 const [ct,setCt]=useState(''),[ok,setOk]=useState(false),[done,setDone]=useState(false),[err,setErr]=useState('');
 const ref=useMemo(refParam,[]);
 const reset=()=>{setStep(1);setWin('');setD('');setCard(null);setSid(null);setNote('');setCt('');setOk(false);setDone(false);setErr('')};
 const show=async()=>{
  if(!win||!d)return;setBusy(true);setNote('');setErr('');setStep(4);
  const [st,wx]=await Promise.all([
   sb.rpc('get_readiness_state',{p_airport:o}).then(r=>r.data as {state?:State;verified_at?:string|null}|null,()=>null),
   sb.rpc('get_route_weather_public',{p_origin:o,p_destination:d}).then(r=>(r.data as Wx[]|null)??[],()=>[] as Wx[])]);
  setCard({state:st?.state??'UNKNOWN',verifiedAt:st?.verified_at??null,wx});
  if(!hp){try{const r=await sb.rpc('submit_readiness_signal',{p_party:n,p_window:win,p_origin:o,p_dest:d,p_ref:ref,p_lang:L});
   if(r.error){if(/RATE_LIMIT/.test(r.error.message))setNote(c.rate)}else setSid(r.data as string)}catch{/* البطاقة تعمل حتى لو لم تُسجَّل الإشارة */}}
  setBusy(false)};
 const send=async()=>{if(!sid||!ok||ct.trim().length<5)return;setBusy(true);setErr('');
  try{const r=await sb.rpc('add_readiness_contact',{p_id:sid,p_contact:ct.trim(),p_consent:true});if(r.error||r.data!==true)setErr(c.err);else setDone(true)}catch{setErr(c.err)}setBusy(false)};
 const fmt=(s:string|null)=>{if(!s)return '';try{return new Date(s).toLocaleDateString(L==='ar'?'ar':'en',{day:'numeric',month:'short',year:'numeric'})}catch{return ''}};
 const Chips=({list,val,set}:{list:string[];val:string;set:(v:string)=>void})=><div className="rd-chips" role="group">{list.map(k=><button key={k} type="button" className="ih-pill" aria-pressed={val===k} onClick={()=>set(k)}>{c.city[k]}</button>)}</div>;
 return <section className="rd" aria-labelledby="rd-h">
  <div className="rd-head"><h2 id="rd-h">{c.h}</h2><p className="ih-lead">{c.lead}</p></div>
  <div className="rd-body">
   {step===1&&<div className="rd-q"><h3>{c.q1}</h3>
    <div className="rd-step"><button type="button" className="ih-pill" aria-label="-" onClick={()=>setN(v=>Math.max(1,v-1))}>−</button><b dir="ltr">{n}</b><button type="button" className="ih-pill" aria-label="+" onClick={()=>setN(v=>Math.min(60,v+1))}>+</button><span>{c.people}</span></div>
    <button type="button" className="rd-next" onClick={()=>setStep(2)}>{c.next} <span aria-hidden="true">→</span></button></div>}
   {step===2&&<div className="rd-q"><h3>{c.q2}</h3>
    <div className="rd-chips" role="group">{WINS.map(w=><button key={w} type="button" className="ih-pill" aria-pressed={win===w} onClick={()=>{setWin(w);setStep(3)}}>{c.wins[w]}</button>)}</div></div>}
   {step===3&&<div className="rd-q"><h3>{c.q3}</h3>
    <p className="rd-lab">{c.from}</p><Chips list={ORIGINS} val={o} set={v=>{setO(v);if(d===v)setD('')}}/>
    <p className="rd-lab">{c.to}</p><Chips list={DESTS.filter(x=>x!==o)} val={d} set={setD}/>
    <input className="rd-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e=>setHp(e.target.value)} name="website"/>
    <button type="button" className="rd-go" disabled={!d||busy} onClick={show}>{c.show}</button></div>}
   {step===4&&<div className="rd-card" aria-live="polite">
    {busy&&!card?<p className="ih-lead">{c.busy}</p>:card&&<>
     <h3>{c.cardT}</h3>
     <p className="rd-route" dir="ltr">{c.city[o]} <span aria-hidden="true">→</span> {c.city[d]} · {n} · {c.wins[win as Win]}</p>
     <div className="rd-row"><span>{c.official}</span><span>{c.st[card.state]}{card.verifiedAt&&card.state!=='UNKNOWN'&&<small> · {c.checked} {fmt(card.verifiedAt)}{Date.now()-new Date(card.verifiedAt).getTime()>72*3600e3?` (${c.stale})`:''}</small>}</span></div>
     {card.wx.length>0&&<div className="rd-row rd-wx"><span>{c.weather}</span><span>{card.wx.map(w=><span className="rd-w" key={w.airport_code}><b dir="ltr">{w.airport_code}</b> {w.obs_status==='CURRENT'&&w.age_minutes!==null
       ?<>{c.current(w.age_minutes)} · {w.condition_ar&&L==='ar'?w.condition_ar+' · ':''}{w.wind_speed_kt==null?'':(w.wind_speed_kt<15?c.wcalm:w.wind_speed_kt<25?c.wmod:c.wstrong)+' · '}{w.temp_c!=null&&<span dir="ltr">{Math.round(w.temp_c)}°C</span>}</>:c.unknown}</span>)}</span></div>}
     <p className="rd-note">{c.note}</p>
     {note&&<p className="rd-note">{note}</p>}
     {sid&&!done&&<div className="rd-contact"><h4>{c.contactT}</h4>
      <input type="text" inputMode="email" maxLength={120} placeholder={c.contactPh} value={ct} onChange={e=>setCt(e.target.value)} aria-label={c.contactPh}/>
      <label className="rd-ck"><input type="checkbox" checked={ok} onChange={e=>setOk(e.target.checked)}/> <span>{c.consent}</span></label>
      <button type="button" className="rd-go" disabled={busy||!ok||ct.trim().length<5} onClick={send}>{c.send}</button>
      {err&&<p className="rd-note" role="alert">{err}</p>}</div>}
     {done&&<p className="rd-ok">{c.sent}</p>}
     <button type="button" className="rd-again" onClick={reset}>{c.again}</button></>}
   </div>}
  </div>
 </section>;
}
