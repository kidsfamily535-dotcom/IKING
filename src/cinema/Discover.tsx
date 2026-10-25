import './cinema.css';import './request.css';import './discover.css';
import {useI18n} from '../i18n';
import LangSwitch from '../LangSwitch';
import TopBar from './TopBar';
import Radar from '../cabin/Radar';
import {HUBS} from '../cabin/geo';
import {copy} from '../cabin/copy';
// صفحة «اكتشف العين»: تعريف عام قبل الدخول. ثلاث قدرات تخدم المسافر فقط. لا أرقام حيّة مزيّفة ولا وعود بتوفر أو سعر.
const C:Record<string,any>={
 ar:{name:'عين الملك',h:'اكتشف العين',s:'كل ما تحتاجه لرحلتك .. في مكان واحد',p:'اكتشف ما تفعله العين لك، وشاهد كيف تعمل معًا لتقدّم لك تجربة طيران خاص هادئة.',cta:'ابدأ رحلتك',
  cards:[['ذكاء الطيران','FLIGHT INTELLIGENCE','يراقب الطقس والمطارات وما يخص مسارك، ويُخبرك بما يهم رحلتك فقط.','?view=cabin','اكتشف المزيد','c4'],['حارس الرحلة','JOURNEY GUARDIAN','يتابع رحلتك قبل السفر وبعده، وينبّهك عند أي تغيير يخصّك.','?view=watch','راقب رحلتي','c2'],['السكرتير التنفيذي','EXECUTIVE SECRETARY','يستلم طلبك وينسّق مع المشغّلين، والقرار الأخير دائمًا لإنسان من الفريق.','?view=cabin','احجز رحلتك','c3']],
  foot:'عرض توضيحي · بيانات تمثيلية'},
 en:{name:'The King’s Eye',h:'Discover the Eye',s:'Everything your trip needs .. in one place',p:'See what the Eye does for you, and how its parts work together to make private flying calm.',cta:'Start your trip',
  cards:[['Flight Intelligence','FLIGHT INTELLIGENCE','Watches weather, airports and what concerns your route, and tells you only what matters.','?view=cabin','Learn more','c4'],['Journey Guardian','JOURNEY GUARDIAN','Follows your trip before and after travel, and alerts you to changes that affect you.','?view=watch','Watch my trip','c2'],['Executive Secretary','EXECUTIVE SECRETARY','Takes your request and coordinates with operators; the final decision always stays with a person on the team.','?view=cabin','Book a trip','c3']],
  foot:'Demo · representative data'},
 ru:{name:'Око Короля',h:'Откройте Око',s:'Всё для вашей поездки .. в одном месте',p:'Узнайте, что Око делает для вас и как его части работают вместе, чтобы частный перелёт был спокойным.',cta:'Начать поездку',
  cards:[['Лётная аналитика','FLIGHT INTELLIGENCE','Следит за погодой, аэропортами и всем, что касается вашего маршрута, и сообщает только важное.','?view=cabin','Подробнее','c4'],['Хранитель поездки','JOURNEY GUARDIAN','Сопровождает поездку до и после вылета и предупреждает об изменениях, которые вас касаются.','?view=watch','Следить за поездкой','c2'],['Личный секретарь','EXECUTIVE SECRETARY','Принимает запрос и согласует с операторами; последнее слово всегда за человеком из команды.','?view=cabin','Заказать рейс','c3']],
  foot:'Демо · представительные данные'},
 tr:{name:'Kralın Gözü',h:'Gözü keşfedin',s:'Yolculuğunuz için her şey .. tek yerde',p:'Gözün sizin için neler yaptığını ve parçalarının özel uçuşu sakin kılmak için nasıl birlikte çalıştığını görün.',cta:'Yolculuğunuza başlayın',
  cards:[['Uçuş Zekâsı','FLIGHT INTELLIGENCE','Hava durumunu, havalimanlarını ve rotanızı ilgilendirenleri izler, yalnızca önemli olanı söyler.','?view=cabin','Daha fazla','c4'],['Yolculuk Koruyucusu','JOURNEY GUARDIAN','Yolculuğunuzu seyahat öncesi ve sonrası izler, sizi etkileyen değişiklikleri bildirir.','?view=watch','Yolculuğumu izle','c2'],['Yönetici Sekreteri','EXECUTIVE SECRETARY','Talebinizi alır, operatörlerle eşgüdüm sağlar; son karar her zaman ekipten bir insandadır.','?view=cabin','Uçuş talep et','c3']],
  foot:'Demo · temsilî veriler'}};
export default function Discover(){
 const {lang}=useI18n(),c=C[lang]||C.en,rc=copy(lang),ar=lang==='ar',arrow=ar?'‹':'›';
 const nm=(i:string)=>{const h=HUBS.find(x=>x.iata===i);return h?(ar?h.ar:h.en):i};
 return <div className={`dc cn${ar?' ar':''}`} dir={ar?'rtl':'ltr'} lang={lang}>
  <div className="rq-bg" aria-hidden="true"/><div className="cn-shade" aria-hidden="true"/><div className="cn-grain" aria-hidden="true"/>
  <LangSwitch/><TopBar active={1} name={c.name}/>
  <main className="dc-main">
   <section className="dc-hero">
    <div className="dc-copy"><h1>{c.h}</h1><p className="dc-s">{c.s}</p><p className="dc-p">{c.p}</p><a className="cn-btn main" href="?view=cabin">{c.cta}</a></div>
    <div className="dc-radar" aria-label={rc.gl.radar}><Radar hubs={HUBS} from="RUH" to={null} hover={null} name={h=>nm(h.iata)} range={3000} blips={[]} scanning={true} plane={null} alt={null} hud="" aria={rc.gl.radar} kmUnit={rc.units.km} onHover={()=>{}} onPick={()=>{}} onBlip={()=>{}}/></div>
   </section>
   <ul className="dc-cards">{c.cards.map((k:string[],i:number)=><li key={i}><a href={k[3]}><span className="dc-img" style={{backgroundImage:`url(/home/${k[5]}.jpg)`}}/><span className="dc-body"><b>{k[0]}</b><i>{k[1]}</i><em>{k[2]}</em><u>{k[4]} {arrow}</u></span></a></li>)}</ul>
  </main>
  <footer className="dc-foot"><span className="dc-dot"/>{c.foot}</footer>
 </div>;
}
