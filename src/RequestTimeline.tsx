import './status.css';
// خط زمن الطلب بخمس مراحل. يُحسب من حالة الطلب الفعلية فقط، ولا يتحرك ولا يكتمل من تلقاء نفسه.
// «بانتظار تأكيد المشغّل» مرحلة مستقلة عن «مؤكد»، لأن قبول العميل نية حجز وليس حجزًا.
const STEPS={ar:['استلمنا طلبك','نبحث ونتحقق','عرضك جاهز','بانتظار تأكيد المشغّل','مؤكدة'],en:['Request received','Searching & checking','Your offer is ready','Awaiting operator confirmation','Confirmed']};
const AT:Record<string,number>={new:0,search:1,prep:1,offer:2,acc:3,conf:4};
export default function RequestTimeline({group,lang}:{group:string;lang:string}){
 const at=AT[group];if(at===undefined)return null;
 const L=STEPS[lang==='ar'?'ar':'en'];
 return <ol className="rt-tl" aria-label={L[at]}>{L.map((x,i)=><li key={i} className={i<at?'done':i===at?'now':''} aria-current={i===at?'step':undefined}><i aria-hidden/><span>{x}</span></li>)}</ol>;
}
