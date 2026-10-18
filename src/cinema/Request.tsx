import {useEffect,useMemo,useState} from 'react';
import './cinema.css';import './request.css';
import {useI18n} from '../i18n';
import LangSwitch from '../LangSwitch';
import {HUBS} from '../cabin/geo';
// طلب رحلة حقيقي بأربع شاشات: الوجهة، الموعد، التواصل، الاستلام. يصل إلى إنسان من الفريق، ولا يُعرض فيه طائرة ولا سعر لم يتأكدا.
const BASE=import.meta.env.VITE_SUPABASE_URL??'https://yiklciblxwymcxxszkty.supabase.co';
type Win='am'|'noon'|'pm';type Ch='whatsapp'|'phone'|'email';
const C:Record<string,Record<string,string>>={
 ar:{name:'عين الملك',to:'إلى أين؟',from:'من',ph:'اكتب المدينة',when:'متى، ومن يسافر؟',date:'التاريخ',who:'المسافرون',am:'صباحًا',noon:'ظهرًا',pm:'مساءً',next:'متابعة',no:'هذه الوجهة غير متاحة للطلب حاليًا.',none:'لا نجد هذه المدينة.'},
 en:{name:'The King’s Eye',to:'Where to?',from:'From',ph:'Type a city',when:'When, and who is flying?',date:'Date',who:'Travellers',am:'Morning',noon:'Afternoon',pm:'Evening',next:'Continue',no:'This route can’t be requested yet.',none:'We can’t find that city.'},
 ru:{name:'Око Короля',to:'Куда?',from:'Откуда',ph:'Введите город',when:'Когда и кто летит?',date:'Дата',who:'Пассажиры',am:'Утро',noon:'День',pm:'Вечер',next:'Далее',no:'Этот маршрут пока недоступен для запроса.',none:'Такой город не найден.'},
 tr:{name:'Kralın Gözü',to:'Nereye?',from:'Nereden',ph:'Şehir yazın',when:'Ne zaman, kim uçuyor?',date:'Tarih',who:'Yolcular',am:'Sabah',noon:'Öğle',pm:'Akşam',next:'Devam',no:'Bu rota için henüz talep alınamıyor.',none:'Bu şehri bulamadık.'}
};
const norm=(s:string)=>s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
const TIME:Record<Win,string>={am:'09:00',noon:'13:00',pm:'18:00'};
const PERIOD:Record<Win,string>={am:'morning',noon:'afternoon',pm:'evening'};
export default function Request(){
 const {lang,t}=useI18n(),c=C[lang]||C.en,ar=lang==='ar',arrow=ar?'←':'→';
 const nm=(i:string)=>{const h=HUBS.find(x=>x.iata===i);return h?(ar?h.ar:h.en):i};
 const [step,setStep]=useState(0),[from,setFrom]=useState('RUH'),[to,setTo]=useState<string|null>(null),[pickFrom,setPickFrom]=useState(false),[q,setQ]=useState('');
 const [date,setDate]=useState(()=>iso(Date.now()+864e5)),[win,setWin]=useState<Win>('am'),[guests,setGuests]=useState(2);
 const [name,setName]=useState(''),[ch,setCh]=useState<Ch>('whatsapp'),[cv,setCv]=useState(''),[agree,setAgree]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const [aps,setAps]=useState<string[]>([]);
 useEffect(()=>{let live=true;fetch(`${BASE}/functions/v1/submit-request`).then(r=>r.ok?r.json():null).then(j=>{if(live&&j?.airports)setAps(j.airports.map((a:any)=>a.iata_code))}).catch(()=>{});return()=>{live=false}},[]);
 // وجهة وصلت من الرابط ?to=LON
 useEffect(()=>{const x=new URLSearchParams(location.search).get('to');if(x&&x!=='RUH'&&HUBS.some(h=>h.iata===x))setTo(x)},[]);
 const outside=aps.length>0&&to!==null&&(!aps.includes(from)||!aps.includes(to));
 const list=useMemo(()=>{const n=norm(q),skip=pickFrom?to:from;
  return HUBS.filter(h=>h.iata!==skip&&(!n||norm(h.ar).includes(n)||norm(h.en).includes(n)||h.iata.toLowerCase()===n)).sort((a,b)=>a.pri-b.pri).slice(0,n?6:7)},[q,from,to,pickFrom]);
 const choose=(i:string)=>{if(pickFrom){if(i===to)setTo(null);setFrom(i);setPickFrom(false)}else setTo(i);setQ('')};
 const when=new Intl.DateTimeFormat(ar?'ar-u-nu-latn':lang,{day:'numeric',month:'long'}).format(new Date(date+'T12:00:00'));
 const ok=name.trim().length>=2&&(ch==='email'?/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cv.trim()):/^\+?[0-9]{7,15}$/.test(cv.replace(/[\s\-()]/g,'')))&&agree;
 const send=async()=>{if(!to||!ok||busy)return;setErr('');setBusy(true);
  const p=new URLSearchParams(location.search),SRC=['HOTEL','TRAVEL_AGENCY','CONCIERGE','YACHT_BROKER','CORPORATE','OTHER'],src=(p.get('src')||'').toUpperCase();
  try{const r=await fetch(`${BASE}/functions/v1/submit-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact_name:name.trim(),contact_channel:ch,contact_value:cv.trim(),origin_code:from,destination_code:to,travel_date:date,departure_period:PERIOD[win],passengers:guests,note:`request | ${TIME[win]}`,consent:true,source:SRC.includes(src)?src:'DIRECT',referral_partner:p.get('ref')||undefined,campaign:p.get('campaign')||'cabin'})});
   if(r.ok){setStep(3);return}
   const j=await r.json().catch(()=>({}));setErr(r.status===429?t('ask.err.limit'):j?.field?t('ask.err.field',{x:j.field}):t('ask.err.generic'))
  }catch{setErr(t('ask.err.generic'))}finally{setBusy(false)}};
 const again=()=>{setStep(0);setTo(null);setFrom('RUH');setGuests(2);setName('');setCv('');setAgree(false);setErr('')};
 const route=to?`${nm(from)} ${arrow} ${nm(to)}`:'';
 return <div className={`rq cn${ar?' ar':''}`} dir={ar?'rtl':'ltr'} lang={lang}>
  <div className="rq-bg" aria-hidden="true"/><div className="cn-shade" aria-hidden="true"/><div className="cn-grain" aria-hidden="true"/>
  <LangSwitch/>
  <header className="rq-top"><a className="rq-brand" href="/">{c.name}</a>
   {step<3&&<ol className="rq-prog" aria-label={`${step+1}/3`}>{[0,1,2].map(i=><li key={i} className={i<=step?'on':''}/>)}</ol>}</header>
  <main className="rq-main" key={step}>
   {step===0&&<>
    <h1 className="rq-h">{pickFrom?c.from:c.to}</h1>
    {!pickFrom&&<button type="button" className="rq-from" onClick={()=>{setPickFrom(true);setQ('')}}><small>{c.from}</small> {nm(from)}</button>}
    {to&&!pickFrom?<p className="rq-big">{nm(to)}<button type="button" className="rq-x" onClick={()=>setTo(null)} aria-label={t('ask.back')}>×</button></p>
     :<><input className="rq-in big" value={q} placeholder={c.ph} autoComplete="off" autoFocus aria-label={c.ph} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&list[0])choose(list[0].iata)}}/>
      {list.length?<ul className="rq-list">{list.map(h=><li key={h.iata}><button type="button" onClick={()=>choose(h.iata)}>{ar?h.ar:h.en}</button></li>)}</ul>:<p className="rq-note">{c.none}</p>}</>}
    {outside&&<p className="rq-note" role="alert">{c.no}</p>}
    {to&&!pickFrom&&<button type="button" className="cn-btn main rq-go" disabled={outside} onClick={()=>setStep(1)}>{c.next}</button>}
   </>}
   {step===1&&<>
    <p className="rq-route">{route}</p><h1 className="rq-h">{c.when}</h1>
    <label className="rq-row"><span>{c.date}</span><input className="rq-in" type="date" value={date} min={iso(Date.now())} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
    <div className="rq-seg" role="radiogroup" aria-label={c.when}>{(['am','noon','pm'] as Win[]).map(w=><button key={w} type="button" role="radio" aria-checked={win===w} onClick={()=>setWin(w)}>{c[w]}</button>)}</div>
    <div className="rq-row"><span id="rq-w">{c.who}</span><div className="rq-step" role="group" aria-labelledby="rq-w"><button type="button" aria-label="−" disabled={guests<=1} onClick={()=>setGuests(g=>Math.max(1,g-1))}>−</button><output>{guests}</output><button type="button" aria-label="+" disabled={guests>=19} onClick={()=>setGuests(g=>Math.min(19,g+1))}>+</button></div></div>
    <button type="button" className="cn-btn main rq-go" onClick={()=>setStep(2)}>{c.next}</button>
    <button type="button" className="rq-link" onClick={()=>setStep(0)}>{t('ask.back')}</button>
   </>}
   {step===2&&<>
    <p className="rq-route">{route} · {when} · {guests}</p><h1 className="rq-h">{t('ask.contactT')}</h1>
    <label className="rq-row col"><span>{t('ask.name')}</span><input className="rq-in" value={name} maxLength={80} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>
    <div className="rq-seg" role="radiogroup" aria-label={t('ask.how')}>{(['whatsapp','phone','email'] as Ch[]).map(k=><button key={k} type="button" role="radio" aria-checked={ch===k} onClick={()=>{setCh(k);setCv('')}}>{t('ask.ch.'+k)}</button>)}</div>
    <label className="rq-row col"><span>{t('ask.ch.'+ch)}</span><input className="rq-in" dir="ltr" inputMode={ch==='email'?'email':'tel'} value={cv} maxLength={120} autoComplete={ch==='email'?'email':'tel'} placeholder={ch==='email'?'name@example.com':'+966…'} onChange={e=>setCv(e.target.value)}/></label>
    <label className="rq-agree"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><i aria-hidden="true"/><span>{t('ask.consent')}</span></label>
    <p className="rq-note">{t('ask.contactSub')}</p>
    {err&&<p className="rq-note bad" role="alert">{err}</p>}
    <button type="button" className="cn-btn main rq-go" disabled={!ok||busy} aria-busy={busy||undefined} onClick={send}>{t('ask.submit')}</button>
    <button type="button" className="rq-link" onClick={()=>setStep(1)}>{t('ask.back')}</button>
   </>}
   {step===3&&<>
    <svg className="cn-mark rq-mark" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C9 2 31 2 38 12 31 22 9 22 2 12Z" fill="none" stroke="#d9bf86" strokeWidth="1.2"/><circle cx="20" cy="12" r="4.6" fill="#d9bf86"/><circle cx="20" cy="12" r="1.8" fill="#02040a"/></svg>
    <h1 className="rq-h">{t('ask.sentT')}</h1><p className="rq-route">{route} · {when}</p>
    <p className="rq-lead">{t('ask.sentBody')}</p><p className="rq-note">{t('ask.sentSt')}</p>
    <button type="button" className="cn-btn quiet rq-go" onClick={again}>{t('ask.again')}</button>
   </>}
  </main>
 </div>;
}
