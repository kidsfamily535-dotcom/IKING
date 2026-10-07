// جغرافيا الكابينة. إحداثيات مطارات حقيقية، وكل ما يُحسب منها (مسافة، زمن، توقيت) تقدير يُعلَّم بذلك في الواجهة.
export interface Hub{iata:string;ar:string;en:string;lat:number;lon:number;tz:string;pri:number}
// pri: أولوية ظهور الاسم على الرادار (الأصغر أهم). LON = لندن (إحداثيات فارنبره، مطار الطيران الخاص الأشهر هناك).
export const HUBS:Hub[]=[
 {iata:'RUH',ar:'الرياض',en:'Riyadh',lat:24.9576,lon:46.6988,tz:'Asia/Riyadh',pri:1},
 {iata:'JED',ar:'جدة',en:'Jeddah',lat:21.6796,lon:39.1565,tz:'Asia/Riyadh',pri:2},
 {iata:'DMM',ar:'الدمام',en:'Dammam',lat:26.4712,lon:49.7979,tz:'Asia/Riyadh',pri:6},
 {iata:'MED',ar:'المدينة',en:'Madinah',lat:24.5534,lon:39.7051,tz:'Asia/Riyadh',pri:8},
 {iata:'DXB',ar:'دبي',en:'Dubai',lat:25.2532,lon:55.3657,tz:'Asia/Dubai',pri:2},
 {iata:'AUH',ar:'أبوظبي',en:'Abu Dhabi',lat:24.433,lon:54.6511,tz:'Asia/Dubai',pri:7},
 {iata:'DOH',ar:'الدوحة',en:'Doha',lat:25.2731,lon:51.6081,tz:'Asia/Qatar',pri:3},
 {iata:'KWI',ar:'الكويت',en:'Kuwait',lat:29.2266,lon:47.9689,tz:'Asia/Kuwait',pri:5},
 {iata:'BAH',ar:'البحرين',en:'Bahrain',lat:26.2708,lon:50.6336,tz:'Asia/Bahrain',pri:9},
 {iata:'MCT',ar:'مسقط',en:'Muscat',lat:23.5933,lon:58.2844,tz:'Asia/Muscat',pri:7},
 {iata:'CAI',ar:'القاهرة',en:'Cairo',lat:30.1219,lon:31.4056,tz:'Africa/Cairo',pri:3},
 {iata:'AMM',ar:'عمّان',en:'Amman',lat:31.7226,lon:35.9932,tz:'Asia/Amman',pri:8},
 {iata:'IST',ar:'إسطنبول',en:'Istanbul',lat:41.2753,lon:28.7519,tz:'Europe/Istanbul',pri:4},
 {iata:'LON',ar:'لندن',en:'London',lat:51.2758,lon:-0.7763,tz:'Europe/London',pri:1},
 {iata:'CDG',ar:'باريس',en:'Paris',lat:49.0097,lon:2.5479,tz:'Europe/Paris',pri:2},
 {iata:'GVA',ar:'جنيف',en:'Geneva',lat:46.237,lon:6.1089,tz:'Europe/Zurich',pri:4},
 {iata:'MXP',ar:'ميلانو',en:'Milan',lat:45.6306,lon:8.7281,tz:'Europe/Rome',pri:9},
 {iata:'NCE',ar:'نيس',en:'Nice',lat:43.6584,lon:7.2159,tz:'Europe/Paris',pri:6},
];
export const hub=(i:string):Hub=>HUBS.find(h=>h.iata===i)??HUBS[0];
type LL={lat:number;lon:number};
const RAD=Math.PI/180,ER=6371;
export const dist=(a:LL,b:LL)=>{const dp=(b.lat-a.lat)*RAD,dl=(b.lon-a.lon)*RAD,x=Math.sin(dp/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dl/2)**2;return 2*ER*Math.asin(Math.min(1,Math.sqrt(x)))};
// نقطة على الدائرة العظمى بين a وb عند الكسر f (0..1)
export function between(a:LL,b:LL,f:number):LL{
 const d=dist(a,b)/ER;if(d<1e-6)return a;
 const A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d),
  x=A*Math.cos(a.lat*RAD)*Math.cos(a.lon*RAD)+B*Math.cos(b.lat*RAD)*Math.cos(b.lon*RAD),
  y=A*Math.cos(a.lat*RAD)*Math.sin(a.lon*RAD)+B*Math.cos(b.lat*RAD)*Math.sin(b.lon*RAD),
  z=A*Math.sin(a.lat*RAD)+B*Math.sin(b.lat*RAD);
 return{lat:Math.atan2(z,Math.hypot(x,y))/RAD,lon:Math.atan2(y,x)/RAD};
}
// إسقاط الرادار: بُعد حقيقي من المركز واتجاه حقيقي، لكن نصف القطر مضغوط بالجذر التربيعي
// كي لا تنحشر مطارات الخليج القريبة عند المركز. حلقات الرادار تحمل أرقام الكيلومترات الحقيقية.
export const RADIUS=270;
export const rr=(d:number,range:number)=>RADIUS*Math.sqrt(Math.min(d,range)/range);
export function plot(c:LL,p:LL,range:number){
 const dl=(p.lon-c.lon)*RAD,p1=c.lat*RAD,p2=p.lat*RAD,d=dist(c,p),
  th=Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl)),r=rr(d,range);
 return{x:300+r*Math.sin(th),y:300-r*Math.cos(th),d};
}
export const rangeFor=(d:number|null)=>d===null?5600:Math.max(2600,Math.ceil(d*1.2/100)*100);
// زمن الطيران التقديري: سرعة إبحار 850 كم/س + 25 دقيقة إقلاع وهبوط. تقدير فقط، والمشغّل يؤكد الرقم الفعلي.
export const flightMin=(km:number)=>Math.round(km/850*60+25);
export const hm=(min:number)=>`${Math.floor(min/60)}:${String(min%60).padStart(2,'0')}`;
// توقيت
const offMin=(ts:number,tz:string)=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ts)).map(x=>[x.type,x.value]));
 return(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-ts)/60000;
};
export function localToUtc(date:string,time:string,tz:string):number{
 const [y,m,d]=date.split('-').map(Number),[h,mi]=time.split(':').map(Number),g=Date.UTC(y,m-1,d,h,mi);
 let u=g-offMin(g,tz)*60000;u=g-offMin(u,tz)*60000;return u;
}
export const clock=(ts:number,tz:string,lang:string)=>new Intl.DateTimeFormat(lang==='ar'?'en-GB':lang,{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ts));
// هل يتغير فرق التوقيت في المطار (تغيير الساعة) بين ما قبل الإقلاع بيوم والوصول؟
export const clocksChange=(tz:string,depUtc:number,arrUtc:number)=>offMin(depUtc-864e5,tz)!==offMin(arrUtc,tz);
