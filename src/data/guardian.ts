import type {Companion,Priority,RouteWx} from './types';
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

// «إيش الأهم لك»: خيار واحد يقوله العميل بنفسه. يُحفظ ويُعرض فقط، ولا نستنتج منه شيئًا عن العميل.
export const PRIORITIES:Priority[]=['EARLY','PRIVACY','COMFORT','NO_WAIT'];
export const isPriority=(v:unknown):v is Priority=>typeof v==='string'&&(PRIORITIES as string[]).includes(v);
// سطر حالة الرحلة: حتمي من آخر رصد رسمي CURRENT فقط (طقس المطار وقت آخر رصد، لا وقت الوصول).
// «ما يستحق الانتباه» له تعريف واحد (concern) يقرأ منه سطر الحالة وبطاقة الحارس معًا، حتى لا يقول أحدهما «لا شيء» والآخر يحذّر.
// لا نقول إن شيئًا «لا يؤثر» إلا لو عندنا رصد حديث ومفهوم (نوع الرصد معروف وعمره معروف) للمطارين، ونذكر عمر الرصد صراحة.
// وحالة «محتاج قرارك» غير موجودة عمدًا: لا يوجد بعد خيار فعلي يقرّره العميل.
export type TripState='LOADING'|'NO_DATA'|'PARTIAL'|'ON_TRACK'|'WATCHING';
const BAD_CAT=new Set(['MVFR','IFR','LIFR']);
const concern=(r:RouteWx,arrival:boolean)=>{
 if(r.cat!=null&&BAD_CAT.has(r.cat))return true;
 if(r.windKt!=null&&r.windKt>=WIND_KT)return true;
 if(arrival&&r.tempC!=null){const T=Math.round(Number(r.tempC));if(T<=COLD_C||T>=HOT_C)return true}
 return false};
const usable=(r:RouteWx)=>r.status==='CURRENT'&&r.cat!=null&&r.ageMin!=null;
export interface Status<S>{state:S;code:string;age:number}
export function tripStatus(wx:RouteWx[]|null):Status<TripState>{
 if(!wx)return{state:'LOADING',code:'',age:0};
 const cur=wx.filter(r=>r.status==='CURRENT'),bad=cur.find(r=>concern(r,r.leg==='arr'));
 if(bad)return{state:'WATCHING',code:bad.code,age:0};
 const ok=cur.filter(usable),legs=new Set(ok.map(r=>r.leg)),age=ok.reduce((m,r)=>Math.max(m,r.ageMin??0),0);
 if(legs.size>=2)return{state:'ON_TRACK',code:'',age};
 if(legs.size===1)return{state:'PARTIAL',code:'',age};
 return{state:'NO_DATA',code:'',age:0}}

// «مهمتي»: مطار واحد فقط (الوجهة). نفس تعريف concern، ونفس الصدق: لا «هادئ» بدون رصد حديث ومفهوم.
export type MissionState='LOADING'|'NO_DATA'|'CALM'|'WATCHING';
export function missionStatus(wx:RouteWx[]|null):Status<MissionState>{
 if(!wx)return{state:'LOADING',code:'',age:0};
 const cur=wx.filter(r=>r.status==='CURRENT'),bad=cur.find(r=>concern(r,true));
 if(bad)return{state:'WATCHING',code:bad.code,age:0};
 const ok=cur.filter(usable);
 if(ok.length)return{state:'CALM',code:ok[0].code,age:ok.reduce((m,r)=>Math.max(m,r.ageMin??0),0)};
 return{state:'NO_DATA',code:wx[0]?.code??'',age:0}}
