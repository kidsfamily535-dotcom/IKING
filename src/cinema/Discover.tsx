import './cinema.css';import './request.css';import './discover.css';
import {useI18n} from '../i18n';
import LangSwitch from '../LangSwitch';
import TopBar from './TopBar';
import Radar from '../cabin/Radar';
import {HUBS} from '../cabin/geo';
import {copy} from '../cabin/copy';
// صفحة «اكتشف العين»: تعريف عام قبل الدخول. ثلاث قدرات تخدم المسافر فقط. لا أرقام حيّة مزيّفة ولا وعود بتوفر أو سعر.
const C:Record<string,any>={
 ar:{name:'عين الملك',h:'اكتشف العين',s:'رحلة واحدة .. خمس لحظات',p:'هكذا تعمل العين معك، من لحظة طلبك إلى لحظة إقلاع طائرتك.',cta:'ابدأ رحلتك',cta2:'راقب رحلتي',
  st:[['اطلب رحلتك','تكتب رحلتك بكلماتك، فتفهم العين وجهتك وموعدك وعدد المسافرين، ولا تسألك إلا عمّا ينقصها.'],['نبحث ونقارن','تبحث العين عن أنسب الأنواع والمسارات، وتعرض لك من 3 إلى 5 خيارات مع سبب ترشيح كل خيار.'],['القرار قرارك','لا يُرسل طلب إلى مشغّل ولا يُلتزم بشيء دون موافقتك. التوفر والسعر يؤكدهما المشغّل، ويراجعهما إنسان من الفريق.'],['نُنسّق التفاصيل','تحضّر العين مطار الإقلاع والوصول وما يلزم قبل الرحلة. النقل الأرضي والاستقبال قريبًا.'],['نتابع رحلتك','تراقب العين الطقس والمطارات وحالة الرحلة، وتنبّهك فور أي تغيير يخصّك. وتتذكر تفضيلاتك التي قلتها أنت فقط.']],
  foot:'عرض توضيحي · بيانات تمثيلية'},
 en:{name:'The King’s Eye',h:'Discover the Eye',s:'One trip .. five moments',p:'This is how the Eye works with you, from the moment you ask to the moment your aircraft takes off.',cta:'Start your trip',cta2:'Watch my trip',
  st:[['Ask for your trip','Write your trip in your own words. The Eye understands where, when and how many, and asks only what is missing.'],['We search and compare','The Eye looks for the most suitable aircraft types and routes, and shows 3 to 5 options with the reason for each.'],['The decision is yours','Nothing is sent to an operator and nothing is committed without your approval. Availability and price are confirmed by the operator and reviewed by a person on the team.'],['We coordinate the details','The Eye prepares departure and arrival airports and what the trip needs. Ground transfer and reception are coming soon.'],['We follow your trip','The Eye watches weather, airports and flight status, and alerts you to any change that concerns you. It remembers only the preferences you stated.']],
  foot:'Demo · representative data'},
 ru:{name:'Око Короля',h:'Откройте Око',s:'Одна поездка .. пять моментов',p:'Так Око работает с вами: от запроса до взлёта вашего самолёта.',cta:'Начать поездку',cta2:'Следить за поездкой',
  st:[['Опишите поездку','Пишите своими словами. Око поймёт, куда, когда и сколько вас, и спросит только недостающее.'],['Ищем и сравниваем','Око подбирает подходящие типы самолётов и маршруты и показывает от 3 до 5 вариантов с причиной выбора.'],['Решение за вами','Ничего не отправляется оператору и ни к чему вы не обязаны без вашего согласия. Наличие и цену подтверждает оператор, проверяет сотрудник команды.'],['Согласуем детали','Око готовит аэропорты вылета и прилёта и всё нужное до рейса. Трансфер и встреча скоро.'],['Сопровождаем поездку','Око следит за погодой, аэропортами и статусом рейса и сообщает о любых изменениях. Помнит только указанные вами предпочтения.']],
  foot:'Демо · представительные данные'},
 tr:{name:'Kralın Gözü',h:'Gözü keşfedin',s:'Tek yolculuk .. beş an',p:'Göz sizinle böyle çalışır: talebinizden uçağınızın kalkışına kadar.',cta:'Yolculuğunuza başlayın',cta2:'Yolculuğumu izle',
  st:[['Yolculuğunuzu isteyin','Kendi sözlerinizle yazın. Göz nereye, ne zaman ve kaç kişi olduğunuzu anlar, yalnızca eksik olanı sorar.'],['Arar ve karşılaştırırız','Göz en uygun uçak tiplerini ve rotaları bulur, her biri için nedeniyle 3 ila 5 seçenek sunar.'],['Karar sizin','Onayınız olmadan operatöre hiçbir şey gönderilmez ve hiçbir taahhütte bulunulmaz. Müsaitliği ve fiyatı operatör teyit eder, ekipten biri inceler.'],['Ayrıntıları eşgüdümleriz','Göz kalkış ve varış havalimanlarını ve yolculuğun gerektirdiklerini hazırlar. Karada transfer ve karşılama yakında.'],['Yolculuğunuzu izleriz','Göz hava durumunu, havalimanlarını ve uçuş durumunu izler, sizi ilgilendiren her değişikliği bildirir. Yalnızca sizin belirttiğiniz tercihleri hatırlar.']],
  foot:'Demo · temsilî veriler'}};
export default function Discover(){
 const {lang}=useI18n(),c=C[lang]||C.en,rc=copy(lang),ar=lang==='ar';
 const nm=(i:string)=>{const h=HUBS.find(x=>x.iata===i);return h?(ar?h.ar:h.en):i};
 return <div className={`dc cn${ar?' ar':''}`} dir={ar?'rtl':'ltr'} lang={lang}>
  <div className="rq-bg" aria-hidden="true"/><div className="cn-shade" aria-hidden="true"/><div className="cn-grain" aria-hidden="true"/>
  <LangSwitch/><TopBar active={1} name={c.name}/>
  <main className="dc-main">
   <section className="dc-hero">
    <div className="dc-copy"><h1>{c.h}</h1><p className="dc-s">{c.s}</p><p className="dc-p">{c.p}</p><a className="cn-btn main" href="?view=cabin">{c.cta}</a></div>
    <div className="dc-radar" aria-label={rc.gl.radar}><Radar hubs={HUBS} from="RUH" to={null} hover={null} name={h=>nm(h.iata)} range={3000} blips={[]} scanning={true} plane={null} alt={null} hud="" aria={rc.gl.radar} kmUnit={rc.units.km} onHover={()=>{}} onPick={()=>{}} onBlip={()=>{}}/></div>
   </section>
   <ol className="dc-steps">{c.st.map((k:string[],i:number)=><li key={i}><span className="dc-sn">{String(i+1).padStart(2,'0')}</span><span className="dc-img" style={{backgroundImage:`url(/home/s${i+1}.jpg)`}}/><span className="dc-body"><b>{k[0]}</b><em>{k[1]}</em></span></li>)}</ol>
   <div className="dc-end"><a className="cn-btn main" href="?view=cabin">{c.cta}</a><a className="cn-btn quiet" href="?view=watch">{c.cta2}</a></div>
  </main>
  <footer className="dc-foot"><span className="dc-dot"/>{c.foot}</footer>
 </div>;
}
