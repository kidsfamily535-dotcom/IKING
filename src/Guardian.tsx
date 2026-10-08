import {useState} from 'react';
import {api} from './data/api';
import {guardianTips,COMPANIONS,PRIORITIES} from './data/guardian';
import type {Companion,MyTrip,Priority,RouteWx} from './data/types';
import {useI18n} from './i18n';
// «الحارس الأمين» للعميل: من يسافر معك (يقوله العميل بنفسه) + اقتراحات قصيرة من قواعد حتمية على الطقس الحالي.
// الاقتراح لا يُنفَّذ ولا يُرسَل. وما يخص الصحة يُكتب كتفضيل مشي («يفضّل المشي القليل») لا كحالة.
export function CompanionChips({value,onChange,disabled}:{value:Companion[];onChange:(v:Companion[])=>void;disabled?:boolean}){
 const {t}=useI18n();
 return <div role="group" aria-label={t('gd.who')} className="act" style={{justifyContent:'flex-start',gap:8,flexWrap:'wrap'}}>
  {COMPANIONS.map(c=>{const on=value.includes(c);return <button key={c} type="button" disabled={disabled} className={on?'':'g'} aria-pressed={on} onClick={()=>onChange(on?value.filter(x=>x!==c):[...value,c])}>{t('gd.c.'+c)}</button>})}</div>;
}
// «إيش الأهم لك؟»: اختيار واحد اختياري (الضغط على المختار يمسحه). variant='watch' لشكل صفحة Watch.
export function PriorityChips({value,onChange,disabled,variant}:{value:Priority|null;onChange:(v:Priority|null)=>void;disabled?:boolean;variant?:'watch'}){
 const {t}=useI18n();
 const btn=(p:Priority)=>{const on=value===p;return <button key={p} type="button" disabled={disabled} className={variant==='watch'?(on?'on':''):(on?'':'g')} aria-pressed={on} onClick={()=>onChange(on?null:p)}>{t('pr.'+p)}</button>};
 return variant==='watch'?<div role="group" aria-label={t('pr.q')} className="chips">{PRIORITIES.map(btn)}</div>
  :<div role="group" aria-label={t('pr.q')} className="act" style={{justifyContent:'flex-start',gap:8,flexWrap:'wrap'}}>{PRIORITIES.map(btn)}</div>}
export default function Guardian({trip,wx,nm,onChange}:{trip:MyTrip;wx:RouteWx[]|null;nm:(c:string)=>string;onChange:()=>void}){
 const {t}=useI18n();const [busy,setBusy]=useState(false),[err,setErr]=useState(false);
 const set=async(v:Companion[])=>{setErr(false);setBusy(true);try{await api.setTripCompanions(trip.id,v);onChange()}catch{setErr(true)}finally{setBusy(false)}};
 const setP=async(v:Priority|null)=>{setErr(false);setBusy(true);try{await api.setTripPriority(trip.id,v);onChange()}catch{setErr(true)}finally{setBusy(false)}};
 const tips=guardianTips(wx,trip.companions);
 return <div style={{marginTop:20}}>
  <div className="mono" style={{margin:'0 0 6px'}}>{t('gd.title')}</div>
  <p className="dim sm" style={{margin:'0 0 8px'}}>{t('gd.who')}</p>
  <CompanionChips value={trip.companions} onChange={set} disabled={busy}/>
  <small style={{color:'var(--dim)',display:'block',margin:'6px 0'}}>{t('gd.who.note')}</small>
  <p className="dim sm" style={{margin:'12px 0 8px'}}>{t('pr.q')}</p>
  <PriorityChips value={trip.priority} onChange={setP} disabled={busy}/>
  <small style={{color:'var(--dim)',display:'block',margin:'6px 0'}}>{t('pr.note')}</small>
  {err&&<div className="nt" role="alert">{t('mt.err')}</div>}
  {wx&&(tips.length?<>{tips.map(x=><div className="nt e" key={x.id}>{t('gd.'+x.id,{...x.vars,a:nm(x.code)})}</div>)}<small style={{color:'var(--dim)',display:'block'}}>{t('gd.note')}</small></>:<div className="nt">{t('gd.none')}</div>)}
 </div>;
}
