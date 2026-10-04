import {sb} from '../lib/supabase';
import {mockApi} from './mockApi';
import type {EyeApi} from './api';
import type {Airport,Signal,DecisionPolicyRow} from './types';
const CODES=['RUH','JED','MED','TUU','DMM','AHB','GIZ','YNB','DXB','AUH','DOH','CAI','AMM'];
const trusted=(s:string)=>s==='OFFICIAL_OPERATOR'||s==='VERIFIED_PARTNER';
// ما لم يُوصَّل بعد (الفرص للأدمن، الموافقات، الرحلة الفاضية، الذاكرة، فهم الطلب) يبقى محاكاة ومعلَّمًا SIM في الواجهة.
export const realApi:EyeApi={...mockApi,
 async listAirports(){const {data}=await sb.from('airports').select('iata_code,name_ar,name_en,country_code,lat,lon').in('iata_code',CODES);
  return (data??[]).filter(a=>a.lat!=null&&a.lon!=null).map(a=>({iata:a.iata_code,nameAr:a.name_ar??a.iata_code,nameEn:a.name_en??a.iata_code,country:a.country_code,lat:a.lat,lon:a.lon}) as Airport)},
 async listSignals(){const out:Signal[]=[];
  const av=await sb.rpc('list_current_availability');
  for(const r of av.data??[]){const ok=trusted(r.source);out.push({id:'av'+r.id,kind:'OPERATOR',title:`رحلة ${r.origin_code} → ${r.destination_code??'مرن'} · ${r.category??''}`,area:r.origin_code,stage:ok?'CONFIRMED':'POTENTIAL',dataStatus:ok?'CONFIRMED':'UNKNOWN',confidence:ok?'high':'low',source:r.source,minutesAgo:r.verified_at?Math.max(0,Math.round((Date.now()-Date.parse(r.verified_at))/60000)):0,priority:ok?'RECOMMEND':'INVESTIGATE'})}
  const sg=await sb.rpc('list_public_aircraft_sightings');
  for(const [i,r] of (sg.data??[]).entries())out.push({id:'sg'+i,kind:'AIRCRAFT_MOVEMENT',title:`${r.aircraft_category} · ${r.general_area}`,area:r.general_area,stage:'SIGHTED',dataStatus:'LIVE',confidence:'medium',source:'ADS-B',minutesAgo:r.observed_age_min??0,priority:'WATCH'});
  const dm=await sb.rpc('list_demand_signals',{p_status:null});
  for(const r of dm.data??[])out.push({id:'dm'+r.id,kind:'DEMAND',title:r.title,area:`${r.est_origin??''} ${r.est_destination??''}`.trim(),dataStatus:'INFERRED',confidence:'low',grade:r.grade,source:r.source_name??'مصدر عام',minutesAgo:0,priority:'WATCH'});
  return out.sort((a,b)=>a.minutesAgo-b.minutesAgo).slice(0,40)},
 async listOpportunities(){return []},
 async approveOpportunity(){throw new Error('NOT_WIRED')},
 async rejectOpportunity(){throw new Error('NOT_WIRED')},
 async listPolicy(){const {data}=await sb.from('eye_decision_policy').select('*').order('sort_order');
  return (data??[]).map(r=>({situation:r.situation,decision:r.decision,externalEffect:r.external_effect,requiresHuman:r.requires_human,descriptionAr:r.description_ar}) as DecisionPolicyRow)}};
