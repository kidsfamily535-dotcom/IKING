import {sb} from '../lib/supabase';
import {realApi,listMissions} from '../data/supabaseApi';
import type {MyTrip,RouteWx,Mission} from '../data/types';
// قراءة فقط. كل ما هنا يأتي من صفوف العميل نفسه (RLS)، ولا شيء يُكتب في القاعدة ولا يُرسل لأحد.
// الفشل لا يُحوَّل إلى «لا يوجد»: كل جزء يرجع {ok:false} فنقول «تعذّرت القراءة» بدل أن نوهم أن لا شيء هناك.
export type Part<T>={ok:true;v:T}|{ok:false};
export type Transfer={id:string;direction:'TO_AIRPORT'|'FROM_AIRPORT';airport:string;pickupAt:string;status:'REQUESTED'|'EXECUTED'|'UNAVAILABLE';note:string|null};
export type Margin='COMFORTABLE'|'TIGHT'|'INSUFFICIENT'|'UNKNOWN';
export type DayStop={seq:number;kind:'SESSION'|'LEG';from:string|null;to:string|null;startsAt:string|null;endsAt:string|null;margin:Margin|null;basis:'ESTIMATED'|'SOURCE';title:string|null};
export type DayPlan={id:string;date:string;status:string;worst:Margin;returnAt:string|null;isDemo:boolean;stops:DayStop[]};
export type RealTrip={trip:MyTrip;wx:Part<RouteWx[]>;transfers:Part<Transfer[]>;alerts:Part<{optIn:boolean;live:boolean}>;plan:Part<DayPlan|null>;mission:Part<Mission|null>;loadedAt:number};
const ok=<T,>(v:T):Part<T>=>({ok:true,v});const bad:Part<never>={ok:false};
const DAY=864e5;
async function transfers(t:MyTrip):Promise<Part<Transfer[]>>{
 const {data,error}=await sb.rpc('list_my_transfers');if(error)return bad;
 // نربط بالمطار والاتجاه فقط (لا ربط مباشر بين customer_trips وطلبات النقل)، وبقرب الموعد إن كان معروفًا.
 const dep=t.departureAt?Date.parse(t.departureAt):null;
 const out=(data??[]).filter((r:any)=>(r.status==='REQUESTED'||r.status==='EXECUTED'||r.status==='UNAVAILABLE')
  &&((r.direction==='TO_AIRPORT'&&r.airport_code===t.origin)||(r.direction==='FROM_AIRPORT'&&r.airport_code===t.destination))
  &&(dep===null||Math.abs(Date.parse(r.pickup_at)-dep)<=1.5*DAY))
  .map((r:any)=>({id:r.id,direction:r.direction,airport:r.airport_code,pickupAt:r.pickup_at,status:r.status,note:r.broker_note??null}) as Transfer);
 return ok(out)}
async function alerts(t:MyTrip):Promise<Part<{optIn:boolean;live:boolean}>>{
 const [w,s]=await Promise.all([sb.from('trip_watches').select('alerts_opt_in').eq('trip_id',t.id).maybeSingle(),sb.rpc('trip_alert_status')]);
 if(w.error||s.error)return bad;
 return ok({optIn:!!w.data?.alerts_opt_in,live:!!(s.data as any)?.live})}
async function plan(t:MyTrip):Promise<Part<DayPlan|null>>{
 if(!t.departureAt)return ok(null);
 const dep=Date.parse(t.departureAt);
 const {data,error}=await sb.from('day_plans').select('id,plan_date,status,worst_status,return_arrival_at,is_demo,start_airport').eq('start_airport',t.origin).not('status','in','(CANCELLED,EXPIRED)').order('plan_date');
 if(error)return bad;
 const p=(data??[]).find((r:any)=>Math.abs(Date.parse(r.plan_date+'T12:00:00Z')-dep)<=1.5*DAY);
 if(!p)return ok(null);
 const st=await sb.from('day_plan_stops').select('seq,kind,session_id,from_airport,to_airport,starts_at,ends_at,margin_status,time_basis').eq('plan_id',p.id).order('seq');
 if(st.error)return bad;
 const ids=[...new Set((st.data??[]).map((s:any)=>s.session_id).filter(Boolean))] as string[];
 const names=new Map<string,string>();
 if(ids.length){const g=await sb.from('gcc_event_sessions').select('id,title_ar').in('id',ids);if(!g.error)for(const r of g.data??[])names.set((r as any).id,(r as any).title_ar)}
 return ok({id:p.id,date:p.plan_date,status:p.status,worst:p.worst_status as Margin,returnAt:p.return_arrival_at,isDemo:!!p.is_demo,
  stops:(st.data??[]).map((s:any)=>({seq:s.seq,kind:s.kind,from:s.from_airport,to:s.to_airport,startsAt:s.starts_at,endsAt:s.ends_at,margin:s.margin_status,basis:s.time_basis,title:s.session_id?names.get(s.session_id)??null:null}) as DayStop)})}
async function mission(t:MyTrip):Promise<Part<Mission|null>>{
 try{const m=await listMissions();return ok(m.find(x=>x.destination===t.destination)??null)}catch{return bad}}
// يرجع null إذا لا توجد رحلة للعميل (والفشل في قراءة الرحلات نفسها يُرمى ليظهر كخطأ لا كـ«لا رحلات»).
export async function loadRealTrip():Promise<RealTrip|null>{
 const trips=await realApi.listMyTrips();const trip=trips[0];if(!trip)return null;
 const [wx,tr,al,pl,ms]=await Promise.all([
  realApi.routeWeather(trip.origin,trip.destination).then(v=>ok(v),()=>bad),
  transfers(trip).catch(()=>bad),alerts(trip).catch(()=>bad),plan(trip).catch(()=>bad),mission(trip).catch(()=>bad)]);
 return {trip,wx,transfers:tr,alerts:al,plan:pl,mission:ms,loadedAt:Date.now()}}
