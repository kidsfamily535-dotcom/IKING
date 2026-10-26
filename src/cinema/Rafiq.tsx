import {useEffect,useState} from 'react';
import {useI18n} from '../i18n';
import './rafiq.css';
// قسم «رفيق» في الصفحة الرئيسية: عرض توضيحي حيّ لمحادثة المساعد الذكي.
// كل مثال مبني على مدخل معرفة معتمد (APPROVED / CUSTOMER) بمصدره وتاريخ تحققه؛ والسؤال عن السعر يوضّح التحويل لإنسان.
// المحادثة مكتوبة سلفًا (مثال توضيحي) وليست ردًا حيًّا، وهذا معلَن في الواجهة.
// لعرض زر التواصل للشركاء: ضع بريد الشراكات هنا (فارغ = لا يظهر الزر ولا نخترع بريدًا).
const PARTNER_MAIL='';
type S={chip:string;q:string;a:string[];src?:string;date?:string;hand?:string};
type T={badge:string;lead:string;demo:string;cta:string;note:string;srcL:string;chipsL:string;name:string;role:string;
 b2bT:string;b2bP:string;tags:string[];b2bC:string;S:S[]};
const D:Record<'ar'|'en',T>={
 ar:{badge:'ذكاء اصطناعي · التأكيد النهائي من فريقنا',lead:'مرافقك الذكي في كل ما يخص رحلتك الخاصة: يجيبك من مصادر موثّقة، ويقول لك صراحةً حين يحتاج الأمر إلى تأكيد إنسان.',demo:'مثال توضيحي',cta:'اطلب رحلتك من رفيق',
  note:'المحادثة أعلاه مثال توضيحي مكتوب مسبقًا. الإجابات مأخوذة من مدخلات معرفة معتمدة، ولا يؤكد رفيق سعرًا ولا توفر طائرة.',srcL:'المصدر',chipsL:'جرّب سيناريو',name:'رفيق',role:'مرافقك في Eye King',
  b2bT:'رفيق لمنصتك',b2bP:'نجهّز رفيق ليُدمج داخل منصات الشركاء، ليجيب عملاءكم عن الرحلات الخاصة بصوت منصتكم وبمصادر موثّقة.',tags:['فنادق ومنتجعات','وكالات سفر','منصات حجز','كونسيرج وشركات'],b2bC:'تواصل معنا للشراكة',
  S:[
  {chip:'عائلة ومعها كلب',q:'نسافر إلى باريس بطائرة خاصة ومعنا كلبنا. ماذا نحتاج؟',
   a:['الكلب يحتاج شريحة إلكترونية وتطعيمًا ساريًا ضد السعار، ثم انتظار 21 يومًا بعد التطعيم قبل السفر.','ويلزم شهادة صحية أوروبية من طبيب بيطري رسمي في بلد المغادرة، قبل الوصول بعشرة أيام على الأكثر.','وقد يُطلب فحص أجسام مضادة حسب بلد المغادرة.'],
   src:'المفوضية الأوروبية · Your Europe',date:'2026-10-25'},
  {chip:'رجل أعمال إلى نيويورك',q:'أسافر إلى نيويورك بطائرة خاصة. ما إجراءات الوصول؟',
   a:['الوصول الدولي إلى أمريكا يتطلب إشعارًا مسبقًا يرسله المشغّل إلكترونيًا، وإذنًا بالهبوط من الجمارك وحماية الحدود (CBP).','في تيتربورو يتواصل الطيار مع CBP قبل الإقلاع بساعتين على الأقل. والإذن يسمح بهامش نصف ساعة، فإن خرج الوصول عنه يُطلب الإذن من جديد.','جهّز جوازات الركاب وتأشيراتهم.'],
   src:'CBP · General Aviation Airport Fact Sheet: Teterboro',date:'2026-10-25'},
  {chip:'وفد إلى أوروبا',q:'رحلة خاصة من خارج شنغن إلى أوروبا، كيف يتم العبور الحدودي؟',
   a:['العبور يتم عبر نقاط حدودية رسمية فقط وخلال ساعات عملها.','وفي الرحلات الخاصة يبلّغ القبطان حرس الحدود في دولة الوصول قبل الرحلة، وعمليًا يتم ذلك بالإقرار العام (General Declaration).'],
   src:'قانون حدود شنغن · اللائحة (EU) 2016/399',date:'2026-10-25'},
  {chip:'كم السعر؟',q:'كم تكلفة الرحلة من الرياض إلى جدة غدًا؟',
   a:['السعر وتوفر الطائرة لا أستطيع تأكيدهما بنفسي، فالمشغّل هو من يؤكدهما.','أجهّز طلبك وأسلّمه لفريقنا ليتواصل مع المشغّل ويعود إليك.'],hand:'يتأكد مع فريقنا'}]},
 en:{badge:'AI · Final confirmation by our team',lead:'Your smart companion for everything about your private trip. It answers from documented sources, and tells you plainly when a human has to confirm.',demo:'Illustrative example',cta:'Request your trip with Rafiq',
  note:'The conversation above is a pre-written illustration. Answers come from approved knowledge entries, and Rafiq never confirms a price or an aircraft’s availability.',srcL:'Source',chipsL:'Try a scenario',name:'Rafiq',role:'Your Eye King companion',
  b2bT:'Rafiq for your platform',b2bP:'We are preparing Rafiq to be embedded in partner platforms, answering your customers’ private-flight questions in your voice and with documented sources.',tags:['Hotels & resorts','Travel agencies','Booking platforms','Concierge & corporate'],b2bC:'Contact us about a partnership',
  S:[
  {chip:'Family with a dog',q:'We are flying to Paris on a private jet with our dog. What do we need?',
   a:['The dog needs a microchip and a valid rabies vaccination, then a 21-day wait after the vaccination before travelling.','An EU animal health certificate from an official vet in the departure country is required, issued no more than 10 days before arrival.','A rabies antibody test may be required depending on the country of departure.'],
   src:'European Commission · Your Europe',date:'2026-10-25'},
  {chip:'Executive to New York',q:'I am flying to New York on a private jet. What are the arrival steps?',
   a:['International arrivals into the US need an advance notice of arrival sent electronically by the operator, and landing permission from CBP.','For Teterboro the pilot contacts CBP at least 2 hours before departure. The permission allows a 30-minute tolerance; outside it, permission must be obtained again.','Have passengers’ passports and visas ready.'],
   src:'CBP · General Aviation Airport Fact Sheet: Teterboro',date:'2026-10-25'},
  {chip:'Delegation to Europe',q:'A private flight from outside Schengen into Europe: how does the border crossing work?',
   a:['Crossing is only at official border crossing points and during their opening hours.','On private flights the captain notifies the border guards of the destination state before the flight, and in practice this is done with a General Declaration.'],
   src:'Schengen Borders Code · Regulation (EU) 2016/399',date:'2026-10-25'},
  {chip:'How much?',q:'How much is the flight from Riyadh to Jeddah tomorrow?',
   a:['I cannot confirm price or aircraft availability myself. The operator confirms both.','I will prepare your request and hand it to our team to contact the operator and come back to you.'],hand:'Confirmed by our team'}]}
};
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const Eye=()=><svg viewBox="0 0 48 30" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 15S11 3 24 3s21 12 21 12-8 12-21 12S3 15 3 15z"/><circle cx="24" cy="15" r="6.5"/><circle cx="24" cy="15" r="2.6" fill="currentColor"/></svg>;
export default function Rafiq(){
 const {lang}=useI18n(),T=D[lang==='ar'?'ar':'en'],[i,setI]=useState(0),[n,setN]=useState(0),[auto,setAuto]=useState(true);
 const s=T.S[i],all=s.a.join('\n').length,still=calm();
 useEffect(()=>{setN(still?all:0)},[i,lang,all,still]);
 useEffect(()=>{if(still||n>=all)return;const id=setTimeout(()=>setN(x=>x+2),16);return()=>clearTimeout(id)},[n,all,still]);
 useEffect(()=>{if(still||!auto||n<all)return;const id=setTimeout(()=>setI(x=>(x+1)%T.S.length),5200);return()=>clearTimeout(id)},[n,all,auto,still,T.S.length]);
 let left=n;const done=n>=all;
 return <section className="rf" id="rafiq" aria-labelledby="rf-h">
  <div className="rf-in">
   <div className="rf-copy">
    <span className="rf-badge">{T.badge}</span>
    <h2 id="rf-h">{T.name}</h2>
    <p className="rf-lead">{T.lead}</p>
    <p className="rf-cl">{T.chipsL}</p>
    <div className="rf-chips" role="group" aria-label={T.chipsL}>{T.S.map((x,k)=><button key={k} type="button" aria-pressed={i===k} onClick={()=>{setAuto(false);setI(k)}}>{x.chip}</button>)}</div>
    <a className="rf-cta" href="?view=ask">{T.cta}<svg className="rf-ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></a>
    <p className="rf-note">{T.note}</p>
   </div>
   <div className="rf-panel">
    <div className="rf-head"><span className="rf-av"><Eye/></span><div><b>{T.name}</b><small>{T.role}</small></div><span className="rf-demo">{T.demo}</span></div>
    <div className="rf-body" key={i+lang}>
     <p className="rf-u">{s.q}</p>
     <div className="rf-r">{s.a.map((l,k)=>{const t=l.slice(0,Math.max(0,left));left-=l.length+1;return t?<p key={k}>{t}{!done&&left<0&&<i className="rf-cur"/>}</p>:null})}
      {done&&<div className="rf-meta">{s.src&&<span className="rf-src"><em>{T.srcL}</em> {s.src} · {s.date}</span>}{s.hand&&<span className="rf-hand">{s.hand}</span>}</div>}
     </div>
    </div>
   </div>
  </div>
  <div className="rf-b2b">
   <div><h3>{T.b2bT}</h3><p>{T.b2bP}</p></div>
   <ul>{T.tags.map(x=><li key={x}>{x}</li>)}</ul>
   {PARTNER_MAIL&&<a className="rf-cta rf-cta2" href={`mailto:${PARTNER_MAIL}`}>{T.b2bC}</a>}
  </div>
 </section>;
}
