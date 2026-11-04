import './eyefollow.css';
// كارت «العين بتتابع»: يعرض حالة الطلب الفعلية فقط. لا يتحرك ولا يكتمل من تلقاء نفسه.
// الخطوة تأتي من loop_status الحقيقي (نفس تجميع RequestTimeline). عند الإرسال كضيف نعرض «استلمنا طلبك» فقط لأن هذا ما حدث فعلًا.
// الإنسان المسؤول يظهر بالمسمّى. وعد زمن الرد يظهر فقط إذا حُدّد رقم حقيقي في RESPONSE_PROMISE (الآن: لا وعد).
export const RESPONSE_PROMISE:{ar:string;en:string}|null=null; // مثال لاحقًا: {ar:'رد بشري خلال 30 دقيقة في ساعات العمل',en:'A human reply within 30 minutes during working hours'}
type Lang='ar'|'en'|'tr'|'ru';
const AT:Record<string,number>={new:0,search:1,prep:1,offer:2,acc:3,conf:4};
export const GROUP:Record<string,string>={NEW_REQUEST:'new',SEARCHING:'search',OPERATOR_CONTACTED:'search',AWAITING_OFFER:'search',OFFER_RECEIVED:'prep',BROKER_REVIEW:'prep',PRESENTED:'offer',ACCEPTED:'acc',AWAITING_BOOKING:'acc',CONFIRMED:'conf'};
const L:Record<Lang,{h:string;mgr:string;steps:string[];done:string;now:string;wait:string;note:string;badge:{est:string;pend:string;conf:string}}>={
 ar:{h:'العين بتتابع طلبك',mgr:'مديرك الشخصي في iKing',steps:['استلمنا طلبك','نبحث ونتحقق','عرضك جاهز','بانتظار تأكيد المشغّل','مؤكدة'],done:'تم',now:'الآن',wait:'لاحقًا',note:'كل خطوة تتحرك فقط عندما تحدث فعلًا. لا شيء يتأكد قبل تأكيد المشغّل وفريقنا.',badge:{est:'تقديري',pend:'بانتظار تأكيد المشغّل',conf:'مؤكد'}},
 en:{h:'The Eye is following your request',mgr:'Your personal manager at iKing',steps:['Request received','Searching & checking','Your offer is ready','Awaiting operator confirmation','Confirmed'],done:'Done',now:'Now',wait:'Later',note:'Each step moves only when it really happens. Nothing is confirmed before the operator and our team confirm it.',badge:{est:'Estimate',pend:'Awaiting operator confirmation',conf:'Confirmed'}},
 tr:{h:'Göz talebinizi takip ediyor',mgr:'iKing kişisel yöneticiniz',steps:['Talep alındı','Arıyor ve doğruluyoruz','Teklifiniz hazır','Operatör onayı bekleniyor','Onaylandı'],done:'Tamam',now:'Şimdi',wait:'Sonra',note:'Her adım yalnızca gerçekten gerçekleştiğinde ilerler. Operatör ve ekibimiz onaylamadan hiçbir şey kesinleşmez.',badge:{est:'Tahmini',pend:'Operatör onayı bekleniyor',conf:'Onaylandı'}},
 ru:{h:'Глаз следит за вашим запросом',mgr:'Ваш личный менеджер в iKing',steps:['Запрос получен','Ищем и проверяем','Предложение готово','Ждём подтверждения оператора','Подтверждено'],done:'Готово',now:'Сейчас',wait:'Позже',note:'Каждый шаг меняется, только когда это действительно произошло. Ничто не подтверждено, пока не подтвердят оператор и наша команда.',badge:{est:'Оценка',pend:'Ждём подтверждения оператора',conf:'Подтверждено'}}};
// وسم الصدق: تقديري / بانتظار تأكيد المشغّل / مؤكد. النص ظاهر دائمًا، والشكل يساعد فقط.
export function CertBadge({kind,lang}:{kind:'est'|'pend'|'conf';lang:string}){
 const T=L[(lang in L?lang:'en') as Lang].badge;
 return <span className={`efc-cb efc-cb-${kind}`}><i aria-hidden/>{T[kind]}</span>;
}
export default function EyeFollowCard({group,lang}:{group:string;lang:string}){
 const at=AT[group];if(at===undefined)return null;
 const T=L[(lang in L?lang:'en') as Lang];
 return <aside className="efc" aria-label={T.h}>
  <header><span className="efc-eye" aria-hidden/><b>{T.h}</b></header>
  <ol>{T.steps.map((s,i)=>{const st=i<at?'done':i===at?'now':'wait';
   return <li key={i} className={`efc-${st}`} aria-current={st==='now'?'step':undefined}><i aria-hidden/><span>{s}</span>
    <em>{st==='done'?T.done:st==='now'?T.now:T.wait}</em>
    {i===3&&st==='now'&&<CertBadge kind="pend" lang={lang}/>}
    {i===4&&st==='now'&&<CertBadge kind="conf" lang={lang}/>}</li>})}</ol>
  <p className="efc-mgr"><span aria-hidden>🧑‍💼</span>{T.mgr}</p>
  {RESPONSE_PROMISE&&<p className="efc-sla">{lang==='ar'?RESPONSE_PROMISE.ar:RESPONSE_PROMISE.en}</p>}
  <small>{T.note}</small>
 </aside>;
}
