import {useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import {useT} from './copy';
import {useAir,apName,dt,tm} from './ctx';
import {Chip,Empty} from './ui';
type Row=Record<string,any>;
// مرحّلة العرض: أرسلتَ ← الفريق ← العميل ← القرار. العقدة المضيئة هي الحالة الفعلية في قاعدة البيانات، لا تقدير.
const STEP:Record<string,number>={BROKER_REVIEW:1,CLIENT_PRESENTED:3,CLIENT_ACCEPTED:4,CLIENT_REJECTED:4,EXPIRED:1,WITHDRAWN:1};
export default function Offers({uid,goPay,goInbox}:{uid:string;goPay:()=>void;goInbox:()=>void}){
 const T=useT();const {lang}=useI18n();const air=useAir();const [rows,setRows]=useState<Row[]|null>(null),[av,setAv]=useState<Record<string,Row>>({});
 useEffect(()=>{sb.from('quotes').select('id,quote_request_id,availability_id,operator_price_usd,currency,valid_until,status,created_at,decided_at').eq('operator_id',uid).order('created_at',{ascending:false}).limit(50).then(async r=>{
  const d=(r.data??[]) as Row[];setRows(d);const ids=[...new Set(d.map(x=>x.availability_id as string))];if(!ids.length)return;
  const a=await sb.from('aircraft_availability').select('id,origin_code,destination_code,departure_from').in('id',ids);
  setAv(Object.fromEntries(((a.data??[]) as Row[]).map(x=>[x.id,x])))})},[uid]);
 if(rows===null)return <div className="sk-wait" aria-busy="true"/>;
 if(!rows.length)return <Empty title={T.ofEmptyT} text={T.ofEmptyP} cta={T.ofEmptyCta} on={goInbox}/>;
 const n=(s:string)=>rows.filter(x=>x.status===s).length;
 return <section className="sk-offers">
  <div className="sk-tally"><div><b>{n('BROKER_REVIEW')}</b><small>{T.q_BROKER_REVIEW}</small></div><div><b>{n('CLIENT_PRESENTED')}</b><small>{T.q_CLIENT_PRESENTED}</small></div><div><b>{n('CLIENT_ACCEPTED')}</b><small>{T.q_CLIENT_ACCEPTED}</small></div></div>
  <ul className="sk-oflist">{rows.map(q=>{const a=av[q.availability_id],s=STEP[q.status]??1,dead=q.status==='EXPIRED'||q.status==='WITHDRAWN'||q.status==='CLIENT_REJECTED';
   return <li key={q.id} className={`sk-of s${s}${dead?' dead':''}`}>
    <div className="sk-of-h"><span dir="ltr" className="sk-of-r"><b>{a?.origin_code??'···'}</b><i/><b>{a?.destination_code??'···'}</b></span><span className="sk-of-n">{a?`${apName(air,a.origin_code,lang)}${a.destination_code?` – ${apName(air,a.destination_code,lang)}`:''}`:''}</span>
     <span className="sk-of-p" dir="ltr">{Number(q.operator_price_usd).toLocaleString('en-US')}<small> {q.currency}</small></span></div>
    <ol className="sk-relay" aria-label={T['q_'+q.status]}>{T.relay.map((x,i)=><li key={x} className={i<s?'done':''}><i aria-hidden="true"/><span>{x}</span></li>)}</ol>
    <div className="sk-of-f"><Chip tone={q.status==='CLIENT_ACCEPTED'?'ok':dead?'bad':'est'}>{T['q_'+q.status]}</Chip>
     <small>{a?`${dt(new Date(a.departure_from),lang)} · ${tm(new Date(a.departure_from),lang)} · `:''}{T.validTo} {dt(new Date(q.valid_until),lang)} {tm(new Date(q.valid_until),lang)}</small>
     {q.status==='CLIENT_ACCEPTED'&&<button type="button" onClick={goPay}>{T.toPay}</button>}</div></li>})}</ul></section>}
