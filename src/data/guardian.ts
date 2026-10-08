import type {Companion,RouteWx} from './types';
// «الحارس الأمين»: قواعد حتمية تحوّل الطقس الحالي + من يسافر معك إلى اقتراح واحد قصير. لا ذكاء غامض هنا.
// الحدود الصادقة: (1) نستعمل الرصد الحالي CURRENT فقط، وهو الطقس الآن لا وقت الوصول، فالصياغة شرطية («لو بقي كذلك»).
// (2) الاقتراح لا يُنفَّذ ولا يُرسَل. (3) لا نقول إن الجو آمن للطيران ولا إن الرحلة ستتأخر: هذا قرار المشغّل والطاقم.
export const COMPANIONS:Companion[]=['CHILDREN','LESS_WALKING','MEETING_AFTER'];
export const COLD_C=10,HOT_C=38,WIND_KT=25;
export type TipId='cold.kids'|'cold.walk'|'cold'|'hot.walk'|'hot.kids'|'hot'|'wind'|'lowvis'|'meeting';
export interface Tip{id:TipId;code:string;vars:Record<string,string|number>}
const has=(c:Companion[],k:Companion)=>c.includes(k);
export function guardianTips(wx:RouteWx[]|null,companions:Companion[]):Tip[]{
 const out:Tip[]=[];if(!wx)return out;
 const cur=wx.filter(r=>r.status==='CURRENT'),arr=cur.find(r=>r.leg==='arr');
 // البرد والحر: مطار الوصول فقط (هو ما يحدد تجهيز الاستقبال)
 if(arr&&arr.tempC!=null){const T=Math.round(Number(arr.tempC));
  if(T<=COLD_C)out.push({id:has(companions,'CHILDREN')?'cold.kids':has(companions,'LESS_WALKING')?'cold.walk':'cold',code:arr.code,vars:{t:T}});
  else if(T>=HOT_C)out.push({id:has(companions,'LESS_WALKING')?'hot.walk':has(companions,'CHILDREN')?'hot.kids':'hot',code:arr.code,vars:{t:T}})}
 // الرياح القوية والرؤية المنخفضة: أي من المطارين، مرة واحدة لكل نوع (الأسوأ أولًا)
 const w=cur.filter(r=>r.windKt!=null&&r.windKt>=WIND_KT).sort((a,b)=>(b.windKt??0)-(a.windKt??0))[0];
 if(w)out.push({id:'wind',code:w.code,vars:{k:w.windKt??0}});
 const v=cur.find(r=>r.cat==='IFR'||r.cat==='LIFR');
 if(v)out.push({id:'lowvis',code:v.code,vars:{}});
 // اجتماع بعد الهبوط: اقتراح ثابت لا يحتاج رصدًا، ولا يتضمن أرقامًا مخترعة
 if(has(companions,'MEETING_AFTER'))out.push({id:'meeting',code:arr?.code??'',vars:{}});
 return out}
