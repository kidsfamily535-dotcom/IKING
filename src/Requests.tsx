import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {sb} from './lib/supabase';
import {useI18n,airportName,type Lang} from './i18n';
import Route from './Route';
import Glyph from './Glyph';
import type {Airport} from './data/types';
import {Switch} from './cabin/Switch';
import FlexLegs from './FlexLegs';
import {TermsView} from './PilotSteps';
import './requests.css';
import './profile.css';
import BriefTicker,{briefLabel,briefKind} from './BriefTicker';

// جهة العميل من سلسلة الطلب: يطلب رحلة، يتابع حالتها بلغة بسيطة، ثم يقبل العرض أو يرفضه.
// العميل لا يرى المشغّل ولا سعره ولا الهامش: الدالة list_my_loop_offers تعيد ما أقرّه الوسيط فقط.
// القبول نية حجز وليس حجزًا، والنص يقولها صراحة قبل الضغط.
export type MyReq={id:string;origin_code:string|null;destination_code:string|null;travel_date:string|null;passengers:number|null;loop_status:string;status:string;created_at:string};
export type MyOffer={client_offer_id:string;request_id:string;cabin_label:string;price:number;currency:string;fees_included:boolean;fees_note:string|null;valid_until:string;status:string};
export type My={reqs:MyReq[];offers:MyOffer[];loaded:boolean;reload:()=>Promise<void>};

export function useMyRequests(real:boolean):My{
 const [reqs,setReqs]=useState<MyReq[]>([]),[offers,setOffers]=useState<MyOffer[]>([]),[loaded,setLoaded]=useState(false);
 const reload=useCallback(async()=>{if(!real)return;
  const [a,b]=await Promise.all([
   sb.from('travel_requests').select('id,origin_code,destination_code,travel_date,passengers,loop_status,status,created_at').neq('status','CANCELLED').order('created_at',{ascending:false}).limit(10),
   sb.rpc('list_my_loop_offers')]);
  setReqs(a.error?[]:(a.data as MyReq[]));setOffers(b.error?[]:(b.data as MyOffer[]));setLoaded(true)},[real]);
 useEffect(()=>{reload()},[reload]);
 return {reqs,offers,loaded,reload};
}

const D:Record<Lang,Record<string,string>>={
ar:{nav:'طلباتي',askH:'أين تريد أن تذهب؟',reqH:'نعمل على طلبك',offerH:'عرضك جاهز',from:'من',to:'إلى',date:'التاريخ',period:'الوقت',any:'أي وقت',morning:'صباحًا',noon:'ظهرًا',evening:'مساءً',night:'ليلًا',pax:'عدد الركاب',bag:'الأمتعة (اختياري)',ret:'أريد العودة أيضًا',note:'ملاحظة تريد إضافتها (اختياري)',send:'أرسل الطلب',sending:'جارٍ الإرسال…',sent:'استلمنا طلبك. نراجعه ونعود إليك بعرض. لا نحجز شيئًا قبل موافقتك.',pick:'اختر',same:'المغادرة والوصول يجب أن يختلفا',past:'التاريخ لا يمكن أن يسبق اليوم',err:'تعذّر إرسال الطلب. حاول مرة أخرى.',
 new:'استلمنا طلبك',search:'نبحث لك عن أفضل الخيارات',prep:'نجهّز لك العرض',offer:'عرضك جاهز',acc:'سجّلنا قبولك ونؤكد التفاصيل مع المشغّل',conf:'تأكدت رحلتك',dec:'أُغلق الطلب بناءً على قرارك',none:'لم نجد خيارًا مناسبًا الآن',late:'أُغلق الطلب لانتهاء مهلة الرد',exp:'انتهت مهلة العرض',can:'أُلغي',
 valid:'صالح حتى',incl:'السعر شامل الرسوم',excl:'الرسوم غير مشمولة',accept:'اقبل العرض',decline:'لا يناسبني',accNote:'هذا تسجيل لرغبتك في الحجز، وليس حجزًا مؤكدًا. نؤكد التفاصيل مع المشغّل أولًا ثم نعود إليك.',confirm:'أؤكد القبول',back:'رجوع',why:'السبب (اختياري)',decGo:'أرفض العرض',accepted:'سجّلنا قبولك. نؤكد التفاصيل مع المشغّل ونعود إليك.',declined:'سجّلنا قرارك. شكرًا لوقتك.',newReq:'طلب رحلة جديد',cancel:'إلغاء الطلب',cancelQ:'إلغاء هذا الطلب؟',yours:'طلباتك',pass:'مسافرون'},
en:{nav:'My requests',askH:'Where would you like to go?',reqH:'We are working on your request',offerH:'Your offer is ready',from:'From',to:'To',date:'Date',period:'Time',any:'Any time',morning:'Morning',noon:'Midday',evening:'Evening',night:'Night',pax:'Passengers',bag:'Baggage (optional)',ret:'I also need the return',note:'Anything to add (optional)',send:'Send request',sending:'Sending…',sent:'We have your request. We will review it and come back with an offer. Nothing is booked without your approval.',pick:'Choose',same:'Departure and arrival must differ',past:'The date cannot be before today',err:'Could not send the request. Try again.',
 new:'We received your request',search:'Finding the best options for you',prep:'Preparing your offer',offer:'Your offer is ready',acc:'Your acceptance is recorded; we are confirming details with the operator',conf:'Your flight is confirmed',dec:'Closed at your decision',none:'No suitable option right now',late:'Closed: the reply window ended',exp:'The offer has expired',can:'Cancelled',
 valid:'Valid until',incl:'Price includes fees',excl:'Fees not included',accept:'Accept the offer',decline:'Not for me',accNote:'This records your wish to book. It is not a confirmed booking. We confirm the details with the operator first, then come back to you.',confirm:'I confirm acceptance',back:'Back',why:'Reason (optional)',decGo:'Decline the offer',accepted:'Your acceptance is recorded. We are confirming details with the operator and will come back to you.',declined:'Your decision is recorded. Thank you for your time.',newReq:'New trip request',cancel:'Cancel request',cancelQ:'Cancel this request?',yours:'Your requests',pass:'travellers'},
tr:{nav:'Taleplerim',askH:'Nereye gitmek istiyorsunuz?',reqH:'Talebiniz üzerinde çalışıyoruz',offerH:'Teklifiniz hazır',from:'Nereden',to:'Nereye',date:'Tarih',period:'Saat',any:'Fark etmez',morning:'Sabah',noon:'Öğle',evening:'Akşam',night:'Gece',pax:'Yolcu sayısı',bag:'Bagaj (isteğe bağlı)',ret:'Dönüş de gerekli',note:'Eklemek istediğiniz not (isteğe bağlı)',send:'Talebi gönder',sending:'Gönderiliyor…',sent:'Talebinizi aldık. İnceleyip size bir teklifle döneceğiz. Onayınız olmadan hiçbir şey ayırtmayız.',pick:'Seçin',same:'Çıkış ve varış farklı olmalı',past:'Tarih bugünden önce olamaz',err:'Talep gönderilemedi. Tekrar deneyin.',
 new:'Talebinizi aldık',search:'Sizin için en iyi seçenekleri arıyoruz',prep:'Teklifinizi hazırlıyoruz',offer:'Teklifiniz hazır',acc:'Kabulünüzü kaydettik, ayrıntıları operatörle doğruluyoruz',conf:'Uçuşunuz onaylandı',dec:'Talep kararınız üzerine kapatıldı',none:'Şu an uygun bir seçenek bulamadık',late:'Yanıt süresi dolduğu için kapatıldı',exp:'Teklifin süresi doldu',can:'İptal edildi',
 valid:'Geçerlilik',incl:'Fiyata ücretler dahil',excl:'Ücretler dahil değil',accept:'Teklifi kabul et',decline:'Bana uygun değil',accNote:'Bu, rezervasyon isteğinizin kaydıdır; onaylanmış bir rezervasyon değildir. Önce ayrıntıları operatörle doğrularız, sonra size döneriz.',confirm:'Kabulü onaylıyorum',back:'Geri',why:'Neden (isteğe bağlı)',decGo:'Teklifi reddet',accepted:'Kabulünüzü kaydettik. Ayrıntıları operatörle doğrulayıp size döneceğiz.',declined:'Kararınızı kaydettik. Zaman ayırdığınız için teşekkürler.',newReq:'Yeni uçuş talebi',cancel:'Talebi iptal et',cancelQ:'Bu talep iptal edilsin mi?',yours:'Talepleriniz',pass:'yolcu'},
ru:{nav:'Мои запросы',askH:'Куда вы хотите полететь?',reqH:'Мы работаем над вашим запросом',offerH:'Ваше предложение готово',from:'Откуда',to:'Куда',date:'Дата',period:'Время',any:'Любое',morning:'Утро',noon:'День',evening:'Вечер',night:'Ночь',pax:'Пассажиров',bag:'Багаж (по желанию)',ret:'Нужен и обратный рейс',note:'Примечание (по желанию)',send:'Отправить запрос',sending:'Отправляем…',sent:'Мы получили запрос. Изучим его и вернёмся с предложением. Ничего не бронируем без вашего согласия.',pick:'Выберите',same:'Вылет и прилёт должны различаться',past:'Дата не может быть в прошлом',err:'Не удалось отправить запрос. Попробуйте ещё раз.',
 new:'Запрос получен',search:'Подбираем для вас лучшие варианты',prep:'Готовим для вас предложение',offer:'Предложение готово',acc:'Согласие записано, уточняем детали у оператора',conf:'Рейс подтверждён',dec:'Запрос закрыт по вашему решению',none:'Сейчас подходящего варианта нет',late:'Запрос закрыт: истёк срок ответа',exp:'Срок предложения истёк',can:'Отменён',
 valid:'Действует до',incl:'Цена включает сборы',excl:'Сборы не включены',accept:'Принять предложение',decline:'Не подходит',accNote:'Это запись о намерении забронировать, а не подтверждённая бронь. Сначала мы уточним детали у оператора, затем вернёмся к вам.',confirm:'Подтверждаю согласие',back:'Назад',why:'Причина (по желанию)',decGo:'Отклонить предложение',accepted:'Согласие записано. Уточним детали у оператора и вернёмся к вам.',declined:'Ваше решение записано. Спасибо, что уделили время.',newReq:'Новый запрос на перелёт',cancel:'Отменить запрос',cancelQ:'Отменить этот запрос?',yours:'Ваши запросы',pass:'пасс.'}};
export const reqNav=(l:Lang)=>D[l].nav;

const GROUP:Record<string,string>={NEW_REQUEST:'new',SEARCHING:'search',OPERATOR_CONTACTED:'search',AWAITING_OFFER:'search',OFFER_RECEIVED:'prep',BROKER_REVIEW:'prep',PRESENTED:'offer',ACCEPTED:'acc',AWAITING_BOOKING:'acc',CONFIRMED:'conf',CLIENT_DECLINED:'dec',CLOSED_NO_SUPPLY:'none',CLOSED_NO_OPERATOR_REPLY:'none',CLOSED_NO_CLIENT_REPLY:'late',OFFER_EXPIRED:'exp',CANCELLED:'can'};
const FINAL=new Set(['CONFIRMED','CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED']);
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const LOC:Record<Lang,string>={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'};

function RequestForm({airports,t,onSent,onCancel}:{airports:Airport[];t:Record<string,string>;onSent:()=>void;onCancel?:()=>void}){
 const [o,setO]=useState(''),[d,setD]=useState(''),[date,setDate]=useState(''),[per,setPer]=useState(''),[px,setPx]=useState('1'),[bag,setBag]=useState(''),[ret,setRet]=useState(false),[note,setNote]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const send=async()=>{setErr('');
  if(!o||!d||!date){setErr(t.pick);return}if(o===d){setErr(t.same);return}if(date<today()){setErr(t.past);return}
  setBusy(true);
  try{const {data:{user}}=await sb.auth.getUser();if(!user)throw new Error('no session');
   const {error}=await sb.from('travel_requests').insert({customer_id:user.id,origin_code:o,destination_code:d,travel_date:date,departure_period:per||null,passengers:Math.min(40,Math.max(1,Number(px)||1)),baggage_note:bag.trim()||null,return_requested:ret,raw_text:note.trim()||null,channel:'in_app',parsed_by:'human'});
   if(error)throw error;onSent()}
  catch{setErr(t.err)}finally{setBusy(false)}};
 const opts=airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} · {a.iata}</option>);
 return <div className="add"><div className="f2">
  <div><label>{t.from}</label><select aria-label={t.from} value={o} onChange={e=>setO(e.target.value)}><option value="">{t.pick}</option>{opts}</select></div>
  <div><label>{t.to}</label><select aria-label={t.to} value={d} onChange={e=>setD(e.target.value)}><option value="">{t.pick}</option>{opts}</select></div>
  <div><label>{t.date}</label><input type="date" aria-label={t.date} min={today()} value={date} onChange={e=>setDate(e.target.value)}/></div>
  <div><label>{t.period}</label><select aria-label={t.period} value={per} onChange={e=>setPer(e.target.value)}><option value="">{t.any}</option>{['morning','noon','evening','night'].map(k=><option key={k} value={k}>{t[k]}</option>)}</select></div>
  <div><label>{t.pax}</label><input type="number" min={1} max={40} inputMode="numeric" aria-label={t.pax} value={px} onChange={e=>setPx(e.target.value)}/></div>
  <div><label>{t.bag}</label><input aria-label={t.bag} maxLength={200} value={bag} onChange={e=>setBag(e.target.value)}/></div></div>
  <label className="ck"><input type="checkbox" checked={ret} onChange={e=>setRet(e.target.checked)}/>{t.ret}</label>
  <div className="f2"><div style={{gridColumn:'1/-1'}}><label>{t.note}</label><input aria-label={t.note} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></div></div>
  {err&&<div className="nt" role="alert">{err}</div>}
  <div className="act"><button disabled={busy} onClick={send}>{busy?t.sending:t.send}</button>{onCancel&&<button className="g" onClick={onCancel}>{t.back}</button>}</div></div>;
}

const AP:Record<'ar'|'en',Record<string,string>>={
ar:{ask:'أرسل العرض لصاحب القرار',askS:'رابط آمن بلمسة موافقة',h:'رابط صاحب القرار',lab:'انسخ الرابط وأرسله بأي وسيلة',copy:'انسخ الرابط',copied:'تم النسخ',
 note:'الموافقة عبر الرابط تسجّل نية حجز فقط، وتمر على مراجعتنا قبل أي التزام مع المشغّل. لا نرسل بريدًا تلقائيًا، أنت من يرسل الرابط.',
 exp:'ينتهي الرابط',noAp:'حدّد صاحب القرار وبريده في «ملف الرحلة» أولًا.',err:'تعذّر إصدار الرابط. حاول مرة أخرى.',new:'أصدر رابطًا جديدًا (يلغي القديم)'},
en:{ask:'Send the offer to the decision-maker',askS:'Secure one-touch approval link',h:'Decision-maker link',lab:'Copy the link and send it any way you like',copy:'Copy link',copied:'Copied',
 note:'Approving through the link records a booking intent only, and we review it before any commitment with the operator. We do not send email automatically; you send the link.',
 exp:'Link expires',noAp:'Set the decision-maker and email in the Trip profile first.',err:'Could not issue the link. Try again.',new:'Issue a new link (cancels the old one)'}};
function ApprovalBox({offerId,lang}:{offerId:string;lang:Lang}){
 const t=AP[lang==='ar'?'ar':'en'];
 const [link,setLink]=useState(''),[exp,setExp]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[cp,setCp]=useState(false);
 const issue=async()=>{setBusy(true);setErr('');setCp(false);
  const {data,error}=await sb.rpc('request_approval_link',{p_client_offer:offerId,p_ttl_hours:24});
  setBusy(false);
  if(error||!data){setErr((error?.message??'').includes('approver')?t.noAp:t.err);return}
  const d=data as {token:string;expires_at:string};
  setLink(`${location.origin}/?view=approve#t=${d.token}`);setExp(new Date(d.expires_at).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'}))};
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setCp(true)}catch{const i=document.getElementById('ap-url') as HTMLInputElement|null;i?.select()}};
 return <div className="ap">
  {!link?<Switch small busy={busy} disabled={busy} label={t.ask} sub={t.askS} onActivate={issue}/>
  :<div className="ap-link"><label htmlFor="ap-url">{t.lab}</label><input id="ap-url" readOnly dir="ltr" value={link} onFocus={e=>e.currentTarget.select()}/>
   <div className="ap-acts"><Switch small label={cp?t.copied:t.copy} onActivate={copy}/><Switch small busy={busy} disabled={busy} label={t.new} onActivate={issue}/></div>
   <p className="dim sm">{t.exp}: {exp}</p></div>}
  {err&&<div className="nt" role="alert">{err}</div>}
  <p className="dim sm">{t.note}</p>
 </div>;
}

function OfferCard({offer,route,t,lang,reload}:{offer:MyOffer;route:ReactNode;t:Record<string,string>;lang:Lang;reload:()=>Promise<void>}){
 const [step,setStep]=useState<''|'accept'|'decline'>(''),[why,setWhy]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[res,setRes]=useState('');
 const open=offer.status==='PRESENTED',till=new Date(offer.valid_until).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'});
 const decide=async(accept:boolean)=>{setBusy(true);setErr('');
  const {error}=await sb.rpc('loop_customer_decide',{p_client_offer:offer.client_offer_id,p_accept:accept,p_reason:accept?null:(why.trim()||null)});
  setBusy(false);if(error){setErr(t.err);return}setRes(accept?t.accepted:t.declined);setStep('');await reload()};
 return <div className="rq-offer"><span className={`bf-rib${briefKind(offer.status)==='conf'?' o':''}`}>{briefLabel(offer.status,lang)}</span><p className="rt">{route}</p>
  <p className="rq-cab"><bdi>{offer.cabin_label}</bdi></p>
  <p className="rq-price" dir="ltr">{new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(offer.price)} <span>{offer.currency}</span></p>
  <p className="dim sm">{offer.fees_included?t.incl:t.excl}{offer.fees_note?<> · <bdi>{offer.fees_note}</bdi></>:null}</p>
  <TermsView coId={offer.client_offer_id}/>
  {open&&<p className="dim sm">{t.valid} {till}</p>}
  {!open&&<p className="dim">{t.acc}</p>}
  {res&&<div className="nt e" role="status">{res}</div>}{err&&<div className="nt" role="alert">{err}</div>}
  {open&&!res&&step===''&&<ApprovalBox offerId={offer.client_offer_id} lang={lang}/>}
  {open&&!res&&(step===''?<div className="act" style={{justifyContent:'center'}}><button onClick={()=>setStep('accept')}>{t.accept}</button><button className="g" onClick={()=>setStep('decline')}>{t.decline}</button></div>
   :step==='accept'?<><div className="nt e">{t.accNote}</div><div className="act" style={{justifyContent:'center'}}><button disabled={busy} onClick={()=>decide(true)}>{t.confirm}</button><button className="g" disabled={busy} onClick={()=>setStep('')}>{t.back}</button></div></>
   :<><div className="act"><input aria-label={t.why} placeholder={t.why} maxLength={300} value={why} onChange={e=>setWhy(e.target.value)}/></div><div className="act" style={{justifyContent:'center'}}><button className="g" disabled={busy} onClick={()=>decide(false)}>{t.decGo}</button><button className="g" disabled={busy} onClick={()=>setStep('')}>{t.back}</button></div></>)}
 </div>;
}

export default function Requests({airports,my,nm}:{airports:Airport[];my:My;nm:(c:string)=>string}){
 const {lang}=useI18n();const t=D[lang];
 const {reqs,offers,loaded,reload}=my;
 const [adding,setAdding]=useState(false),[sent,setSent]=useState(false),[sel,setSel]=useState(0),[err,setErr]=useState('');
 const live=offers.filter(o=>o.status==='PRESENTED'),shown=live.length?live:offers,off=shown[Math.min(sel,Math.max(0,shown.length-1))];
 const rq=(id:string)=>reqs.find(r=>r.id===id);
 const rt=(r:{origin_code:string|null;destination_code:string|null}|undefined)=>r&&r.origin_code&&r.destination_code?<Route from={nm(r.origin_code)} to={nm(r.destination_code)}/>:null;
 const del=async(id:string)=>{if(!window.confirm(t.cancelQ))return;setErr('');const {error}=await sb.rpc('cancel_travel_request',{p_id:id});if(error)setErr(t.err);await reload()};
 const none=loaded&&!reqs.length&&!offers.length;
 const head=live.length?t.offerH:reqs.length?t.reqH:t.askH;
 return <>
  <Glyph k={live.length?'star':reqs.length?'lens':'air'} s={64}/>
  <h2 className="big">{head}</h2>
  {sent&&<div className="nt e" role="status">{t.sent}</div>}
  {off&&<>{shown.length>1&&<BriefTicker loop={shown.length>=3} sel={Math.min(sel,shown.length-1)} onSel={setSel} fmt={v=>new Date(v).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short'})} cards={shown.map(o=>({id:o.client_offer_id,route:rt(rq(o.request_id)),cabin:o.cabin_label,price:o.price,currency:o.currency,status:o.status,until:o.valid_until}))}/>}
   <OfferCard key={off.client_offer_id} offer={off} route={rt(rq(off.request_id))} t={t} lang={lang} reload={reload}/></>}
  {reqs.length>0&&<><p className="dim sm">{t.yours}</p><ul>{reqs.map(r=><li key={r.id}><span>{rt(r)}{r.travel_date?` · ${new Date(r.travel_date).toLocaleDateString(LOC[lang],{dateStyle:'medium'})}`:''}</span>
   <b>{t[GROUP[r.loop_status]??'new']}</b>
   {!FINAL.has(r.loop_status)&&<button className="g sm" onClick={()=>del(r.id)}>{t.cancel}</button>}
   {!FINAL.has(r.loop_status)&&r.origin_code&&r.destination_code&&r.travel_date&&<FlexLegs requestId={r.id} nm={nm}/>}</li>)}</ul></>}
  {err&&<div className="nt" role="alert">{err}</div>}
  {(none||adding)?<RequestForm airports={airports} t={t} onSent={async()=>{setAdding(false);setSent(true);await reload()}} onCancel={adding?()=>setAdding(false):undefined}/>
   :<button className="g" onClick={()=>{setSent(false);setAdding(true)}}>{t.newReq}</button>}
 </>;
}
