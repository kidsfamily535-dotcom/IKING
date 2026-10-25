import {useEffect,useMemo,useState} from 'react';
import './cinema.css';import './request.css';
import {useI18n} from '../i18n';
import LangSwitch from '../LangSwitch';
import {HUBS,hub,dist,flightMin,rangeFor} from '../cabin/geo';
import {copy} from '../cabin/copy';
import Radar from '../cabin/Radar';
import {useFleet} from '../cabin/media';
import MS from './missions.json';
// طلب رحلة حقيقي على نهج منصات الطيران الخاص: الرحلة أولًا (النوع، المسار، الموعد، الركاب)، ثم تفضيلات اختيارية، ثم وسيلة الرد في آخر خطوة.
// لا اسم ولا قناة تواصل إجبارية: حقل واحد يقبل بريدًا أو رقمًا ونتعرّف على نوعه. الرادار حاضر طوال الرحلة ويرسم المسار فور اختياره.
// يصل الطلب إلى إنسان من الفريق، ولا يُعرض فيه طائرة ولا سعر لم يتأكدا.
const BASE=import.meta.env.VITE_SUPABASE_URL??'https://yiklciblxwymcxxszkty.supabase.co';
type Win='am'|'noon'|'pm'|'flex';type Kind='one'|'round'|'multi';type Cab=''|'light'|'mid'|'large';type Leg={to:string|null;date:string};
const C:Record<string,Record<string,string>>={
 ar:{sub0:'نرصد لك الفرص، نحلل لك الخيارات، ونقترح الأفضل لرحلتك.',hint0:'أضف تفاصيل أكثر لتحصل على أفضل النتائج.',ms_h:'ما هدف رحلتك؟',ms_sub:'اختياري. اختر ما ينطبق (حتى 3) ليتغيّر ما تراقبه العين وما تسألك عنه. لا نفترض شيئًا لم تقله.',ms_priv:'أفضّل ألا أفصح',ms_cond:'ظروف تخص رحلتك',ms_cond_sub:'اختياري. تُضاف إلى الهدف ولا تغيّر سببه.',ms_watch:'ما ستهتم به العين',ms_ask:'سؤال من العين (اختياري)',ms_askph:'اكتب إجابتك إن شئت',ms_pri:'الرئيسية',ms_sel:'اخترت',ms_spec:'هذا النوع يُحوَّل إلى مسار متخصص مع مزوّد مؤهل ولا يُعامَل كتشارتر عادي. سيتواصل معك إنسان من الفريق.',ms_note:'نسجّل ما تصرّح به أنت فقط، ولا نستنتج سبب سفرك.',name:'عين الملك',h0:'أين تريد أن تطير؟',to:'إلى أين؟',from:'من',ph:'اكتب المدينة',none:'لا نجد هذه المدينة.',no:'هذه الوجهة غير متاحة للطلب حاليًا.',pickTo:'اختر الوجهة',swap:'عكس المسار',
  one:'ذهاب',round:'ذهاب وعودة',multi:'عدة وجهات',date:'تاريخ الذهاب',ret:'تاريخ العودة',who:'المسافرون',am:'صباحًا',noon:'ظهرًا',pm:'مساءً',flex:'مرن',leg:'المرحلة',addLeg:'أضف مرحلة',del:'حذف',next:'متابعة',
  h1:'هل من تفضيلات؟',sub1:'كله اختياري. اترك ما لا يهمّك.',cab:'فئة الطائرة',any:'أي فئة',light:'خفيفة',mid:'متوسطة',large:'كبيرة',ext:'ما تحتاجه',pets:'حيوان أليف',bags:'أمتعة كبيرة',wifi:'إنترنت',food:'تموين',ground:'نقل أرضي',notePh:'أي شيء آخر نعرفه عن رحلتك (اختياري)',skip:'تخطَّ',
  reach:'بريد إلكتروني أو رقم هاتف',wa:'هذا الرقم عليه واتساب',anon:'بدون اسم',trip:'رحلتك',ap_h:'طائرات تناسب رحلتك',ap_sub:'أنواع مناسبة لعدد الركاب والمسافة. لا نعرف بعد أيها متاح ولا سعره، نتأكد من المشغّل بعد طلبك.',ap_up:'حتى {n} ركاب',ap_time:'زمن الطيران نحو {t} (تقدير)',ap_st:'نوع مناسب · التوفر يؤكده المشغّل',ap_pick:'يعجبني هذا النوع',ap_none:'لا يوجد في مراجعنا نوع مناسب لهذه المواصفات. أرسل طلبك وسيبحث الفريق بنفسه.',ap_relax:'لا نوع بالفئة التي اخترتها يناسب الرحلة. هذه أقرب الأنواع المناسبة.',ap_fav:'نوع مفضّل',cabin:'الكابينة'},
 en:{sub0:'We watch for opportunities, weigh your options and suggest the best for your trip.',hint0:'Add more details to get the best results.',ms_h:'What is this trip for?',ms_sub:'Optional. Pick what applies (up to 3) so the Eye adapts what it watches and what it asks. We assume nothing you haven’t said.',ms_priv:'I’d rather not say',ms_cond:'Conditions of your trip',ms_cond_sub:'Optional. They add to the purpose and never change it.',ms_watch:'What the Eye will focus on',ms_ask:'A question from the Eye (optional)',ms_askph:'Answer if you wish',ms_pri:'Main',ms_sel:'Selected',ms_spec:'This type is routed to a specialised path with a qualified provider and is not handled as an ordinary charter. A person from the team will contact you.',ms_note:'We record only what you declare and never infer why you travel.',name:'The King’s Eye',h0:'Where would you like to fly?',to:'Where to?',from:'From',ph:'Type a city',none:'We can’t find that city.',no:'This route can’t be requested yet.',pickTo:'Choose destination',swap:'Swap route',
  one:'One way',round:'Round trip',multi:'Multi-leg',date:'Departure date',ret:'Return date',who:'Travellers',am:'Morning',noon:'Afternoon',pm:'Evening',flex:'Flexible',leg:'Leg',addLeg:'Add a leg',del:'Remove',next:'Continue',
  h1:'Any preferences?',sub1:'All optional. Leave out what doesn’t matter.',cab:'Aircraft category',any:'Any',light:'Light',mid:'Midsize',large:'Large',ext:'What you need',pets:'Pet on board',bags:'Large baggage',wifi:'Wi‑Fi',food:'Catering',ground:'Ground transfer',notePh:'Anything else we should know (optional)',skip:'Skip',
  reach:'Email or phone number',wa:'This number is on WhatsApp',anon:'No name given',trip:'Your trip',ap_h:'Aircraft that suit your trip',ap_sub:'Types that fit your passengers and distance. We don’t yet know which are available or at what price. We check with the operator after your request.',ap_up:'Up to {n} passengers',ap_time:'Flight time about {t} (estimate)',ap_st:'Suitable type · availability confirmed by the operator',ap_pick:'I like this type',ap_none:'None of our reference types fit these requirements. Send your request and the team will search.',ap_relax:'No type in your chosen category fits this trip. These are the closest suitable types.',ap_fav:'Preferred type',cabin:'Cabin'},
 ru:{sub0:'Мы следим за возможностями, анализируем варианты и предлагаем лучшее для вашей поездки.',hint0:'Добавьте детали, чтобы получить лучший результат.',ms_h:'Какова цель поездки?',ms_sub:'Необязательно. Выберите подходящее (до 3), чтобы Око подстроило, за чем следить и о чём спросить. Мы ничего не предполагаем.',ms_priv:'Предпочту не уточнять',ms_cond:'Условия поездки',ms_cond_sub:'Необязательно. Дополняют цель, не меняя её.',ms_watch:'На чём сосредоточится Око',ms_ask:'Вопрос от Ока (необязательно)',ms_askph:'Ответьте, если хотите',ms_pri:'Основная',ms_sel:'Выбрано',ms_spec:'Этот тип передаётся по специальному маршруту квалифицированному поставщику и не оформляется как обычный чартер. С вами свяжется сотрудник команды.',ms_note:'Мы записываем только то, что вы сами указали, и не додумываем причину поездки.',name:'Око Короля',h0:'Куда вы хотите лететь?',to:'Куда?',from:'Откуда',ph:'Введите город',none:'Такой город не найден.',no:'Этот маршрут пока недоступен для запроса.',pickTo:'Выберите пункт назначения',swap:'Поменять местами',
  one:'В одну сторону',round:'Туда и обратно',multi:'Несколько этапов',date:'Дата вылета',ret:'Дата возвращения',who:'Пассажиры',am:'Утро',noon:'День',pm:'Вечер',flex:'Гибко',leg:'Этап',addLeg:'Добавить этап',del:'Удалить',next:'Далее',
  h1:'Есть пожелания?',sub1:'Всё необязательно. Пропустите ненужное.',cab:'Класс самолёта',any:'Любой',light:'Лёгкий',mid:'Средний',large:'Большой',ext:'Что нужно',pets:'Питомец на борту',bags:'Крупный багаж',wifi:'Wi‑Fi',food:'Питание',ground:'Трансфер',notePh:'Что ещё нам стоит знать (необязательно)',skip:'Пропустить',
  reach:'Эл. почта или телефон',wa:'На этом номере есть WhatsApp',anon:'Имя не указано',trip:'Ваша поездка',ap_h:'Самолёты для вашей поездки',ap_sub:'Типы, подходящие по числу пассажиров и дальности. Мы пока не знаем, какие свободны и по какой цене. Уточним у оператора после вашего запроса.',ap_up:'До {n} пассажиров',ap_time:'Время в полёте около {t} (оценка)',ap_st:'Подходящий тип · наличие подтверждает оператор',ap_pick:'Мне нравится этот тип',ap_none:'В нашем справочнике нет подходящего типа. Отправьте запрос, команда поищет сама.',ap_relax:'В выбранной категории нет подходящего типа. Вот ближайшие подходящие.',ap_fav:'Предпочтительный тип',cabin:'Салон'},
 tr:{sub0:'Fırsatları izler, seçenekleri analiz eder ve yolculuğunuz için en iyisini öneririz.',hint0:'En iyi sonuçlar için daha fazla ayrıntı ekleyin.',ms_h:'Yolculuğun amacı nedir?',ms_sub:'İsteğe bağlı. Geçerli olanları seçin (en fazla 3); Göz neye bakacağını ve ne soracağını buna göre ayarlar. Söylemediğiniz hiçbir şeyi varsaymayız.',ms_priv:'Belirtmek istemiyorum',ms_cond:'Yolculuğunuzun koşulları',ms_cond_sub:'İsteğe bağlı. Amaca eklenir, onu değiştirmez.',ms_watch:'Gözün odaklanacağı şeyler',ms_ask:'Gözden bir soru (isteğe bağlı)',ms_askph:'İsterseniz yanıtlayın',ms_pri:'Ana',ms_sel:'Seçilen',ms_spec:'Bu tür, nitelikli bir sağlayıcıyla özel bir yola yönlendirilir; sıradan çarter gibi ele alınmaz. Ekipten biri sizinle iletişime geçecek.',ms_note:'Yalnızca sizin belirttiğinizi kaydederiz, seyahat nedeninizi tahmin etmeyiz.',name:'Kralın Gözü',h0:'Nereye uçmak istersiniz?',to:'Nereye?',from:'Nereden',ph:'Şehir yazın',none:'Bu şehri bulamadık.',no:'Bu rota için henüz talep alınamıyor.',pickTo:'Varış noktasını seçin',swap:'Rotayı çevir',
  one:'Tek yön',round:'Gidiş dönüş',multi:'Çok etaplı',date:'Gidiş tarihi',ret:'Dönüş tarihi',who:'Yolcular',am:'Sabah',noon:'Öğle',pm:'Akşam',flex:'Esnek',leg:'Etap',addLeg:'Etap ekle',del:'Kaldır',next:'Devam',
  h1:'Tercihleriniz var mı?',sub1:'Hepsi isteğe bağlı. Önemsemediklerinizi boş bırakın.',cab:'Uçak sınıfı',any:'Fark etmez',light:'Hafif',mid:'Orta',large:'Büyük',ext:'İhtiyaçlarınız',pets:'Evcil hayvan',bags:'Büyük bagaj',wifi:'İnternet',food:'İkram',ground:'Karada transfer',notePh:'Bilmemiz gereken başka bir şey (isteğe bağlı)',skip:'Atla',
  reach:'E‑posta veya telefon numarası',wa:'Bu numarada WhatsApp var',anon:'İsim belirtilmedi',trip:'Yolculuğunuz',ap_h:'Yolculuğunuza uygun uçaklar',ap_sub:'Yolcu sayınıza ve mesafeye uyan tipler. Hangisinin müsait olduğunu ve fiyatını henüz bilmiyoruz. Talebinizden sonra operatörden teyit alırız.',ap_up:'En fazla {n} yolcu',ap_time:'Uçuş süresi yaklaşık {t} (tahmin)',ap_st:'Uygun tip · müsaitliği operatör teyit eder',ap_pick:'Bu tip hoşuma gitti',ap_none:'Referans tiplerimizde bu ihtiyaca uyan yok. Talebi gönderin, ekip kendisi arasın.',ap_relax:'Seçtiğiniz sınıfta uygun tip yok. En yakın uygun tipler bunlar.',ap_fav:'Tercih edilen tip',cabin:'Kabin'}
};
const norm=(s:string)=>s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
const TIME:Record<Win,string>={am:'09:00',noon:'13:00',pm:'18:00',flex:'مرن'};
const PERIOD:Record<Win,string>={am:'morning',noon:'afternoon',pm:'evening',flex:'flexible'};
// تسميات الملاحظة عربية دائمًا لأن من يقرؤها هو الفريق
const KIND_AR:Record<Kind,string>={one:'ذهاب فقط',round:'ذهاب وعودة',multi:'عدة وجهات'};
const CAB_AR:Record<string,string>={light:'خفيفة',mid:'متوسطة',large:'كبيرة'};
const EXT=['pets','bags','wifi','food','ground'] as const;
const EXT_AR:Record<string,string>={pets:'حيوان أليف',bags:'أمتعة كبيرة',wifi:'إنترنت',food:'تموين',ground:'نقل أرضي'};
type Ln={[k:string]:string};type Ms={id:number;g:string;f:string;route?:string;n:Ln;d:Ln};type Tr={id:number;f?:string;route?:string;n:Ln;e:Ln};
type Fam={opt:Ln;q:Ln;limit?:Ln};
const MISS=MS.missions as Ms[],TRAITS=MS.traits as Tr[],FAMS=MS.families as Record<string,Fam>,GROUPS=MS.groups as {id:string;n:Ln}[];
const MAX_M=3;
const MAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,TEL=/^\+?[0-9]{7,15}$/;
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
type Pick=null|'from'|'to'|number;
export default function Request(){
 const {lang,t}=useI18n(),c=C[lang]||C.en,rc=copy(lang),ar=lang==='ar',arrow=ar?'←':'→';
 const nm=(i:string)=>{const h=HUBS.find(x=>x.iata===i);return h?(ar?h.ar:h.en):i};
 const [step,setStep]=useState(0),[kind,setKind]=useState<Kind>('one'),[from,setFrom]=useState('RUH'),[to,setTo]=useState<string|null>(null),[pick,setPick]=useState<Pick>(null),[q,setQ]=useState('');
 const [date,setDate]=useState(()=>iso(Date.now()+864e5)),[retDate,setRetDate]=useState(()=>iso(Date.now()+864e5*4)),[win,setWin]=useState<Win>('am'),[guests,setGuests]=useState(2),[legs,setLegs]=useState<Leg[]>([]);
 const [fav,setFav]=useState(''),[cab,setCab]=useState<Cab>(''),[ext,setExt]=useState<string[]>([]),[note,setNote]=useState('');
 const [cv,setCv]=useState(''),[wa,setWa]=useState(false),[agree,setAgree]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[aps,setAps]=useState<string[]>([]);
 const [plane,setPlane]=useState(1);
 const [ms,setMs]=useState<number[]>([]),[cd,setCd]=useState<number[]>([]),[priv,setPriv]=useState(false),[grp,setGrp]=useState('A'),[ans,setAns]=useState('');
 useEffect(()=>{let live=true;fetch(`${BASE}/functions/v1/submit-request`).then(r=>r.ok?r.json():null).then(j=>{if(live&&j?.airports)setAps(j.airports.map((a:any)=>a.iata_code))}).catch(()=>{});return()=>{live=false}},[]);
 // وجهة وصلت من الرابط ?to=LON
 useEffect(()=>{const x=new URLSearchParams(location.search).get('to');if(x&&x!=='RUH'&&HUBS.some(h=>h.iata===x))setTo(x)},[]);
 // الطائرة تمشي على المسار كلما اختير مسار جديد
 useEffect(()=>{if(!to){setPlane(1);return}if(calm()){setPlane(1);return}setPlane(0);const t0=performance.now();let raf=0;
  const tick=(n:number)=>{const k=Math.min(1,(n-t0)/2600);setPlane(1-Math.pow(1-k,3));if(k<1)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[from,to]);
 const chain=useMemo(()=>[from,...(kind==='multi'?legs.map(l=>l.to):[to])] ,[from,to,legs,kind]);
 const outside=aps.length>0&&(!aps.includes(from)||(to!==null&&!aps.includes(to))||(kind==='multi'&&legs.some(l=>l.to&&!aps.includes(l.to))));
 const skip=pick==='from'?to:pick==='to'?from:null;
 const list=useMemo(()=>{const n=norm(q);return HUBS.filter(h=>h.iata!==skip&&(!n||norm(h.ar).includes(n)||norm(h.en).includes(n)||h.iata.toLowerCase()===n)).sort((a,b)=>a.pri-b.pri).slice(0,n?6:7)},[q,skip]);
 const choose=(i:string)=>{
  if(pick==='from'){if(i===to)setTo(null);setFrom(i)}
  else if(pick==='to')setTo(i)
  else if(typeof pick==='number')setLegs(l=>l.map((x,k)=>k===pick?{...x,to:i}:x));
  setPick(null);setQ('')};
 const radarTap=(i:string)=>{if(i===from)return;if(pick==='from'){choose(i);return}setTo(i);if(pick!==null){setPick(null);setQ('')}};
 const swap=()=>{if(!to)return;setFrom(to);setTo(from)};
 const addLeg=()=>setLegs(l=>l.length<3?[...l,{to:null,date:l.length?l[l.length-1].date:date}]:l);
 const fmt=(d:string)=>new Intl.DateTimeFormat(ar?'ar-u-nu-latn':lang,{day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
 const looksTel=cv.trim()!==''&&!cv.includes('@'),isMail=MAIL.test(cv.trim()),isTel=TEL.test(cv.replace(/[\s\-()]/g,''));
 const tripOk=!!to&&!outside&&(kind!=='round'||retDate>=date)&&(kind!=='multi'||(legs.length>0&&legs.every(l=>l.to)));
 const ok=(isMail||isTel)&&agree;
const L=(o?:Ln)=>o?(o[lang]||o.en||o.ar||''):'';
 const mOf=(id:number)=>MISS.find(x=>x.id===id),tOf=(id:number)=>TRAITS.find(x=>x.id===id);
 const prim=ms.length?mOf(ms[0]):undefined;
 const famIds=Array.from(new Set([...ms.map(i=>mOf(i)?.f),...cd.map(i=>tOf(i)?.f)].filter((x):x is string=>!!x)));
 const special=ms.some(i=>mOf(i)?.route)||cd.some(i=>tOf(i)?.route);
 const togM=(id:number)=>{setPriv(false);setMs(a=>a.includes(id)?a.filter(x=>x!==id):a.length<MAX_M?[...a,id]:a)};
 const togC=(id:number)=>setCd(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const noteText=()=>{const p:string[]=['request',TIME[win],KIND_AR[kind]];
  if(priv)p.push('الهدف: لم يُفصح');else if(ms.length)p.push('الهدف: '+ms.map(i=>mOf(i)?.n.ar).join(' + '));
  if(cd.length)p.push('ظروف: '+cd.map(i=>tOf(i)?.n.ar).join('، '));
  if(special)p.push('مسار متخصص (طبي/شحن): يتطلب مزوّدًا مؤهلًا');
  if(ans.trim())p.push('جواب العميل: '+ans.trim().replace(/\s+/g,' ').slice(0,110));
  if(kind==='multi')legs.forEach((l,k)=>{if(l.to)p.push(`مرحلة ${k+2}: ${chain[k+1]}→${l.to} ${l.date}`)});
  if(cab)p.push('الفئة: '+CAB_AR[cab]);if(ext.length)p.push('إضافات: '+ext.map(x=>EXT_AR[x]).join('، '));
  if(fav)p.push(c.ap_fav+': '+fav);
  if(note.trim())p.push('ملاحظة: '+note.trim().replace(/\s+/g,' '));return p.join(' | ').slice(0,490)};
 const send=async()=>{if(!to||!ok||busy)return;setErr('');setBusy(true);
  const p=new URLSearchParams(location.search),SRC=['HOTEL','TRAVEL_AGENCY','CONCIERGE','YACHT_BROKER','CORPORATE','OTHER'],src=(p.get('src')||'').toUpperCase();
  const channel=isMail?'email':wa?'whatsapp':'phone';
  try{const r=await fetch(`${BASE}/functions/v1/submit-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact_name:c.anon,contact_channel:channel,contact_value:cv.trim(),origin_code:from,destination_code:to,travel_date:date,return_date:kind==='round'?retDate:undefined,departure_period:PERIOD[win],passengers:guests,note:noteText(),consent:true,source:SRC.includes(src)?src:'DIRECT',referral_partner:p.get('ref')||undefined,campaign:p.get('campaign')||'cabin'})});
   if(r.ok){setStep(5);return}
   const j=await r.json().catch(()=>({}));setErr(r.status===429?t('ask.err.limit'):j?.field?t('ask.err.field',{x:j.field}):t('ask.err.generic'))
  }catch{setErr(t('ask.err.generic'))}finally{setBusy(false)}};
 const again=()=>{setStep(0);setKind('one');setTo(null);setFrom('RUH');setGuests(2);setLegs([]);setCab('');setFav('');setExt([]);setNote('');setMs([]);setCd([]);setPriv(false);setAns('');setGrp('A');setCv('');setWa(false);setAgree(false);setErr('')};
 const route=to?`${nm(from)} ${arrow} ${nm(to)}`:'';
 // الرادار: يتمركز على المنطلق، ويرسم المسار الأول، ويقبل لمس مدينة لاختيارها
 const F=hub(from),D=to?hub(to):null,km=D?dist(F,D):null,mm=km?flightMin(km):0;
 const dur=mm<60?`${mm} ${rc.units.m}`:`${Math.floor(mm/60)} ${rc.units.h} ${String(mm%60).padStart(2,'0')} ${rc.units.m}`;
 const hud=D&&km?rc.ask.read(nm(from),nm(D.iata),(Math.round(km/10)*10).toLocaleString('en'),dur):rc.ask.tapTo;
 // الطائرات المناسبة: قيدان إلزاميان فقط (عدد الركاب والمدى) من مراجع الأنواع. هذا تناسب وليس توفرًا، ولا سعر هنا أبدًا.
 const fleet=useFleet();
 const SPEC:Record<string,[number,number]>={LIGHT:[6,3500],MID:[8,5000],SUPER:[10,7000],LARGE:[14,9000],ULR:[16,12000]};
 const all=Object.keys(SPEC).map(cat=>{const m=fleet[cat];return{cat,name:m?.name||cat,img:m?.img||null,pax:m?.pax??SPEC[cat][0],rng:m?.rangeKm??SPEC[cat][1],len:m?.len??null}});
 const need=(km??0)*1.1,suit=all.filter(o=>o.pax>=guests&&o.rng>=need);
 const CABS:Record<string,string[]>={light:['LIGHT'],mid:['MID','SUPER'],large:['LARGE','ULR']};
 const pref=cab?suit.filter(o=>CABS[cab].includes(o.cat)):suit,relaxed=!!cab&&pref.length===0&&suit.length>0,fit=(pref.length?pref:suit).slice(0,4);
 const radar=<aside className="rq-radar" aria-label={rc.gl.radar}><Radar hubs={HUBS} from={from} to={to} hover={null} name={h=>nm(h.iata)} range={rangeFor(km)} blips={[]} scanning={step===5} plane={to?plane:null} alt={null} hud={hud} aria={rc.gl.radar} kmUnit={rc.units.km} onHover={()=>{}} onPick={radarTap} onBlip={()=>{}}/></aside>;
 const City=({label,value,onClick}:{label:string;value:string|null;onClick:()=>void})=><button type="button" className={`rq-city${value?'':' empty'}`} onClick={onClick}><small>{label}</small><span>{value?nm(value):c.pickTo}</span></button>;
 const picker=<>
  <h1 className="rq-h s">{pick==='from'?c.from:c.to}</h1>
  <input className="rq-in big" value={q} placeholder={c.ph} autoComplete="off" autoFocus aria-label={c.ph} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&list[0])choose(list[0].iata)}}/>
  {list.length?<ul className="rq-list">{list.map(h=><li key={h.iata}><button type="button" onClick={()=>choose(h.iata)}>{ar?h.ar:h.en}</button></li>)}</ul>:<p className="rq-note">{c.none}</p>}
  <button type="button" className="rq-link" onClick={()=>{setPick(null);setQ('')}}>{t('ask.back')}</button></>;
 const seg=(items:[string,string][],val:string,on:(k:string)=>void,label:string,cls='')=><div className={'rq-seg'+(cls?' '+cls:'')} role="radiogroup" aria-label={label}>{items.map(([k,l])=><button key={k} type="button" role="radio" aria-checked={val===k} onClick={()=>on(k)}>{l}</button>)}</div>;
 return <div className={`rq cn${ar?' ar':''}`} dir={ar?'rtl':'ltr'} lang={lang}>
  <div className="rq-bg" aria-hidden="true"/><div className="cn-shade" aria-hidden="true"/><div className="cn-grain" aria-hidden="true"/>
  <LangSwitch/>
  <header className="rq-top"><a className="rq-brand" href="/"><svg viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C9 2 31 2 38 12 31 22 9 22 2 12Z" fill="none" stroke="#d9bf86" strokeWidth="1.2"/><circle cx="20" cy="12" r="4.6" fill="#d9bf86"/><circle cx="20" cy="12" r="1.8" fill="#02040a"/></svg><span>{c.name}<small>PRIVATE AVIATION INTELLIGENCE</small></span></a>
   {step<5&&<ol className="rq-prog" aria-label={`${[0,2,3,4].indexOf(step)+1}/4`}>{[0,2,3,4].map(i=><li key={i} className={i<=step?'on':''}/>)}</ol>}</header>
  <div className="rq-wrap">
  {radar}
  <main className="rq-main" key={step+'-'+(pick===null?'f':'p')}>
   {pick!==null&&step===0?picker:<>
   {step===0&&<>
    <span className="rq-kicker">{c.name}</span>
    <h1 className="rq-h s">{c.h0}</h1>
    <p className="rq-sub">{c.sub0}</p>
    <div className="rq-panel">
    {seg([['one',c.one],['round',c.round],['multi',c.multi]],kind,k=>{setKind(k as Kind);if(k==='multi'&&!legs.length)setLegs([{to:null,date}])},c.trip)}
    <div className="rq-route-row"><City label={c.from} value={from} onClick={()=>{setPick('from');setQ('')}}/>
     <button type="button" className="rq-swap" onClick={swap} disabled={!to} aria-label={c.swap}>⇄</button>
     <City label={c.to} value={to} onClick={()=>{setPick('to');setQ('')}}/></div>
    {outside&&<p className="rq-note" role="alert">{c.no}</p>}
    <label className="rq-row"><span>{c.date}</span><input className="rq-in" type="date" value={date} min={iso(Date.now())} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
    {seg([['am',c.am],['noon',c.noon],['pm',c.pm],['flex',c.flex]],win,k=>setWin(k as Win),c.date)}
    {kind==='round'&&<label className="rq-row"><span>{c.ret}</span><input className="rq-in" type="date" value={retDate} min={date} onChange={e=>e.target.value&&setRetDate(e.target.value)}/></label>}
    {kind==='multi'&&legs.map((l,k)=><div className="rq-leg" key={k}><span className="rq-legn">{c.leg} {k+2}</span>
     <City label={nm(chain[k]||from)} value={l.to} onClick={()=>{setPick(k);setQ('')}}/>
     <input className="rq-in" type="date" aria-label={c.date} value={l.date} min={k?legs[k-1].date:date} onChange={e=>e.target.value&&setLegs(a=>a.map((x,j)=>j===k?{...x,date:e.target.value}:x))}/>
     <button type="button" className="rq-x" aria-label={c.del} onClick={()=>setLegs(a=>a.filter((_,j)=>j!==k))}>×</button></div>)}
    {kind==='multi'&&legs.length<3&&<button type="button" className="rq-link" onClick={addLeg}>+ {c.addLeg}</button>}
    <div className="rq-row"><span id="rq-w">{c.who}</span><div className="rq-step" role="group" aria-labelledby="rq-w"><button type="button" aria-label="−" disabled={guests<=1} onClick={()=>setGuests(g=>Math.max(1,g-1))}>−</button><output>{guests}</output><button type="button" aria-label="+" disabled={guests>=19} onClick={()=>setGuests(g=>Math.min(19,g+1))}>+</button></div></div>
    <button type="button" className="cn-btn main rq-go" disabled={!tripOk} onClick={()=>setStep(2)}>{c.next}</button>
    </div>
    <p className="rq-hint">{c.hint0}</p>
   </>}
   {step===2&&<>
    <p className="rq-route">{route} · {fmt(date)} · {guests}</p><h1 className="rq-h s">{c.h1}</h1><p className="rq-note first">{c.sub1}</p>
    <div className="rq-cap">{c.cab}</div>
    {seg([['',c.any],['light',c.light],['mid',c.mid],['large',c.large]],cab,k=>setCab(k as Cab),c.cab)}
    <div className="rq-cap">{c.ext}</div>
    <div className="rq-chips" role="group" aria-label={c.ext}>{EXT.map(k=><button key={k} type="button" aria-pressed={ext.includes(k)} onClick={()=>setExt(a=>a.includes(k)?a.filter(x=>x!==k):[...a,k])}>{c[k]}</button>)}</div>
    <input className="rq-in" value={note} maxLength={200} placeholder={c.notePh} aria-label={c.notePh} onChange={e=>setNote(e.target.value)}/>
    <button type="button" className="cn-btn main rq-go" onClick={()=>setStep(3)}>{c.next}</button>
    <button type="button" className="rq-link" onClick={()=>setStep(3)}>{c.skip}</button>
    <button type="button" className="rq-link" onClick={()=>setStep(0)}>{t('ask.back')}</button>
   </>}
   {step===3&&<>
    <p className="rq-route">{route} · {fmt(date)} · {guests}</p><h1 className="rq-h s">{c.ap_h}</h1><p className="rq-note first">{c.ap_sub}</p>
    {fit.length===0?<p className="rq-note">{c.ap_none}</p>:<>{relaxed&&<p className="rq-note">{c.ap_relax}</p>}
     <ul className="rq-fleet">{fit.map(o=><li key={o.cat}><button type="button" className="rq-ac" aria-pressed={fav===o.name} onClick={()=>setFav(f=>f===o.name?'':o.name)}>
      <span className="rq-acimg">{o.img?<img src={o.img} alt="" loading="lazy" decoding="async"/>:<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C9 2 31 2 38 12 31 22 9 22 2 12Z" fill="none" stroke="#d9bf86" strokeWidth="1"/></svg>}</span>
      <span className="rq-acb"><b>{rc.opt.cat[o.cat]||o.cat}</b><em>{o.name}</em>
       <small>{c.ap_up.replace('{n}',String(o.pax))}{o.len?` · ${c.cabin} ${o.len} m`:''}</small>
       <small>{c.ap_time.replace('{t}',dur)}</small><i className="rq-acst">{c.ap_st}</i></span>
      <span className="rq-acpick">{fav===o.name?'✓ ':''}{c.ap_pick}</span></button></li>)}</ul></>}
    <button type="button" className="cn-btn main rq-go" onClick={()=>setStep(4)}>{c.next}</button>
    <button type="button" className="rq-link" onClick={()=>setStep(2)}>{t('ask.back')}</button>
   </>}
   {step===4&&<>
    <p className="rq-route">{route} · {fmt(date)} · {guests}</p><h1 className="rq-h s">{t('ask.contactT')}</h1>
    <label className="rq-row col"><span>{c.reach}</span><input className="rq-in" dir="ltr" autoFocus inputMode={looksTel?'tel':'email'} value={cv} maxLength={120} autoComplete="email" placeholder="name@example.com · +966…" onChange={e=>setCv(e.target.value)}/></label>
    {looksTel&&<div className="rq-chips"><button type="button" aria-pressed={wa} onClick={()=>setWa(v=>!v)}>{c.wa}</button></div>}
    <label className="rq-agree"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><i aria-hidden="true"/><span>{t('ask.consent')}</span></label>
    <p className="rq-note">{t('ask.contactSub')}</p>
    {err&&<p className="rq-note bad" role="alert">{err}</p>}
    <button type="button" className="cn-btn main rq-go" disabled={!ok||busy} aria-busy={busy||undefined} onClick={send}>{t('ask.submit')}</button>
    <button type="button" className="rq-link" onClick={()=>setStep(3)}>{t('ask.back')}</button>
   </>}
   {step===5&&<>
    <svg className="cn-mark rq-mark" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C9 2 31 2 38 12 31 22 9 22 2 12Z" fill="none" stroke="#d9bf86" strokeWidth="1.2"/><circle cx="20" cy="12" r="4.6" fill="#d9bf86"/><circle cx="20" cy="12" r="1.8" fill="#02040a"/></svg>
    <h1 className="rq-h s">{t('ask.sentT')}</h1><p className="rq-route">{route} · {fmt(date)}</p>
    <p className="rq-lead">{t('ask.sentBody')}</p><p className="rq-note">{t('ask.sentSt')}</p>
    <button type="button" className="cn-btn quiet rq-go" onClick={again}>{t('ask.again')}</button>
   </>}</>}
  </main></div>
 </div>;
}
