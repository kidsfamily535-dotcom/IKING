import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import {useT} from './copy';
import {Chip,Empty} from './ui';
// تاب «وكيلي»: المشغّل يوجّه نسخته من الوكيل. كل القرارات والصلاحيات في دوال القاعدة (operator_*).
// التوجيه معلومة للوكيل فقط: لا يفتح قفل التواصل ولا يتخطى بوابات الموافقة.
type Dir={id:string;body:string;status:string;created_at:string;expires_at:string};
type Ag={state:string;routes?:string[];aircraft_types?:string[];quiet_from?:number|null;quiet_to?:number|null;directives?:Dir[]};
const list=(t:string)=>t.split(',').map(x=>x.trim()).filter(Boolean);
export default function AgentTab(){
 const T=useT();const [a,setA]=useState<Ag|null>(null),[rt,setRt]=useState(''),[ac,setAc]=useState(''),[qf,setQf]=useState(''),[qt,setQt]=useState(''),[body,setBody]=useState(''),[days,setDays]=useState('7'),[msg,setMsg]=useState(''),[b,setB]=useState(false);
 const load=useCallback(async()=>{const r=await sb.rpc('operator_my_agent');const d=(r.data??{state:'NO_ORGANIZATION'}) as Ag;setA(d);
  if(d.state==='OK'){setRt((d.routes??[]).join(', '));setAc((d.aircraft_types??[]).join(', '));setQf(d.quiet_from==null?'':String(d.quiet_from));setQt(d.quiet_to==null?'':String(d.quiet_to))}},[]);
 useEffect(()=>{load()},[load]);
 const act=async(f:()=>PromiseLike<{error:unknown}>,ok?:string)=>{setB(true);setMsg('');const r=await f();setB(false);if(r.error){setMsg(T.agErr);return false}if(ok)setMsg(ok);await load();return true};
 if(!a)return <section className="sk-pay"><p className="sk-quiet">…</p></section>;
 if(a.state!=='OK')return <Empty title={T.orgNoT} text={T.orgNoP}/>;
 const hrs=(v:string,on:(x:string)=>void,l:string)=><label>{l} <select value={v} onChange={e=>on(e.target.value)}><option value="">{T.agNone}</option>{Array.from({length:24},(_,i)=><option key={i} value={i}>{i}:00</option>)}</select></label>;
 return <section className="sk-pay">
  <p className="sk-trust">{T.agNote}</p>
  {msg&&<div className="sk-err" role="status">{msg}</div>}
  <div className="sks plain"><h3>{T.agPrefsH}</h3>
   <label>{T.agRoutes}<input dir="ltr" value={rt} onChange={e=>setRt(e.target.value)} placeholder="CAI, JED, DXB"/></label>
   <label>{T.agAir}<input dir="ltr" value={ac} onChange={e=>setAc(e.target.value)} placeholder="C56X, GLEX"/></label>
   <p>{T.agQuiet}</p><div className="sk-row">{hrs(qf,setQf,T.agFrom)}{hrs(qt,setQt,T.agTo)}</div>
   <div className="sk-row"><button type="button" disabled={b||(qf===''&&qt==='')===false&&(qf===''||qt==='')} onClick={()=>act(()=>sb.rpc('operator_set_agent_prefs',{p_routes:list(rt),p_aircraft:list(ac),p_from:qf===''?null:+qf,p_to:qt===''?null:+qt}),T.agSaved)}>{T.agSavePrefs}</button></div></div>
  <div className="sks plain"><h3>{T.agDirH}</h3>
   <input value={body} maxLength={500} onChange={e=>setBody(e.target.value)} placeholder={T.agDirPh}/>
   <div className="sk-row"><select value={days} onChange={e=>setDays(e.target.value)}>{['1','3','7','30'].map(d=><option key={d} value={d}>{d} {T.agDay}</option>)}</select>
    <button type="button" disabled={b||body.trim().length<3} onClick={async()=>{if(await act(()=>sb.rpc('operator_send_directive',{p_body:body.trim(),p_days:parseInt(days,10)})))setBody('')}}>{T.agSend}</button></div></div>
  <h3 className="sk-h3">{T.agListH}</h3>
  {!(a.directives??[]).length?<p className="sk-quiet">{T.agEmpty}</p>:<ul className="sk-oflist">{(a.directives??[]).map(d=><li className="sk-of s3" key={d.id}><p>{d.body}</p>
   <div className="sk-row"><Chip tone="unk">{d.status}</Chip><button type="button" className="g" disabled={b} onClick={()=>act(()=>sb.rpc('operator_cancel_directive',{p_id:d.id}))}>{T.cancel}</button></div></li>)}</ul>}
 </section>}
