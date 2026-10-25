import {useEffect,useState} from 'react';
import {useI18n,type Lang} from '../i18n';
import './imagehome.css';
// الصفحة الرئيسية بحسب التصميم المعتمد: الأرض ليلًا (الخلفية العامة للموقع) + رادار الرياض والعين + «ما الذي سترى؟».
type C={kick:string;h1:string;sub:string;cta:string;tag:string;demo:string;steps:string[];
 vis:string;visB:string;visL:string;vt:string;vb:string;vc:string;
 liv:string;livB:string;livL:string;lt:string;lb:string;lc:string;
 what:string;whatL:string;cards:[string,string][];live:string;more:string;moreL:string;note:string;city:string[]};
const COPY:Record<Lang,C>={
 ar:{kick:'منصة طيران خاص',h1:'عينك التي لا تنام.',sub:'يدك في الأرض وعينك في السماء.',cta:'اكتشف العين',tag:'قدرات ذكية · فرص حقيقية · رحلة مخصصة',demo:'عرض تجريبي · محاكاة',steps:['الوصول','الأرض','الرحلة','التجهيز','القرار'],
  vis:'لزوار الموقع',visB:'محاكاة توضيحية',visL:'اكتشف الإمكانيات وجرّب المنصة قبل أن تسجّل.',vt:'ما تستطيعه العين',vb:'عرض فرصة مناسبة',vc:'جميع النتائج محاكاة ولا تعتبر مؤكدة.',
  liv:'ملف الرحلة الحي',livB:'للمسجلين فقط',livL:'رحلتك الحقيقية بطقسها وحالتها ومرافقها، في مكان واحد.',lt:'رحلتي',lb:'تفاصيل الرحلة',lc:'بيانات توضيحية — لا يوجد مصدر حيّ متصل.',
  what:'ما الذي سترى؟',whatL:'منصة الاكتشاف تمنحك نظرة شاملة على كل ما يجعل رحلتك ممكنة.',
  cards:[['ملف الرحلة الحي','رحلتك الفعلية في مكان واحد.'],['الطائرات المتاحة','خيارات ذكية من أساطيل عالمية موثوقة.'],['الفرص الحقيقية','مطابقات مخصصة مبنية على احتياجك وشبكتك.'],['الباب للباب','تنسيق كامل من المغادرة إلى الوصول.'],['الطقس والظروف','تحديثات لحظية وتوقعات دقيقة للمسار والوجهة.']],
  live:'للمسجلين',more:'أكثر من مجرد رحلة',moreL:'إنها رؤية أوسع لعالم من الفرص.',note:'بيانات توضيحية (DEMONSTRATION) — لا يوجد مصدر حيّ متصل.',city:['إسطنبول','عمّان','الكويت','الدمام','الدوحة','جدة','القاهرة','الرياض']},
 en:{kick:'Private aviation platform',h1:'Your eye that never sleeps.',sub:'Your hand on the ground, your eye in the sky.',cta:'Discover the Eye',tag:'Smart capabilities · Real opportunities · A journey made for you',demo:'Demo · Simulation',steps:['Arrival','Ground','Flight','Preparation','Decision'],
  vis:'For visitors',visB:'Illustrative simulation',visL:'Explore the possibilities and try the platform before you sign up.',vt:'What the Eye can do',vb:'View a matching opportunity',vc:'All results are simulated and not confirmed.',
  liv:'Live trip file',livB:'Registered users only',livL:'Your real journey with its weather, status and facilities, in one place.',lt:'My trip',lb:'Trip details',lc:'Illustrative data: no live source connected.',
  what:'What will you see?',whatL:'The discovery platform gives you a full view of everything that makes your trip possible.',
  cards:[['Live trip file','Your actual journey in one place.'],['Available aircraft','Smart options from trusted global fleets.'],['Real opportunities','Personal matches built on your needs and your network.'],['Door to door','Full coordination from departure to arrival.'],['Weather and conditions','Live updates and precise forecasts for the route and destination.']],
  live:'Registered',more:'More than a journey',moreL:'A wider view of a world of opportunities.',note:'Demonstration data: no live source connected.',city:['Istanbul','Amman','Kuwait','Dammam','Doha','Jeddah','Cairo','Riyadh']},
 tr:{kick:'Özel havacılık platformu',h1:'Hiç uyumayan gözünüz.',sub:'Elin yerde, gözün gökte.',cta:'Gözü keşfedin',tag:'Akıllı yetenekler · Gerçek fırsatlar · Size özel yolculuk',demo:'Demo · Simülasyon',steps:['Varış','Zemin','Uçuş','Hazırlık','Karar'],
  vis:'Ziyaretçiler için',visB:'Açıklayıcı simülasyon',visL:'Kayıt olmadan önce olanakları keşfedin ve platformu deneyin.',vt:'Gözün yapabilecekleri',vb:'Uygun bir fırsatı gör',vc:'Tüm sonuçlar simülasyondur, kesinleşmiş değildir.',
  liv:'Canlı yolculuk dosyası',livB:'Yalnızca üyeler',livL:'Gerçek yolculuğunuz; hava durumu, durum ve olanaklarıyla tek yerde.',lt:'Yolculuğum',lb:'Yolculuk ayrıntıları',lc:'Örnek veri: canlı kaynak bağlı değil.',
  what:'Ne göreceksiniz?',whatL:'Keşif platformu, yolculuğunuzu mümkün kılan her şeye bütüncül bir bakış sunar.',
  cards:[['Canlı yolculuk dosyası','Gerçek yolculuğunuz tek yerde.'],['Uygun uçaklar','Güvenilir küresel filolardan akıllı seçenekler.'],['Gerçek fırsatlar','İhtiyacınıza ve ağınıza göre kişisel eşleşmeler.'],['Kapıdan kapıya','Kalkıştan varışa tam koordinasyon.'],['Hava ve koşullar','Rota ve varış için anlık güncellemeler ve net tahminler.']],
  live:'Üyeler',more:'Bir yolculuktan fazlası',moreL:'Fırsatlar dünyasına daha geniş bir bakış.',note:'Örnek veri (DEMONSTRATION): canlı kaynak bağlı değil.',city:['İstanbul','Amman','Kuveyt','Dammam','Doha','Cidde','Kahire','Riyad']},
 ru:{kick:'Платформа частной авиации',h1:'Ваше око, которое не спит.',sub:'Рука на земле, око в небе.',cta:'Открыть око',tag:'Умные возможности · Реальные шансы · Путь под вас',demo:'Демо · Имитация',steps:['Прибытие','Земля','Полёт','Подготовка','Решение'],
  vis:'Для гостей',visB:'Наглядная имитация',visL:'Изучите возможности и попробуйте платформу до регистрации.',vt:'Что умеет Око',vb:'Показать подходящий вариант',vc:'Все результаты — имитация и не подтверждены.',
  liv:'Живой файл поездки',livB:'Только для зарегистрированных',livL:'Ваша реальная поездка с погодой, статусом и сервисами в одном месте.',lt:'Моя поездка',lb:'Детали поездки',lc:'Демонстрационные данные: живой источник не подключён.',
  what:'Что вы увидите?',whatL:'Платформа даёт полный обзор всего, что делает вашу поездку возможной.',
  cards:[['Живой файл поездки','Ваша реальная поездка в одном месте.'],['Доступные самолёты','Умный выбор из проверенных мировых флотов.'],['Реальные возможности','Персональные подборки под вашу задачу и круг.'],['От двери до двери','Полная координация от вылета до прибытия.'],['Погода и условия','Актуальные данные и точные прогнозы по маршруту и месту назначения.']],
  live:'Для своих',more:'Больше, чем поездка',moreL:'Более широкий взгляд на мир возможностей.',note:'Демонстрационные данные (DEMONSTRATION): живой источник не подключён.',city:['Стамбул','Амман','Кувейт','Даммам','Доха','Джидда','Каир','Эр-Рияд']}
};
const LANGS:{l:Lang;n:string}[]=[{l:'ar',n:'العربية'},{l:'en',n:'English'},{l:'tr',n:'Türkçe'},{l:'ru',n:'Русский'}];
const ICONS=['M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5','M12 2l2 7 7 4v2l-7-3-1 5 3 2v2l-4-2-4 2v-2l3-2-1-5-7 3v-2l7-4z','M12 20a8 8 0 100-16 8 8 0 000 16zM12 16a4 4 0 100-8 4 4 0 000 8z','M4 16V12l2-5h12l2 5v4M4 16h16M4 16v2h3v-2M17 16v2h3v-2','M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2'];
const Ic=({d}:{d:string})=><svg className="ih-i" viewBox="0 0 24 24" aria-hidden="true"><path d={d}/></svg>;
const IMG=['/home/c4.jpg','/home/c4.jpg','/home/c3.jpg','/home/c2.jpg','/home/c1.jpg'];
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function ImageHome({real}:{real:boolean}){
 const {lang,setLang}=useI18n(),c=COPY[lang]||COPY.en,[on,setOn]=useState(4);
 useEffect(()=>{if(calm())return;const id=setInterval(()=>setOn(i=>(i+4)%5),2600);return()=>clearInterval(id)},[]);
 const ar=lang==='ar',P=c.city;
 return <div className={`ih${ar?' ih-ar':''}`}>
  <div className="ih-hero">
   <header className="ih-top">
    <div className="ih-langs" role="group" aria-label="Language">{LANGS.map(o=><button key={o.l} type="button" className="ih-pill" aria-pressed={lang===o.l} lang={o.l} onClick={()=>setLang(o.l)}>{o.n}</button>)}</div>
    <div className="ih-logo"><svg viewBox="0 0 48 30" fill="none" stroke="#e8c880" strokeWidth="1.6" aria-hidden="true"><path d="M3 15S11 3 24 3s21 12 21 12-8 12-21 12S3 15 3 15z"/><circle cx="24" cy="15" r="6.5"/><circle cx="24" cy="15" r="2.6" fill="#e8c880"/></svg><span dir="ltr">THE KING'S EYE</span></div>
    <span className="ih-pill ih-demo">{c.demo}</span>
   </header>
   <div className="ih-stage">
    <div className="ih-copy">
     <p className="ih-kicker">{c.kick}</p>
     <h1>{c.h1}</h1>
     <p className="ih-sub">{c.sub}</p>
     <div className="ih-cta-wrap">
      {!real?<a className="ih-cta" href="?view=cabin"><span className="ih-eye"><Ic d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/></span><span>{c.cta}</span><Ic d="M9 5l7 7-7 7"/></a>
       :<a className="ih-cta" href={'/inside-the-kings-eye.html?lang='+lang}><span className="ih-eye"><Ic d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/></span><span>{c.cta}</span><Ic d="M9 5l7 7-7 7"/></a>}
      <p className="ih-tag">{c.tag}</p>
     </div>
    </div>
    <svg className="ih-radar" viewBox="-30 -10 660 620" role="img" aria-label={c.city[7]}>
     <defs>
      <radialGradient id="ih-glow"><stop offset="0" stopColor="#fff1c4"/><stop offset=".4" stopColor="#eab85a" stopOpacity=".75"/><stop offset="1" stopColor="#eab85a" stopOpacity="0"/></radialGradient>
      <radialGradient id="ih-iris" cx=".4" cy=".35" r=".8"><stop offset="0" stopColor="#fff0bd"/><stop offset=".55" stopColor="#e2ad52"/><stop offset="1" stopColor="#8a5f22"/></radialGradient>
      <radialGradient id="ih-wg" gradientUnits="userSpaceOnUse" cx="300" cy="300" r="262"><stop offset="0" stopColor="#e8c880" stopOpacity=".32"/><stop offset="1" stopColor="#e8c880" stopOpacity=".03"/></radialGradient>
     </defs>
     <g fill="none" stroke="#e8c880"><circle cx="300" cy="300" r="262" opacity=".5"/><circle cx="300" cy="300" r="270" strokeWidth="6" strokeDasharray="1 11.86" opacity=".35"/><circle cx="300" cy="300" r="205" opacity=".2"/><circle cx="300" cy="300" r="150" opacity=".22"/><circle cx="300" cy="300" r="98" opacity=".28"/><circle cx="300" cy="300" r="56" opacity=".4"/></g>
     <g className="ih-sweep"><path d="M300 300L562 300A262 262 0 0 0 431 73Z" fill="url(#ih-wg)"/><path d="M300 300L562 300" stroke="#f3e0b0" strokeOpacity=".55" fill="none"/></g>
     <path d="M68 196Q175 218 300 300" fill="none" stroke="#e8c880" strokeWidth="1.5" opacity=".85"/>
     <circle cx="68" cy="196" r="9" fill="none" stroke="#e8c880" opacity=".7"/><circle cx="68" cy="196" r="3.5" fill="#f3e0b0"/>
     <g fill="#f7ead0" fontSize="19" fontFamily="Tajawal,sans-serif" textAnchor="middle">
      {([[98,69,0,-17],[157,147,1,-17],[371,168,2,-17],[541,297,3,-15],[150,351,4,23],[24,433,5,23]] as number[][]).map(([x,y,i,dy])=><g key={i}><circle cx={x} cy={y} r="2.5" fill="#e8c880"/><text x={x} y={y+dy}>{P[i]}</text></g>)}
      <text x="68" y="231" opacity=".8">{P[6]}</text>
     </g>
     <g className="ih-eye-g"><circle cx="300" cy="300" r="78" fill="url(#ih-glow)" opacity=".7"/><circle cx="300" cy="300" r="46" fill="none" stroke="#f3e0b0" strokeOpacity=".5"/><circle cx="300" cy="300" r="36" fill="url(#ih-iris)"/><circle cx="300" cy="300" r="13" fill="#0a0806"/><circle cx="305" cy="295" r="3.6" fill="#fff6dd"/></g>
     <text x="300" y="372" fill="#f7ead0" fontSize="23" fontFamily="Tajawal,sans-serif" textAnchor="middle">{P[7]}</text>
    </svg>
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
