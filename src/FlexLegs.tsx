import {useState} from 'react';
import {sb} from './lib/supabase';
import {Switch} from './cabin/Switch';
import {useI18n,type Lang} from './i18n';
import Route from './Route';
import './profile.css';

// الرحلات الفاضية المناسبة لطلب العميل ضمن مرونته (list_my_flexible_legs). الترتيب ثابت من القاعدة: الأقرب أولًا، بلا ذكاء اصطناعي.
// كل نتيجة موسومة بسبب المرونة (مطابقة دقيقة / مطار بديل / تغيير يوم) ومعها تنبيه صادق بأن الرحلة الفاضية قد تتغير.
// نص التنبيه من القاعدة بالعربية؛ لغير العربية نستعمل ترجمة ثابتة هنا. وهذا عرض فقط، لا حجز ولا التزام.
type Leg={availability_id:string;origin_code:string;origin_name_ar:string|null;destination_code:string;destination_name_ar:string|null;departure_from:string;departure_until:string;
 seats:number;match_kind:'EXACT'|'FLEX';relaxations:string[]|null;day_shift:number;confidence:string;verified_at:string|null;is_demo:boolean;notice_ar:string};
const P:Record<'ar'|'en',Record<string,string>>={
ar:{open:'رحلات فاضية تناسب مرونتك',close:'إخفاء',none:'لا توجد رحلة فاضية مناسبة الآن',err:'تعذّر تحميل الرحلات الفاضية.',loading:'جارٍ البحث…',
 EXACT:'مطابقة دقيقة',ALT_ORIGIN:'مطار مغادرة بديل',ALT_DESTINATION:'مطار وصول بديل',DATE_SHIFT:'تغيير في اليوم',seats:'مقاعد',demo:'بيانات تجريبية',
 until:'حتى',notice:'رحلة فاضية قد تتغير أو تُلغى إن تغيّرت خطة المشغّل. التأكيد النهائي بعد موافقة المشغّل.',more:'رحلة فاضية بتاريخ مختلف بـ'},
en:{open:'Empty legs that fit your flexibility',close:'Hide',none:'No suitable empty leg right now',err:'Could not load empty legs.',loading:'Searching…',
 EXACT:'Exact match',ALT_ORIGIN:'Alternate departure airport',ALT_DESTINATION:'Alternate arrival airport',DATE_SHIFT:'Different day',seats:'seats',demo:'Demo data',
 until:'until',notice:'An empty leg can change or be cancelled if the operator\'s plan changes. Final confirmation comes after the operator agrees.',more:'Date differs by'}};
const LOC:Record<Lang,string>={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'};

export default function FlexLegs({requestId,nm}:{requestId:string;nm:(c:string)=>string}){
 const {lang}=useI18n();const t=P[lang==='ar'?'ar':'en'];
 const [shown,setShown]=useState(false),[legs,setLegs]=useState<Leg[]|null>(null),[err,setErr]=useState(false);
 const dt=(s:string)=>new Date(s).toLocaleString(LOC[lang],{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'});
 const load=async()=>{setErr(false);setLegs(null);const {data,error}=await sb.rpc('list_my_flexible_legs',{p_request:requestId});
  if(error){setErr(true);setLegs([]);return}setLegs((data??[]) as Leg[])};
 const toggle=()=>{if(shown){setShown(false);return}setShown(true);load()};
 return <div className="pf">
  <div className="pf-go"><Switch small label={shown?t.close:t.open} onActivate={toggle}/></div>
  {shown&&<>
   {legs===null&&<p className="dim sm" role="status">{t.loading}</p>}
   {err&&<div className="nt" role="alert">{t.err}</div>}
   {legs&&!err&&!legs.length&&<p className="dim sm">{t.none}</p>}
   {legs&&legs.length>0&&<><ul className="pf-legs">{legs.map(l=><li key={l.availability_id}>
    <span className="rt"><Route from={nm(l.origin_code)} to={nm(l.destination_code)}/></span>
    <span className="dim sm">{dt(l.departure_from)} · {t.until} {dt(l.departure_until)} · {l.seats} {t.seats}</span>
    <span className="pf-tags">
     {l.match_kind==='EXACT'?<span className="badge">{t.EXACT}</span>:(l.relaxations??[]).map(r=><span className="badge u" key={r}>{t[r]??r}{r==='DATE_SHIFT'&&l.day_shift?` (${l.day_shift>0?'+':''}${l.day_shift})`:''}</span>)}
     {l.is_demo&&<span className="badge u">{t.demo}</span>}</span></li>)}</ul>
    <p className="dim sm">{lang==='ar'?legs[0].notice_ar:t.notice}</p></>}
  </>}
 </div>;
}
