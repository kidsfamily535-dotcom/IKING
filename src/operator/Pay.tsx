import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import {useT} from './copy';
import type {Run} from './ctx';
import {Chip,Fld} from './ui';
type Row=Record<string,any>;
export default function Pay({uid,run}:{uid:string;run:Run}){
 const T=useT();const [m,setM]=useState<'PAYMENT_LINK'|'BANK_TRANSFER'>('PAYMENT_LINK'),[lk,setLk]=useState(''),[bk,setBk]=useState(''),[rows,setRows]=useState<Row[]>([]),[ask,setAsk]=useState<string|null>(null),[ref,setRef]=useState(''),[saved,setSaved]=useState(false);
 const load=useCallback(()=>{sb.from('operator_payment_details').select('*').eq('operator_id',uid).maybeSingle().then(r=>{if(r.data){setM(r.data.method);setLk(r.data.payment_link??'');setBk(r.data.bank_details??'')}});sb.rpc('list_operator_accepted_quotes').then(r=>setRows((r.data??[]) as Row[]))},[uid]);useEffect(load,[load]);
 const save=async()=>{if(await run(()=>sb.from('operator_payment_details').upsert({operator_id:uid,method:m,payment_link:m==='PAYMENT_LINK'?lk.trim():null,bank_details:m==='BANK_TRANSFER'?bk.trim():null})))setSaved(true)};
 const decl=async(r:Row)=>{if(await run(()=>sb.rpc('operator_declare_payment_received',{p_quote:r.quote_id,p_amount:r.price,p_currency:r.currency,p_reference:ref}))){setAsk(null);setRef('');load()}};
 return <section className="sk-pay"><div className="sks plain"><h3>{T.paydet}</h3><div className="sk-seg"><button type="button" className={m==='PAYMENT_LINK'?'':'g'} onClick={()=>setM('PAYMENT_LINK')}>{T.link}</button><button type="button" className={m==='BANK_TRANSFER'?'':'g'} onClick={()=>setM('BANK_TRANSFER')}>{T.bank}</button></div>
  {m==='PAYMENT_LINK'?<Fld l={T.linkF} v={lk} on={v=>{setLk(v);setSaved(false)}}/>:<Fld l={T.bankF} v={bk} on={v=>{setBk(v);setSaved(false)}} area/>}<p className="sk-trust">{T.warn}</p>
  <div className="sk-row"><button type="button" disabled={m==='PAYMENT_LINK'?!lk.startsWith('https://'):bk.trim().length<5} onClick={save}>{T.save}{saved?' ✓':''}</button></div></div>
  <h3 className="sk-h3">{T.acc}</h3><p className="sk-trust">{T.pnote}</p>{rows.length===0&&<p className="sk-quiet">{T.none}</p>}
  <ul className="sk-oflist">{rows.map(r=><li className="sk-of s3" key={r.quote_id}><div className="sk-of-h"><span dir="ltr" className="sk-of-r"><b>{r.origin_code}</b><i/><b>{r.destination_code??'···'}</b></span><span className="sk-of-n"/><span className="sk-of-p" dir="ltr">{r.price}<small> {r.currency}</small></span></div>
   <div className="sk-of-f">{r.declaration_status?<Chip tone={r.declaration_status==='STAFF_CONFIRMED'?'ok':'est'}>{r.declaration_status==='STAFF_CONFIRMED'?T.done:T.waiting}</Chip>
   :ask!==r.quote_id?<button type="button" onClick={()=>setAsk(r.quote_id)}>{T.got}</button>:<div className="sk-row"><Fld l={T.ref} v={ref} on={setRef}/><button type="button" disabled={ref.trim().length<3} onClick={()=>decl(r)}>{T.conf}</button><button type="button" className="g" onClick={()=>setAsk(null)}>{T.cancel}</button></div>}</div></li>)}</ul></section>}
