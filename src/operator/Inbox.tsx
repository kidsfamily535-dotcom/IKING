import {useCallback,useEffect,useMemo,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import {useT} from './copy';
import {useAir,apName,tm,dt,type Run} from './ctx';
import {ArcStage,SkyClock} from './Sky';
import {Chip,Empty,Fld} from './ui';
type Row=Record<string,any>;
const age=(iso:string,l:string,T:ReturnType<typeof useT>)=>{const m=Math.max(1,Math.round((Date.now()-new Date(iso).getTime())/6e4));return m<60?T.agoM.replace('{n}',String(m)):m<1440?T.agoH.replace('{n}',String(Math.round(m/60))):T.agoD.replace('{n}',String(Math.round(m/1440)))};
export default function Inbox({run,onCount,goHangar}:{run:Run;onCount:(n:number)=>void;goHangar:()=>void}){
 const T=useT();const {lang}=useI18n();const air=useAir();
 const [rows,setRows]=useState<Row[]|null>(null),[sel,setSel]=useState<string|null>(null),[mode,setMode]=useState<'q'|'d'>('q');
 const [price,setPrice]=useState(''),[hrs,setHrs]=useState(24),[txt,setTxt]=useState(''),[stamp,setStamp]=useState<''|'q'|'d'>('');
 const load=useCallback(()=>{sb.rpc('list_operator_requests').then(r=>{const d=(r.data??[]) as Row[];setRows(d);onCount(d.length);setSel(s=>s&&d.some(x=>x.quote_request_id===s)?s:(d[0]?.quote_request_id??null))})},[onCount]);
 useEffect(load,[load]);
 const cur=useMemo(()=>rows?.find(r=>r.quote_request_id===sel),[rows,sel]);
 const pick=(id:string,m:'q'|'d')=>{setSel(id);setMode(m);setPrice('');setTxt('')};
 const go=async()=>{if(!cur)return;const id=cur.quote_request_id as string;
  const ok=await run(()=>mode==='q'?sb.rpc('operator_submit_quote',{p_quote_request_id:id,p_price_usd:Number(price),p_valid_until:new Date(Date.now()+hrs*36e5).toISOString(),p_note:txt||null}):sb.rpc('operator_decline_request',{p_quote_request_id:id,p_reason:txt||null}));
  if(ok){setStamp(mode);setPrice('');setTxt('');setTimeout(()=>{setStamp('');load()},1900)}};
 if(rows===null)return <div className="sk-wait" aria-busy="true"/>;
 if(rows.length===0&&!stamp)return <Empty title={T.inEmptyT} text={T.inEmptyP} cta={T.inEmptyCta} on={goHangar}/>;
 const A=cur?air.get(cur.origin_code):undefined,B=cur&&cur.destination_code?air.get(cur.destination_code):null;
 return <section className="sk-inbox">
  <ol className="sk-rail" aria-label={T.tabs[0]}>{rows.map(r=>{const on=r.quote_request_id===sel,f=new Date(r.departure_from);
   return <li key={r.quote_request_id}><button type="button" className={`sk-tk${on?' on':''}`} aria-pressed={on} onClick={()=>pick(r.quote_request_id,'q')}>
    <span className="sk-tk-r" dir="ltr"><b>{r.origin_code}</b><svg viewBox="0 0 40 12" aria-hidden="true"><path d="M1 10 Q20 -4 39 10" fill="none"/></svg><b>{r.destination_code??'···'}</b></span>
    <span className="sk-tk-n">{apName(air,r.origin_code,lang)}{r.destination_code?` – ${apName(air,r.destination_code,lang)}`:` – ${T.anyDest}`}</span>
    <span className="sk-tk-m"><em>{dt(f,lang)} · {tm(f,lang)}</em><em>{r.passengers} {T.pax}</em></span>
    <span className="sk-tk-a">{age(r.created_at,lang,T)}</span></button></li>})}</ol>
  <div className="sk-stage">{cur&&A&&<>
   <div className="sk-sky"><ArcStage a={A} b={B} label={`${cur.origin_code} – ${cur.destination_code??T.anyDest}`}/>
    <div className="sk-cap" dir="ltr"><b>{cur.origin_code}</b><span>{cur.destination_code??'···'}</span></div>
    <SkyClock from={cur.departure_from} until={cur.departure_until??cur.departure_from}/>
    {stamp&&<div className={`sk-stamp ${stamp}`} role="status"><b>{stamp==='q'?T.stampQ:T.stampD}</b><small>{stamp==='q'?T.stampQs:T.stampDs}</small></div>}</div>
   <div className="sk-facts"><div><small>{T.route}</small><b>{apName(air,cur.origin_code,lang)}{cur.destination_code?` ← ${apName(air,cur.destination_code,lang)}`:` · ${T.anyDest}`}</b></div>
    <div><small>{T.pax2}</small><b>{cur.passengers}</b></div><div><small>{T.window}</small><b>{dt(new Date(cur.departure_from),lang)}</b></div>
    <Chip tone="est">{T.reqTag}</Chip></div>
   <div className="sk-act">
    <div className="sk-seg" role="group"><button type="button" className={mode==='q'?'':'g'} onClick={()=>setMode('q')}>{T.offer}</button><button type="button" className={mode==='d'?'':'g'} onClick={()=>setMode('d')}>{T.decline}</button></div>
    {mode==='q'?<><div className="sk-price"><label><span>{T.quoteP}</span><input inputMode="decimal" type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0"/></label><em>USD</em></div>
     <div className="sk-hrs" role="group" aria-label={T.hrs}>{[6,12,24,48].map(h=><button type="button" key={h} className={hrs===h?'':'g'} onClick={()=>setHrs(h)}>{h} {T.hUnit}</button>)}</div>
     <Fld l={T.notes} v={txt} on={setTxt} area/><p className="sk-trust">{T.qTrust}</p>
     <button type="button" className="sk-go" disabled={!price||Number(price)<=0||!!stamp} onClick={go}>{T.sendq}</button></>
    :<><div className="sk-hrs" role="group" aria-label={T.reason}>{T.reasons.map(x=><button type="button" key={x} className={txt===x?'':'g'} onClick={()=>setTxt(x)}>{x}</button>)}</div>
     <Fld l={T.reason} v={txt} on={setTxt} area/><button type="button" className="sk-go" disabled={!!stamp} onClick={go}>{T.decline}</button></>}
   </div></>}</div></section>}
