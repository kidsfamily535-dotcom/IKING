import {useCallback,useEffect,useMemo,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import {useT} from './copy';
import {useAir,apName,tm,dt,type Run} from './ctx';
import {ArcStage} from './Sky';
import {Chip,Empty,Fld,Sheet} from './ui';
type Row=Record<string,any>;
const DAYS=10,DAY=864e5;
const tone=(s:string)=>s==='AVAILABLE'||s==='BOOKED'?'ok':s==='PENDING_VERIFICATION'||s==='HELD'?'est':s==='EXPIRED'?'unk':'bad';
const BLANK={fleet:'',kind:'EMPTY_LEG',o:'',d:'',a:'',b:'',seats:'',price:''};
export default function Hangar({uid,run,goFleet}:{uid:string;run:Run;goFleet:()=>void}){
 const T=useT();const {lang}=useI18n();const air=useAir();
 const [rows,setRows]=useState<Row[]|null>(null),[fl,setFl]=useState<Row[]>([]),[open,setOpen]=useState(false),[f,setF]=useState({...BLANK}),[sel,setSel]=useState<string|null>(null);
 const load=useCallback(()=>{
  sb.from('aircraft_availability').select('id,fleet_id,origin_code,destination_code,departure_from,departure_until,seats,status,kind,aircraft_model,indicative_price_usd').eq('operator_id',uid).order('departure_from',{ascending:false}).limit(60).then(r=>setRows((r.data??[]) as Row[]));
  sb.from('aircraft_fleet').select('id,model,max_pax').eq('operator_id',uid).eq('active',true).then(r=>setFl((r.data??[]) as Row[]))},[uid]);
 useEffect(load,[load]);
 const set=(k:string)=>(v:string)=>setF(p=>({...p,[k]:v}));
 const start=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return +d},[]);
 const codes=useMemo(()=>[...air.keys()].sort(),[air]);
 const bad=!f.fleet||!f.o||!f.a||!f.seats||(f.kind!=='ON_DEMAND'&&!f.d)||(f.o===f.d);
 const save=async()=>{const m=fl.find(x=>x.id===f.fleet);if(!m)return;
  const body:Row={operator_id:uid,fleet_id:m.id,aircraft_model:m.model,kind:f.kind,origin_code:f.o,destination_code:f.d||null,departure_from:new Date(f.a).toISOString(),departure_until:new Date(f.b||f.a).toISOString(),seats:Number(f.seats),min_pax:1,status:'PENDING_VERIFICATION',source:'OFFICIAL_OPERATOR',confidence:'low',expires_at:new Date(f.b||f.a).toISOString(),pricing_mode:f.price?'FIXED_TOTAL':'ON_REQUEST',indicative_price_usd:f.price?Number(f.price):null};
  if(await run(()=>sb.from('aircraft_availability').insert(body))){setOpen(false);setF({...BLANK});load()}};
 if(rows===null)return <div className="sk-wait" aria-busy="true"/>;
 const live=rows.filter(r=>r.status!=='CANCELLED'&&+new Date(r.departure_until??r.departure_from)>=start);
 const lanes=[...new Set(live.map(r=>r.aircraft_model as string))];
 const cur=rows.find(r=>r.id===sel);
 const pct=(x:number)=>Math.min(100,Math.max(0,((x-start)/(DAYS*DAY))*100));
 const nowP=pct(Date.now());
 return <section className="sk-hangar">
  <div className="sk-bar"><p>{T.hangarNote}</p><button type="button" onClick={()=>fl.length?setOpen(true):goFleet()}>{fl.length?T.addLeg:T.needFleet}</button></div>
  {open&&<Sheet title={T.addLeg} onClose={()=>setOpen(false)}><div className="skg">
   <label className="skf"><span>{T.aircraft}</span><select value={f.fleet} onChange={e=>set('fleet')(e.target.value)}><option value=""/>{fl.map(x=><option key={x.id} value={x.id}>{x.model}</option>)}</select></label>
   <label className="skf"><span>{T.kind}</span><select value={f.kind} onChange={e=>set('kind')(e.target.value)}>{['EMPTY_LEG','SCHEDULED','ON_DEMAND'].map(k=><option key={k} value={k}>{(T as any)[k]}</option>)}</select></label>
   <label className="skf"><span>{T.from}</span><select value={f.o} onChange={e=>set('o')(e.target.value)}><option value=""/>{codes.map(c=><option key={c} value={c}>{c} · {apName(air,c,lang)}</option>)}</select></label>
   <label className="skf"><span>{T.to}</span><select value={f.d} onChange={e=>set('d')(e.target.value)}><option value=""/>{codes.filter(c=>c!==f.o).map(c=><option key={c} value={c}>{c} · {apName(air,c,lang)}</option>)}</select></label>
   <Fld l={T.dep1} v={f.a} on={set('a')} type="datetime-local"/><Fld l={T.dep2} v={f.b} on={set('b')} type="datetime-local"/><Fld l={T.seats} v={f.seats} on={set('seats')} type="number"/><Fld l={T.price} v={f.price} on={set('price')} type="number" hint={f.price?undefined:T.onreq}/></div>
   <p className="sk-trust">{T.note1}</p><div className="sk-row"><button type="button" disabled={bad} onClick={save}>{T.save}</button><button type="button" className="g" onClick={()=>setOpen(false)}>{T.cancel}</button></div></Sheet>}
  {live.length===0?<Empty title={T.hgEmptyT} text={T.hgEmptyP} cta={fl.length?T.addLeg:T.needFleet} on={()=>fl.length?setOpen(true):goFleet()}/>:
  <div className="sk-tlw"><div className="sk-tl" dir="ltr"><div className="sk-tl-h"><span/>{Array.from({length:DAYS},(_,i)=>{const d=new Date(start+i*DAY);return <span key={i} className={i===0?'now':''}><b>{d.getDate()}</b><small>{d.toLocaleDateString(lang==='ar'?'ar-u-nu-latn':'en-GB',{weekday:'short'})}</small></span>})}</div>
   {lanes.map(m=><div className="sk-lane" key={m}><span className="sk-lane-l" dir={lang==='ar'?'rtl':'ltr'}>{m}</span><div className="sk-lane-t">
    {live.filter(r=>r.aircraft_model===m).map(r=>{const l=pct(+new Date(r.departure_from)),rr=pct(+new Date(r.departure_until??r.departure_from));
     return <button type="button" key={r.id} className={`sk-blk b-${r.status}${sel===r.id?' on':''}`} style={{left:`${l}%`,width:`${Math.max(rr-l,3.2)}%`}} onClick={()=>setSel(r.id)} aria-label={`${r.origin_code} ${r.destination_code??''} ${(T as any)[r.status]}`}><span>{r.origin_code}{r.destination_code?`-${r.destination_code}`:''}</span></button>})}</div></div>)}
   <i className="sk-nowline" style={{left:`calc(var(--lane) + (100% - var(--lane)) * ${nowP/100})`}} aria-hidden="true"/></div></div>}
  {cur&&<div className="sk-detail"><div className="sk-sky sm"><ArcStage a={air.get(cur.origin_code)} b={cur.destination_code?air.get(cur.destination_code):null} label={`${cur.origin_code} ${cur.destination_code??''}`}/></div>
   <div className="sk-dt"><h3>{cur.aircraft_model}</h3><p>{apName(air,cur.origin_code,lang)}{cur.destination_code?` ← ${apName(air,cur.destination_code,lang)}`:` · ${T.anyDest}`}</p>
    <p>{dt(new Date(cur.departure_from),lang)} · {tm(new Date(cur.departure_from),lang)} · {cur.seats} {T.seatsN}</p>
    <Chip tone={tone(cur.status)}>{(T as any)[cur.status]}</Chip>
    <p className="sk-trust">{cur.status==='PENDING_VERIFICATION'?T.statePend:cur.status==='AVAILABLE'?T.stateAv:cur.status==='HELD'?T.stateHeld:''}</p>
    {['PENDING_VERIFICATION','AVAILABLE','HELD'].includes(cur.status)&&<button type="button" className="g" onClick={async()=>{if(await run(()=>sb.rpc('set_availability_status',{p_id:cur.id,p_new:'CANCELLED',p_reason:'withdrawn by operator'}))){setSel(null);load()}}}>{T.withdraw}</button>}</div></div>}
 </section>}
