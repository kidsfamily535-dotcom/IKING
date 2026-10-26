import {useEffect,useState} from 'react';
import {useI18n,type Lang} from '../i18n';
import Radar from '../cabin/Radar';
import {HUBS,hub,dist,flightMin,rangeFor} from '../cabin/geo';
import './imagehome.css';
// الصفحة الرئيسية بحسب التصميم المعتمد: الأرض ليلًا (الخلفية العامة للموقع) + رادار الرياض والعين + «ما الذي سترى؟».
type C={say:string;sayGo:string;think:string;kick:string;h1:string;sub:string;cta:string;tag:string;demo:string;steps:string[];
 vis:string;visB:string;visL:string;vt:string;vb:string;vc:string;
 liv:string;livB:string;livL:string;lt:string;lb:string;lc:string;
 what:string;whatL:string;cards:[string,string][];live:string;more:string;moreL:string;note:string;city:string[]};
const COPY:Record<Lang,C>={
 ar:{say:'قل لي رحلتك بكلامك…',sayGo:'ابدأ',think:'شاهد كيف تفكر العين',kick:'منصة طيران خاص',h1:'عينك التي لا تنام.',sub:'يدك في الأرض وعينك في السماء.',cta:'اكتشف العين',tag:'قدرات ذكية · فرص حقيقية · رحلة مخصصة',demo:'عرض تجريبي · محاكاة',steps:['الوصول','الأرض','الرحلة','التجهيز','القرار'],
  vis:'لزوار الموقع',visB:'محاكاة توضيحية',visL:'اكتشف الإمكانيات وجرّب المنصة قبل أن تسجّل.',vt:'ما تستطيعه العين',vb:'عرض فرصة مناسبة',vc:'جميع النتائج محاكاة ولا تعتبر مؤكدة.',
  liv:'ملف الرحلة الحي',livB:'للمسجلين فقط',livL:'رحلتك الحقيقية بطقسها وحالتها ومرافقها، في مكان واحد.',lt:'رحلتي',lb:'تفاصيل الرحلة',lc:'بيانات توضيحية — لا يوجد مصدر حيّ متصل.',
  what:'ما الذي سترى؟',whatL:'منصة الاكتشاف تمنحك نظرة شاملة على كل ما يجعل رحلتك ممكنة.',
  cards:[['ملف الرحلة الحي','رحلتك الفعلية في مكان واحد.'],['الطائرات المتاحة','خيارات ذكية من أساطيل عالمية موثوقة.'],['الفرص الحقيقية','مطابقات مخصصة مبنية على احتياجك وشبكتك.'],['الباب للباب','تنسيق كامل من المغادرة إلى الوصول.'],['الطقس والظروف','تحديثات لحظية وتوقعات دقيقة للمسار والوجهة.']],
  live:'للمسجلين',more:'أكثر من مجرد رحلة',moreL:'إنها رؤية أوسع لعالم من الفرص.',note:'بيانات توضيحية (DEMONSTRATION) — لا يوجد مصدر حيّ متصل.',city:['إسطنبول','عمّان','الكويت','الدمام','الدوحة','جدة','القاهرة','الرياض']},
 en:{say:'Tell me your trip in your own words…',sayGo:'Start',think:'See how the Eye thinks',kick:'Private aviation platform',h1:'Your eye that never sleeps.',sub:'Your hand on the ground, your eye in the sky.',cta:'Discover the Eye',tag:'Smart capabilities · Real opportunities · A journey made for you',demo:'Demo · Simulation',steps:['Arrival','Ground','Flight','Preparation','Decision'],
  vis:'For visitors',visB:'Illustrative simulation',visL:'Explore the possibilities and try the platform before you sign up.',vt:'What the Eye can do',vb:'View a matching opportunity',vc:'All results are simulated and not confirmed.',
  liv:'Live trip file',livB:'Registered users only',livL:'Your real journey with its weather, status and facilities, in one place.',lt:'My trip',lb:'Trip details',lc:'Illustrative data: no live source connected.',
  what:'What will you see?',whatL:'The discovery platform gives you a full view of everything that makes your trip possible.',
  cards:[['Live trip file','Your actual journey in one place.'],['Available aircraft','Smart options from trusted global fleets.'],['Real opportunities','Personal matches built on your needs and your network.'],['Door to door','Full coordination from departure to arrival.'],['Weather and conditions','Live updates and precise forecasts for the route and destination.']],
  live:'Registered',more:'More than a journey',moreL:'A wider view of a world of opportunities.',note:'Demonstration data: no live source connected.',city:['Istanbul','Amman','Kuwait','Dammam','Doha','Jeddah','Cairo','Riyadh']},
 tr:{say:'Yolculuğunuzu kendi sözlerinizle yazın…',sayGo:'Başla',think:'Gözün nasıl düşündüğünü izleyin',kick:'Özel havacılık platformu',h1:'Hiç uyumayan gözünüz.',sub:'Elin yerde, gözün gökte.',cta:'Gözü keşfedin',tag:'Akıllı yetenekler · Gerçek fırsatlar · Size özel yolculuk',demo:'Demo · Simülasyon',steps:['Varış','Zemin','Uçuş','Hazırlık','Karar'],
  vis:'Ziyaretçiler için',visB:'Açıklayıcı simülasyon',visL:'Kayıt olmadan önce olanakları keşfedin ve platformu deneyin.',vt:'Gözün yapabilecekleri',vb:'Uygun bir fırsatı gör',vc:'Tüm sonuçlar simülasyondur, kesinleşmiş değildir.',
  liv:'Canlı yolculuk dosyası',livB:'Yalnızca üyeler',livL:'Gerçek yolculuğunuz; hava durumu, durum ve olanaklarıyla tek yerde.',lt:'Yolculuğum',lb:'Yolculuk ayrıntıları',lc:'Örnek veri: canlı kaynak bağlı değil.',
  what:'Ne göreceksiniz?',whatL:'Keşif platformu, yolculuğunuzu mümkün kılan her şeye bütüncül bir bakış sunar.',
  cards:[['Canlı yolculuk dosyası','Gerçek yolculuğunuz tek yerde.'],['Uygun uçaklar','Güvenilir küresel filolardan akıllı seçenekler.'],['Gerçek fırsatlar','İhtiyacınıza ve ağınıza göre kişisel eşleşmeler.'],['Kapıdan kapıya','Kalkıştan varışa tam koordinasyon.'],['Hava ve koşullar','Rota ve varış için anlık güncellemeler ve net tahminler.']],
  live:'Üyeler',more:'Bir yolculuktan fazlası',moreL:'Fırsatlar dünyasına daha geniş bir bakış.',note:'Örnek veri (DEMONSTRATION): canlı kaynak bağlı değil.',city:['İstanbul','Amman','Kuveyt','Dammam','Doha','Cidde','Kahire','Riyad']},
 ru:{say:'Опишите поездку своими словами…',sayGo:'Начать',think:'Посмотрите, как думает Око',kick:'Платформа частной авиации',h1:'Ваше око, которое не спит.',sub:'Рука на земле, око в небе.',cta:'Открыть око',tag:'Умные возможности · Реальные шансы · Путь под вас',demo:'Демо · Имитация',steps:['Прибытие','Земля','Полёт','Подготовка','Решение'],
  vis:'Для гостей',visB:'Наглядная имитация',visL:'Изучите возможности и попробуйте платформу до регистрации.',vt:'Что умеет Око',vb:'Показать подходящий вариант',vc:'Все результаты — имитация и не подтверждены.',
  liv:'Живой файл поездки',livB:'Только для зарегистрированных',livL:'Ваша реальная поездка с погодой, статусом и сервисами в одном месте.',lt:'Моя поездка',lb:'Детали поездки',lc:'Демонстрационные данные: живой источник не подключён.',
  what:'Что вы увидите?',whatL:'Платформа даёт полный обзор всего, что делает вашу поездку возможной.',
  cards:[['Живой файл поездки','Ваша реальная поездка в одном месте.'],['Доступные самолёты','Умный выбор из проверенных мировых флотов.'],['Реальные возможности','Персональные подборки под вашу задачу и круг.'],['От двери до двери','Полная координация от вылета до прибытия.'],['Погода и условия','Актуальные данные и точные прогнозы по маршруту и месту назначения.']],
  live:'Для своих',more:'Больше, чем поездка',moreL:'Более широкий взгляд на мир возможностей.',note:'Демонстрационные данные (DEMONSTRATION): живой источник не подключён.',city:['Стамбул','Амман','Кувейт','Даммам','Доха','Джидда','Каир','Эр-Рияд']}
};

const NM:Record<'tr'|'ru',Record<string,string>>={
 tr:{RUH:'Riyad',JED:'Cidde',DMM:'Dammam',MED:'Medine',DXB:'Dubai',AUH:'Abu Dabi',DOH:'Doha',KWI:'Kuveyt',BAH:'Bahreyn',MCT:'Maskat',CAI:'Kahire',AMM:'Amman',IST:'İstanbul',LON:'Londra',CDG:'Paris',GVA:'Cenevre',MXP:'Milano',NCE:'Nice'},
 ru:{RUH:'Эр-Рияд',JED:'Джидда',DMM:'Даммам',MED:'Медина',DXB:'Дубай',AUH:'Абу-Даби',DOH:'Доха',KWI:'Кувейт',BAH:'Бахрейн',MCT:'Маскат',CAI:'Каир',AMM:'Амман',IST:'Стамбул',LON:'Лондон',CDG:'Париж',GVA:'Женева',MXP:'Милан',NCE:'Ницца'}};
const RX:Record<Lang,{tap:string;go:string;km:string;h:string;m:string;est:string}>={
 ar:{tap:'اضغط على وجهة لترى الطريق',go:'اطلب هذه الرحلة',km:'كم',h:'س',m:'د',est:'تقدير'},
 en:{tap:'Tap a destination to see the route',go:'Request this trip',km:'km',h:'h',m:'min',est:'estimate'},
 tr:{tap:'Rotayı görmek için bir varış seçin',go:'Bu yolculuğu talep et',km:'km',h:'sa',m:'dk',est:'tahmini'},
 ru:{tap:'Выберите пункт назначения',go:'Запросить поездку',km:'км',h:'ч',m:'мин',est:'оценка'}};
// التركية والروسية مجمّدتان مؤقتًا (النصوص محفوظة وتعود بإضافتهما هنا وفي ENABLED_LANGS داخل i18n)
const LANGS:{l:Lang;n:string}[]=[{l:'ar',n:'العربية'},{l:'en',n:'English'}];
const ICONS=['M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5','M12 2l2 7 7 4v2l-7-3-1 5 3 2v2l-4-2-4 2v-2l3-2-1-5-7 3v-2l7-4z','M12 20a8 8 0 100-16 8 8 0 000 16zM12 16a4 4 0 100-8 4 4 0 000 8z','M4 16V12l2-5h12l2 5v4M4 16h16M4 16v2h3v-2M17 16v2h3v-2','M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2'];
const Ic=({d}:{d:string})=><svg className="ih-i" viewBox="0 0 24 24" aria-hidden="true"><path d={d}/></svg>;
const IMG=['/home/c4.jpg','/home/c4.jpg','/home/c3.jpg','/home/c2.jpg','/home/c1.jpg'];
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function ImageHome({real}:{real:boolean}){
 const {lang,setLang}=useI18n(),c=COPY[lang]||COPY.en,[on,setOn]=useState(4),[to,setTo]=useState<string|null>('CAI'),[hov,setHov]=useState<string|null>(null);
 const rx=RX[lang],nm=(i:string)=>{const h=hub(i);return lang==='ar'?h.ar:lang==='en'?h.en:NM[lang][i]||h.en};
 const F=hub('RUH'),km=to?dist(F,hub(to)):null,mn=km?flightMin(km):0;
 const hud=to&&km?`${nm('RUH')} ${lang==='ar'?'←':'→'} ${nm(to)} · ${(Math.round(km/10)*10).toLocaleString('en')} ${rx.km} · ${lang==='ar'?'نحو ':''}${Math.floor(mn/60)} ${rx.h} ${mn%60} ${rx.m} (${rx.est})`:rx.tap;
 useEffect(()=>{if(calm())return;const id=setInterval(()=>setOn(i=>(i+4)%5),2600);return()=>clearInterval(id)},[]);
 const [say,setSay]=useState('');
 const goSay=(e:{preventDefault:()=>void})=>{e.preventDefault();const v=say.trim();location.href='?view=ask'+(v?'&say='+encodeURIComponent(v.slice(0,600)):'')};
 const ar=lang==='ar',P=c.city;
 return <div className={`ih${ar?' ih-ar':''}`}>
  <div className="ih-hero">
   <header className="ih-top">
    <div className="ih-langs" role="group" aria-label="Language">{LANGS.map(o=><button key={o.l} type="button" className="ih-pill" aria-pressed={lang===o.l} lang={o.l} onClick={()=>setLang(o.l)}>{o.n}</button>)}</div>
    <div className="ih-logo"><svg viewBox="0 0 48 30" fill="none" stroke="#e8c880" strokeWidth="1.6" aria-hidden="true"><path d="M3 15S11 3 24 3s21 12 21 12-8 12-21 12S3 15 3 15z"/><circle cx="24" cy="15" r="6.5"/><circle cx="24" cy="15" r="2.6" fill="#e8c880"/></svg><span dir="ltr">EYE KING</span></div>
   </header>
   <div className="ih-stage">
    <div className="ih-copy">
     <h1>{c.h1}</h1>
     <form className="ih-say" onSubmit={goSay}><input type="text" value={say} maxLength={600} placeholder={c.say} aria-label={c.say} onChange={e=>setSay(e.target.value)}/><button type="submit" aria-label={c.sayGo}>{c.sayGo}<Ic d="M9 5l7 7-7 7"/></button></form>
     <div className="ih-cta-wrap">
      {!real?<a className="ih-cta" href="?view=cabin"><span className="ih-eye"><Ic d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/></span><span>{c.cta}</span><Ic d="M9 5l7 7-7 7"/></a>
       :<a className="ih-cta" href="?view=discover"><span className="ih-eye"><Ic d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/></span><span>{c.cta}</span><Ic d="M9 5l7 7-7 7"/></a>}
      <p className="ih-tag">{c.tag}</p>
      <a className="ih-think" href="?view=think">{c.think}<Ic d="M9 5l7 7-7 7"/></a>
     </div>
    </div>
    <div className="ih-radarbox">
     <Radar hubs={HUBS} from="RUH" to={to} hover={hov} name={h=>nm(h.iata)} range={to?rangeFor(km):3000} blips={[]} scanning={false} plane={null} alt={null} hud={hud} aria={c.city[7]} kmUnit={rx.km} onHover={setHov} onPick={i=>{if(i!=='RUH')setTo(t=>t===i?null:i)}} onBlip={()=>{}}/>
     {to&&<a className="ih-go" href={`?view=cabin&to=${to}`}>{rx.go}</a>}
     <p className="ih-simnote">{c.demo}</p>
    </div>
   </div>
   <ol className="ih-steps" aria-label="Journey">{c.steps.map((s,i)=><li key={i} className={on===i?'ih-on':''}>{s}</li>)}</ol>
  </div>

  <div className="ih-lower">
   <section>
    <div className="ih-colhead"><h2>{c.vis}</h2><span className="ih-badge">{c.visB}</span></div>
    <p className="ih-lead">{c.visL}</p>
    <div className="ih-phone"><div className="ih-screen">
     <h4>{c.vt}</h4>
     <div className="ih-tkt"><div className="ih-route"><span>CAI</span><span>→</span><span>JED</span></div><div className="ih-when">12 Oct 2026 · 10:30</div></div>
     <div className="ih-art" style={{background:'url(/home/pa.jpg) center/cover'}}/>
     <span className="ih-btn">{c.vb}</span><p className="ih-cap">{c.vc}</p>
    </div></div>
   </section>
   <section>
    <div className="ih-colhead"><h2>{c.liv}</h2><span className="ih-badge">{c.livB}</span></div>
    <p className="ih-lead">{c.livL}</p>
    <div className="ih-phone"><div className="ih-screen">
     <h4>{c.lt}</h4>
     <div className="ih-tkt"><div className="ih-route"><span>JED</span><span>→</span><span>DXB</span></div><div className="ih-when">12 Oct 2026 · 10:30</div>
      <div className="ih-wx"><span><Ic d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.2A3.4 3.4 0 0117 18z"/>22°</span><span><Ic d={ICONS[4]}/>29°</span></div></div>
     <div className="ih-art" style={{background:'url(/home/pb.jpg) center/cover'}}/>
     <span className="ih-btn">{c.lb}</span><p className="ih-cap">{c.lc}</p>
    </div></div>
   </section>
   <section>
    <h2>{c.what}</h2>
    <p className="ih-lead">{c.whatL}</p>
    <div className="ih-cards">{c.cards.map(([h,p],i)=><article key={i} className="ih-card">
     <div className={`ih-art${i===0?' ih-a-live':''}`} style={i===0?undefined:{background:`url(${IMG[i]}) center/cover`}}>{i===0&&<span className="ih-b">{c.live}</span>}</div>
     <div className="ih-ic"><Ic d={ICONS[i]}/></div><h3>{h}</h3><p>{p}</p></article>)}</div>
   </section>
   <div className="ih-banner"><h2>{c.more}</h2><p>{c.moreL}</p></div>
  </div>
  <p className="ih-note">{c.note}</p>
 </div>;
}
