import {useState} from 'react';
import {useI18n} from './i18n';
import Route from './Route';
import BriefTicker,{briefLabel,type BriefCard} from './BriefTicker';
// معاينة شريط العروض ببيانات توضيحية موسومة (?view=brief). لا اتصال بالقاعدة ولا أي عرض حقيقي.
const day=(h:number)=>new Date(Date.now()+h*36e5).toISOString();
const DEMO:BriefCard[]=[
 {id:'1',route:<Route from="Jeddah" to="Riyadh"/>,cabin:'Midsize jet · 7 seats',price:38000,currency:'SAR',status:'PRESENTED',until:day(20)},
 {id:'2',route:<Route from="Riyadh" to="Dubai"/>,cabin:'Super-midsize · 9 seats',price:52000,currency:'SAR',status:'PRESENTED',until:day(30)},
 {id:'3',route:<Route from="Jeddah" to="Abha"/>,cabin:'Light jet · 6 seats',price:21000,currency:'SAR',status:'ACCEPTED',until:day(10)},
 {id:'4',route:<Route from="Dammam" to="Riyadh"/>,cabin:'Midsize jet · 8 seats',price:19500,currency:'SAR',status:'CONFIRMED',until:day(48)}];
const X={ar:{h:'عروضك',sub:'أمثلة توضيحية. لا شيء هنا حقيقي ولا مرتبط بالقاعدة.',why:'ليه دي ليك؟',whyT:'مناسبة لاجتماعك الخميس ١٠ صباحًا، وتصل قبله بساعة.',flex:'مرونة الموعد',flexT:'تقدر تتحرك ± ساعتين بنفس السعر.',unk:'ما لم يتأكد بعد',unkT:'التأكيد النهائي من المشغّل بعد قبولك. القبول تسجيل رغبة وليس حجزًا.',go:'أريد المتابعة',alt:'ابحث عن بديل',watch:'راقبها',demo:'نموذج توضيحي'},
 en:{h:'Your offers',sub:'Illustrative examples. Nothing here is real or connected to the database.',why:'Why this one?',whyT:'It fits your Thursday 10:00 meeting and lands an hour before.',flex:'Time flexibility',flexT:'You can move ± 2 hours at the same price.',unk:'Not confirmed yet',unkT:'Final confirmation comes from the operator after you accept. Accepting records your wish; it is not a booking.',go:'Continue',alt:'Find an alternative',watch:'Watch it',demo:'Illustrative demo'}};
export default function BriefDemo(){
 const {lang}=useI18n();const t=X[lang==='ar'?'ar':'en'];const [sel,setSel]=useState(0);const c=DEMO[sel];
 const fmt=(i:string)=>new Date(i).toLocaleString(lang==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'});
 return <main className="bf-demo" dir={lang==='ar'?'rtl':'ltr'}><span className="bf-rib">{t.demo}</span><h1>{t.h}</h1><p style={{opacity:.7}}>{t.sub}</p>
  <BriefTicker cards={DEMO} sel={sel} onSel={setSel} loop fmt={fmt}/>
  <section className="bf-big"><span className={`bf-rib${c.status==='CONFIRMED'?' o':''}`}>{briefLabel(c.status,lang)}</span>
   <p style={{fontSize:18}}>{c.route}</p><h3><bdi>{c.cabin}</bdi></h3><p style={{fontSize:26,fontFamily:'Amiri,serif'}} dir="ltr">{new Intl.NumberFormat('en-US').format(c.price)} {c.currency}</p>
   <p className="sm"><b>{t.why}</b> {t.whyT}</p>
   <div className="bf-flex"><b>{t.flex}</b><input type="range" min="-2" max="2" defaultValue="0" aria-label={t.flex}/></div><p className="sm">{t.flexT}</p>
   <p className="sm"><b>{t.unk}</b> {t.unkT}</p>
   <div className="bf-act"><button type="button" disabled>{t.go}</button><button type="button" className="g" disabled>{t.alt}</button><button type="button" className="g" disabled>{t.watch}</button></div></section></main>;
}
