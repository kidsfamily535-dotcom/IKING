import {sb} from '../lib/supabase';
import {mockApi} from './mockApi';
import type {EyeApi} from './api';
import type {Airport,Signal,DecisionPolicyRow,Opportunity,FleetAircraft,ParkedAircraft,CalendarEvent,RadarEvent,MyTrip,MyEmptyLeg,RouteWx,WxCat} from './types';
import {tr} from '../i18n';
import {HUBS} from './hubs';
// الدالة ترجع وصف الرؤية بالعربية فقط، فنحوله لفئة ثابتة ونترجمه في الواجهة. (الأفضل لاحقًا: ترجيع الفئة نفسها من الدالة)
const WXC:Record<string,WxCat>={'رؤية جيدة':'VFR','رؤية حدّية':'MVFR','رؤية منخفضة':'IFR','رؤية منخفضة جدًا':'LIFR'};
const trusted=(s:string)=>s==='OFFICIAL_OPERATOR'||s==='VERIFIED_PARTNER';
// قاعدة: لا يرث الوضع الحقيقي شيئًا من المحاكاة بالصدفة. اللي لسه محاكاة مكتوب هنا صراحة وبيتعلَّم SIM في الواجهة.
// أي دالة جديدة في EyeApi لازم تتكتب هنا حقيقية أو تتضاف لهذه القائمة عن قصد، وإلا TypeScript يرفض البناء.
const simulated={
 analyzeEmptyLeg:mockApi.analyzeEmptyLeg,// تحليل الرحلة الفاضية: محاكاة معلَّمة SIM
 parseRequest:mockApi.parseRequest,// فهم الطلب بالـregex: محاكاة، خيارات وأسعار مثال فقط
};
export const realApi:EyeApi={...simulated,
 // لا ذاكرة حقيقية بعد (customer_preferences غير موصولة): لا نعرض عناصر تبان محفوظة وهي ليست كذلك.
 async listMemory(){return []},
 async saveMemory(){throw new Error('MEMORY_NOT_WIRED')},
 // لا مصدر حقيقي لحركة السوق بعد: لا نخترع رحلات.
 async listMarket(){return []},
 // ملخص الدورة من أرقام حقيقية فقط (عدد الإشارات والفرص المنتظرة موافقة).
 async runPass(on){for(const s of ['DISCOVERING','THINKING','MATCHING','MONITORING'] as const){on(s);await new Promise(r=>setTimeout(r,700))}
  try{const [sg,op]=await Promise.all([realApi.listSignals(),realApi.listOpportunities()]);on('WATCHING');
   return tr('run.real',{s:sg.length,p:op.filter(o=>o.status==='ACTIVATION_PENDING').length})}
  catch{on('WATCHING');return tr('run.fail')}},
 async listAirports(){const {data,error}=await sb.from('airports').select('iata_code,name_ar,name_en,country_code,lat,lon').limit(1000);
  // خطأ أو قاعدة فاضية: نرجع للقائمة المرجعية الثابتة بدل شاشة فاضية (بيانات مطارات ثابتة، مش بيانات تشغيل)
  if(error||!data||!data.length){console.warn('airports: fallback to static reference list',error?.message);return mockApi.listAirports()}
  const out=data.filter(a=>a.lat!=null&&a.lon!=null).map(a=>({iata:a.iata_code,nameAr:a.name_ar??a.name_en??a.iata_code,nameEn:a.name_en??a.name_ar??a.iata_code,country:a.country_code,lat:a.lat,lon:a.lon}) as Airport);
  // الأساسية أولًا، وبعدها الباقي بالدولة ثم الاسم
  return out.sort((a,b)=>(+HUBS.has(b.iata))-(+HUBS.has(a.iata))||a.country.localeCompare(b.country)||a.nameEn.localeCompare(b.nameEn))},
 async listSignals(){const out:Signal[]=[];
  const av=await sb.rpc('list_current_availability');
  for(const r of av.data??[]){const ok=trusted(r.source);out.push({id:'av'+r.id,kind:'OPERATOR',title:tr('sig.opLeg',{o:r.origin_code,d:r.destination_code??tr('sig.flex'),c:r.category??''}),area:r.origin_code,stage:ok?'CONFIRMED':'POTENTIAL',dataStatus:ok?'CONFIRMED':'UNKNOWN',confidence:ok?'high':'low',source:r.source,minutesAgo:r.verified_at?Math.max(0,Math.round((Date.now()-Date.parse(r.verified_at))/60000)):0,priority:ok?'RECOMMEND':'INVESTIGATE'})}
  const sg=await sb.rpc('list_public_aircraft_sightings');
  for(const [i,r] of (sg.data??[]).entries())out.push({id:'sg'+i,kind:'AIRCRAFT_MOVEMENT',title:`${r.aircraft_category} · ${r.general_area}`,area:r.general_area,stage:'SIGHTED',dataStatus:'LIVE',confidence:'medium',source:'ADS-B',minutesAgo:r.observed_age_min??0,priority:'WATCH'});
  const dm=await sb.rpc('list_demand_signals',{p_status:null});
  for(const r of dm.data??[])out.push({id:'dm'+r.id,kind:'DEMAND',title:r.title,area:`${r.est_origin??''} ${r.est_destination??''}`.trim(),dataStatus:'INFERRED',confidence:'low',grade:r.grade,source:r.source_name??tr('src.public'),minutesAgo:0,priority:'WATCH'});
  return out.sort((a,b)=>a.minutesAgo-b.minutesAgo).slice(0,40)},
 async listOpportunities(){const {data,error}=await sb.rpc('list_opportunities_staff');
  if(error)return [];// غير مصرّح (ليس موظفًا) أو خطأ مؤقت: لا نخترع فرصًا
  const mins=(t:string|null)=>t?Math.round((Date.now()-Date.parse(t))/60000):null;
  return (data??[]).map((r:any)=>({id:r.id,origin:r.origin_code,destination:r.destination_code,aircraftCategory:r.aircraft_category,seats:r.seats,trigger:r.trigger_type,status:r.status,
   availability:trusted(r.source)?'CONFIRMED':'PENDING_VERIFICATION',source:r.source,verifiedMinAgo:mins(r.verified_at),expiresInMin:Math.max(0,-(mins(r.expires_at)??0)),
   scoreParts:{freshness:r.score_parts?.freshness??0,sourceStrength:r.score_parts?.source_strength??0,urgency:r.score_parts?.urgency??0,confidence:r.score_parts?.confidence??0},
   reasons:r.match_reasons??[],matched:r.segment?{segment:r.segment,relevance:r.relevance,gate:r.gate_decision==='BLOCKED'?'BLOCKED':'ALLOWED',gateReason:r.gate_reason??undefined}:undefined,
   isDemo:!!r.is_demo,real:true,note:r.status_reason??undefined}) as Opportunity)},
 async approveOpportunity(id){const {data,error}=await sb.rpc('activate_opportunity',{p_id:id});
  if(error)throw new Error(error.message);
  if(data?.status!=='ACTIVATED')throw new Error(data?.status==='NO_ELIGIBLE_CUSTOMERS'?'لا يوجد عميل مؤهَّل في الوقت الراهن (حجبت البوابة الجميع)':'لم تعد الفرصة بانتظار الموافقة')},
 async rejectOpportunity(id,reason){const {error}=await sb.rpc('reject_opportunity',{p_id:id,p_reason:reason});if(error)throw new Error(error.message)},
 async fleetReport(regs,consent){const {data,error}=await sb.rpc('eye_fleet_report',{p_regs:regs,p_consent:consent});if(error)throw new Error(error.message);return (data?.aircraft??[]) as FleetAircraft[]},
 async parkedAircraft(regs){const {data,error}=await sb.rpc('eye_parked_aircraft',{p_regs:regs&&regs.length?regs:null});if(error)throw new Error(error.message);return (data?.aircraft??[]) as ParkedAircraft[]},
 // رادار الطلب: أحداث موثّقة بمصدرها مقابل إشارات العرض (موظفون فقط). الحدث حقيقة تقويمية وليس طلبًا مؤكدًا.
 async demandRadar(days){const {data,error}=await sb.rpc('eye_demand_radar',{p_days:days});if(error)throw new Error(error.message);return (data?.events??[]) as RadarEvent[]},
 async demandCalendar(days){const {data,error}=await sb.rpc('eye_demand_calendar',{p_days:days});if(error)throw new Error(error.message);return (data?.events??[]) as CalendarEvent[]},
 // طقس مطاري الرحلة من آخر رصد رسمي مخزّن (METAR). لو الرصد أقدم من 150 دقيقة يرجع STALE ولا نعرض قيمه.
 async routeWeather(o,d){const {data,error}=await sb.rpc('get_route_weather',{p_origin:o,p_destination:d});if(error)throw new Error(error.message);
  return (data??[]).map((r:any)=>({leg:r.leg_ar==='المغادرة'?'dep':'arr',code:r.airport_code,status:r.obs_status,observedAt:r.observed_at,ageMin:r.age_minutes,cat:WXC[r.condition_ar]??null,windDir:r.wind_dir,windKt:r.wind_speed_kt,vis:r.visibility,tempC:r.temp_c,forecast:!!r.forecast_available}) as RouteWx)},
 // رحلات العميل التي أدخلها بنفسه (RLS: صفوفه فقط). نخفي ما مضى عليه أكثر من يوم.
 async listMyTrips(){const {data,error}=await sb.from('customer_trips').select('id,origin_code,destination_code,departure_at,created_at').eq('kind','TRIP').or(`departure_at.is.null,departure_at.gte.${new Date(Date.now()-864e5).toISOString()}`).order('departure_at',{ascending:true,nullsFirst:false});
  if(error)throw new Error(error.message);
  return (data??[]).map((r:any)=>({id:r.id,origin:r.origin_code,destination:r.destination_code,departureAt:r.departure_at,createdAt:r.created_at}) as MyTrip)},
 async addMyTrip(o,d,at){const {error}=await sb.from('customer_trips').insert({origin_code:o,destination_code:d,departure_at:at,kind:'TRIP'});if(error)throw new Error(error.message)},
 // لقطات الرحلات الفاضية التي يدوّنها العميل: CUSTOMER_PROVIDED وخاصة به، ولا تتحول لتوفّر أو فرصة قبل تحقق الوسيط.
 async listMyEmptyLegs(){const {data,error}=await sb.from('customer_trips').select('id,origin_code,destination_code,departure_at,seats,note,created_at').eq('kind','EMPTY_LEG').or(`departure_at.is.null,departure_at.gte.${new Date(Date.now()-864e5).toISOString()}`).order('departure_at',{ascending:true,nullsFirst:false});
  if(error)throw new Error(error.message);
  return (data??[]).map((r:any)=>({id:r.id,origin:r.origin_code,destination:r.destination_code,departureAt:r.departure_at,seats:r.seats,note:r.note,createdAt:r.created_at}) as MyEmptyLeg)},
 async addMyEmptyLeg(o,d,at,seats,note){const {error}=await sb.from('customer_trips').insert({origin_code:o,destination_code:d,departure_at:at,kind:'EMPTY_LEG',seats,note:note.trim()?note.trim().slice(0,300):null});if(error)throw new Error(error.message)},
 async removeMyTrip(id){const {error}=await sb.from('customer_trips').delete().eq('id',id);if(error)throw new Error(error.message)},
 async listPolicy(){const {data}=await sb.from('eye_decision_policy').select('*').order('sort_order');
  return (data??[]).map(r=>({situation:r.situation,decision:r.decision,externalEffect:r.external_effect,requiresHuman:r.requires_human,descriptionAr:r.description_ar}) as DecisionPolicyRow)}};
