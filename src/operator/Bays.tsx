import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import {useT} from './copy';
import type {Run} from './ctx';
import {Chip,Empty,Fld,Sheet} from './ui';
type Row=Record<string,any>;
const E={model:'',manufacturer:'',year_built:'',max_pax:'',baggage_kg:'',range_nm:'',layout:'',amenities:'',airport_requirements:'',license_ref:'',registration:'',photos:'',notes:''};
const num=(v:string)=>v===''?null:Number(v);
export default function Bays({uid,run}:{uid:string;run:Run}){
 const T=useT();const [rows,setRows]=useState<Row[]|null>(null),[f,setF]=useState({...E}),[eid,setEid]=useState<string|null>(null),[open,setOpen]=useState(false);
 const load=useCallback(()=>{sb.from('aircraft_fleet').select('*').eq('operator_id',uid).eq('active',true).order('created_at',{ascending:false}).then(r=>setRows((r.data??[]) as Row[]))},[uid]);useEffect(load,[load]);
 const s=(k:keyof typeof E)=>(v:string)=>setF(p=>({...p,[k]:v}));
 const close=()=>{setOpen(false);setEid(null);setF({...E})};
 const save=async()=>{const body={model:f.model.trim(),manufacturer:f.manufacturer.trim()||null,year_built:num(f.year_built),max_pax:num(f.max_pax),baggage_kg:num(f.baggage_kg),range_nm:num(f.range_nm),layout:f.layout.trim()||null,
  amenities:f.amenities.split(',').map(x=>x.trim()).filter(Boolean),airport_requirements:f.airport_requirements.trim()||null,license_ref:f.license_ref.trim()||null,registration:f.registration.trim()||null,
  photo_urls:f.photos.split(',').map(x=>x.trim()).filter(x=>x.startsWith('https://')),notes:f.notes.trim()||null};
  if(await run(()=>eid?sb.from('aircraft_fleet').update(body).eq('id',eid):sb.from('aircraft_fleet').insert({...body,operator_id:uid}))){close();load()}};
 const edit=(r:Row)=>{setEid(r.id);setOpen(true);setF({model:r.model??'',manufacturer:r.manufacturer??'',year_built:r.year_built?.toString()??'',max_pax:r.max_pax?.toString()??'',baggage_kg:r.baggage_kg?.toString()??'',range_nm:r.range_nm?.toString()??'',layout:r.layout??'',amenities:(r.amenities??[]).join(', '),airport_requirements:r.airport_requirements??'',license_ref:r.license_ref??'',registration:r.registration??'',photos:(r.photo_urls??[]).join(', '),notes:r.notes??''})};
 if(rows===null)return <div className="sk-wait" aria-busy="true"/>;
 return <section className="sk-bays">
  <div className="sk-bar"><p>{T.baysNote}</p>{!open&&<button type="button" onClick={()=>setOpen(true)}>{T.add}</button>}</div>
  {open&&<Sheet title={eid?T.edit:T.add} onClose={close}><div className="skg">
   <Fld l={T.model} v={f.model} on={s('model')}/><Fld l={T.maker} v={f.manufacturer} on={s('manufacturer')}/><Fld l={T.year} v={f.year_built} on={s('year_built')} type="number"/><Fld l={T.paxSeats} v={f.max_pax} on={s('max_pax')} type="number"/>
   <Fld l={T.bag} v={f.baggage_kg} on={s('baggage_kg')} type="number"/><Fld l={T.range} v={f.range_nm} on={s('range_nm')} type="number"/><Fld l={T.layout} v={f.layout} on={s('layout')}/><Fld l={T.amen} v={f.amenities} on={s('amenities')}/>
   <Fld l={T.lic} v={f.license_ref} on={s('license_ref')}/><Fld l={T.reg} v={f.registration} on={s('registration')}/></div>
   <Fld l={T.apt} v={f.airport_requirements} on={s('airport_requirements')} area/><Fld l={T.photos} v={f.photos} on={s('photos')} area/><Fld l={T.notes} v={f.notes} on={s('notes')} area/>
   <div className="sk-row"><button type="button" disabled={!f.model.trim()} onClick={save}>{T.save}</button><button type="button" className="g" onClick={close}>{T.cancel}</button></div></Sheet>}
  {rows.length===0&&!open&&<Empty title={T.fleetEmptyT} text={T.fleetEmptyP} cta={T.add} on={()=>setOpen(true)}/>}
  <div className="sk-bayg">{rows.map(r=>{const ph=(r.photo_urls??[]).find((x:string)=>x.startsWith('https://'));
   return <article className="sk-bay" key={r.id}><div className="sk-bay-ph">{ph?<img src={ph} alt={r.model} loading="lazy"/>:<span>{T.noPhoto}</span>}</div>
    <div className="sk-bay-b"><h3>{r.model}</h3><p>{r.manufacturer??''}{r.year_built?` · ${r.year_built}`:''}</p>
     <p className="sk-bay-m"><span>{r.max_pax??'?'} {T.seatsN}</span>{r.range_nm?<span dir="ltr">{r.range_nm} nm</span>:null}</p>
     <div className="sk-bay-f"><Chip tone={r.verification==='CONFIRMED'?'ok':r.verification==='REJECTED'?'bad':'est'}>{(T as any)[r.verification]??r.verification}</Chip><button type="button" className="g" onClick={()=>edit(r)}>{T.edit}</button></div></div></article>})}</div></section>}
