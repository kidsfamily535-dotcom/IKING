import {useI18n,type Lang} from '../i18n';
import {Truth} from './parts';
// غرفة الوسيط (داخلية). كل الأرقام أمثلة توضيحية معلّمة محاكاة، وليست عروض حقيقية. الهامش لا يظهر لأي عميل أو مشغّل.
type B={wait:string;w:string[];q:string;op:string;price:string;note:string;n:string[];internal:string;play:string;seen:string;cust:string;oper:string;c:string[];o:string[]};
const X:Record<Lang,B>={
en:{wait:'Waiting for your decision',w:['Approve the Riyadh availability message','Choose between two aircraft for Cairo to Paris','Review the client offer draft'],q:'Operator quotes',op:'Operator',price:'Price',note:'Note',
 n:['Lowest price','Better positioning, lower operational risk','Highest price'],internal:'Internal only. Never shown to the client or the operator.',play:'Illustrative: client quote 69k, operator target 57–59k, margin 10–12k.',
 seen:'Who sees what',cust:'The client sees',oper:'The operator sees',c:['Options, timing and the next step','Price once an operator has confirmed it','Their own preferences'],o:['The mission and what to confirm','Passenger count and baggage','Never the margin or competing quotes']},
ar:{wait:'بانتظار قرارك',w:['إقرار رسالة توافر الرياض','المفاضلة بين طائرتين لرحلة القاهرة إلى باريس','مراجعة مسودة عرض العميل'],q:'عروض المشغّلين',op:'المشغّل',price:'السعر',note:'ملاحظة',
 n:['الأدنى سعرًا','تموضع أنسب ومخاطر تشغيلية أدنى','الأعلى سعرًا'],internal:'للاستخدام الداخلي فقط، ولا يُعرَض على العميل ولا على المشغّل.',play:'مثال توضيحي: عرض العميل 69 ألفًا، هدف المشغّل 57–59 ألفًا، الهامش 10–12 ألفًا.',
 seen:'ما يراه كل طرف',cust:'العميل يرى',oper:'المشغّل يرى',c:['الخيارات والتوقيت والخطوة التالية','السعر بعد أن يؤكده مشغّل','تفضيلاته هو فقط'],o:['المهمة وما المطلوب تأكيده','عدد الركاب والأمتعة','لا الهامش ولا عروض المنافسين']},
tr:{wait:'Kararınızı bekliyor',w:['Riyad müsaitlik mesajını onayla','Kahire–Paris için iki uçak arasında seç','Müşteri teklif taslağını incele'],q:'Operatör teklifleri',op:'Operatör',price:'Fiyat',note:'Not',
 n:['En düşük fiyat','Daha iyi konum, daha düşük operasyon riski','En yüksek fiyat'],internal:'Yalnızca dahili. Müşteriye ve operatöre asla gösterilmez.',play:'Örnek: müşteri teklifi 69 bin, operatör hedefi 57–59 bin, marj 10–12 bin.',
 seen:'Kim neyi görür',cust:'Müşteri görür',oper:'Operatör görür',c:['Seçenekler, zamanlama ve sonraki adım','Fiyat, bir operatör onayladıktan sonra','Yalnızca kendi tercihleri'],o:['Görev ve onaylanacaklar','Yolcu sayısı ve bagaj','Asla marj veya rakip teklifler']},
ru:{wait:'Ждёт вашего решения',w:['Одобрить сообщение о доступности в Эр-Рияде','Выбрать из двух самолётов для Каир — Париж','Проверить черновик предложения клиенту'],q:'Предложения операторов',op:'Оператор',price:'Цена',note:'Заметка',
 n:['Самая низкая цена','Лучшее расположение, ниже операционный риск','Самая высокая цена'],internal:'Только внутри. Клиент и оператор этого не видят.',play:'Пример: предложение клиенту 69 тыс., цель по оператору 57–59 тыс., маржа 10–12 тыс.',
 seen:'Кто что видит',cust:'Клиент видит',oper:'Оператор видит',c:['Варианты, время и следующий шаг','Цену — после подтверждения оператором','Только свои предпочтения'],o:['Рейс и что подтвердить','Число пассажиров и багаж','Никогда маржу и предложения конкурентов']}};
export default function BrokerRoom(){
 const {lang}=useI18n();const t=X[lang];const P=['58k','61k','67k'];
 return <div className="brk">
  <h3 className="bh">{t.wait}<Truth sim/></h3>
  <ul className="bl">{t.w.map(x=><li key={x}>{x}</li>)}</ul>
  <h3 className="bh">{t.q}<Truth sim/></h3>
  <table className="bt"><thead><tr><th>{t.op}</th><th>{t.price}</th><th>{t.note}</th></tr></thead>
   <tbody>{P.map((p,i)=><tr key={p}><td>{'ABC'[i]}</td><td dir="ltr">${p}</td><td>{t.n[i]}</td></tr>)}</tbody></table>
  <div className="nt e"><b>{t.internal}</b><br/>{t.play}</div>
  <h3 className="bh">{t.seen}</h3>
  <div className="who"><div><b>{t.cust}</b><ul>{t.c.map(x=><li key={x}>{x}</li>)}</ul></div><div><b>{t.oper}</b><ul>{t.o.map(x=><li key={x}>{x}</li>)}</ul></div></div>
 </div>;
}
