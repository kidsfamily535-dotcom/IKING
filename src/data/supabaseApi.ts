import {sb} from '../lib/supabase';
import {mockApi} from './mockApi';
import type {EyeApi} from './api';
import type {Airport,Signal,DecisionPolicyRow,Opportunity,FleetAircraft,ParkedAircraft,CalendarEvent} from './types';
import {tr} from '../i18n';
import {HUBS} from './hubs';
const trusted=(s:string)=>s==='OFFICIAL_OPERATOR'||s==='VERIFIED_PARTNER';
// ما لم يُوصَّل بعد (الرحلة الفاضية، الذاكرة، فهم الطلب) يبقى محاكاة ومعلَّمًا SIM في الواجهة.
export const realApi:EyeApi={...mockApi,
 async listAirports(){const {data,error}=await sb.from('airports').select('iata_code,name_ar,name_en,country_code,lat,lon').limit(1000);
  // خطأ أو قاعدة فاضية: نرجع للقائمة المرجعية الثابتة بدل شاشة فاضية (بيانات مطارات ثابتة، مش بيانات تشغيل)
  if(error||!data||!data.length)return mockApi.listAirports();
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
  if(data?.status!=='ACTIVATED')throw new Error(data?.status==='NO_ELIGIBLE_CUSTOMERS'?'لا يوجد عميل مؤهل الآن (البوابة حجبت الكل)':'الفرصة لم تعد في انتظار الموافقة')},
 async rejectOpportunity(id,reason){const {error}=await sb.rpc('reject_opportunity',{p_id:id,p_reason:reason});if(error)throw new Error(error.message)},
 async fleetReport(regs,consent){const {data,error}=await sb.rpc('eye_fleet_report',{p_regs:regs,p_consent:consent});if(error)throw new Error(error.message);return (data?.aircraft??[]) as FleetAircraft[]},
 async parkedAircraft(regs){const {data,error}=await sb.rpc('eye_parked_aircraft',{p_regs:regs&&regs.length?regs:null});if(error)throw new Error(error.message);return (data?.aircraft??[]) as ParkedAircraft[]},
 async demandCalendar(days){const {data,error}=await sb.rpc('eye_demand_calendar',{p_days:days});if(error)throw new Error(error.message);return (data?.events??[]) as CalendarEvent[]},
 async listPolicy(){const {data}=await sb.from('eye_decision_policy').select('*').order('sort_order');
  return (data??[]).map(r=>({situation:r.situation,decision:r.decision,externalEffect:r.external_effect,requiresHuman:r.requires_human,descriptionAr:r.description_ar}) as DecisionPolicyRow)}};
