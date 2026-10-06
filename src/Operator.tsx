import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,EmptyLegInput,EmptyLegResult,MarketLeg} from './data/types';
import {useI18n,airportName,catL} from './i18n';
const MODELS=['Citation XLS+','Praetor 600','Challenger 350','Global 6000','Legacy 650'];
export default function OperatorRoom({airports}:{airports:Airport[]}){
 const {t,lang,dir}=useI18n();const [f,setF]=useState<EmptyLegInput>({aircraft:MODELS[0],origin:'RUH',from:'18:00',destination:'ANY',seats:6});
 const [steps,setSteps]=useState<string[]>([]),[busy,setBusy]=useState(false),[res,setRes]=useState<EmptyLegResult|null>(null);
 const [mk,setMk]=useState<MarketLeg[]>([]),[note,setNote]=useState(''),[err,setErr]=useState('');
 useEffect(()=>{api.listMarket().then(setMk)},[lang]);
 const set=<K extends keyof EmptyLegInput>(k:K,v:EmptyLegInput[K])=>setF({...f,[k]:v});
 const go=async()=>{setErr('');setRes(null);setNote('');setSteps([]);setBusy(true);
  try{setRes(await api.analyzeEmptyLeg(f,s=>setSteps(p=>[...p,s])))}catch{setErr(t('op.same'))}setBusy(false)};
 const T=res?res.score.freshness+res.score.sourceStrength+res.score.urgency+res.score.confidence:0;
 return <section className="sec"><div className="mono">OPERATOR EYE</div><h2>{t('op.title')}</h2>
  <div className="mono" style={{margin:'10px 0'}}>ADD EMPTY LEG<span className="badge b">SIM</span></div>
  <div className="f2">
   <label>{t('op.aircraft')}<select value={f.aircraft} onChange={e=>set('aircraft',e.target.value)}>{MODELS.map(m=><option key={m}>{m}</option>)}</select></label>
   <label>{t('op.location')}<select value={f.origin} onChange={e=>set('origin',e.target.value)}>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} ({a.iata})</option>)}</select></label>
   <label>{t('op.from')}<input type="time" value={f.from} onChange={e=>set('from',e.target.value)}/></label>
   <label>{t('op.dest')}<select value={f.destination} onChange={e=>set('destination',e.target.value)}><option value="ANY">{t('op.any')}</option>{airports.map(a=><option key={a.iata} value={a.iata}>{airportName(a)} ({a.iata})</option>)}</select></label>
   <label>{t('op.seats')}<input type="number" min={1} max={19} value={f.seats} onChange={e=>set('seats',Math.max(1,Number(e.target.value)||1))}/></label>
   <label>{t('op.target')}<input type="number" min={0} value={f.targetUsd??''} onChange={e=>set('targetUsd',e.target.value?Number(e.target.value):undefined)}/></label>
  </div>
  <button onClick={go} disabled={busy}>{t('op.analyze')}</button>{err&&<div className="nt" role="alert">{err}</div>}
  {busy&&<ul id="an" style={{listStyle:'none',padding:0,font:'12px/1.9 JetBrains Mono,monospace',color:'var(--dim)',direction:dir,marginTop:14}}><li className="mono">THE EYE IS THINKING<span className="badge b">SIM</span></li>{steps.map(s=><li key={s}>· {s}</li>)}</ul>}
  {res&&<div className="brief"><div className="mono">WHY THE EYE NOTICED<span className="badge b">SIM</span><span className="badge u">PENDING_VERIFICATION</span></div><p>{t('op.pending')}</p><span className="big">{T}</span><span className="mono"> / 100 · CONFIDENCE {res.confidence.toUpperCase()}</span>
   <ul>{res.reasons.map(r=><li key={r}>{r}</li>)}</ul>
   <div className="nt e">{t('op.recommends',{what:res.recommendation==='OUTREACH'?t('op.rec.outreach'):t('op.rec.watch')})}</div>
   <div className="act"><button disabled={res.recommendation!=='OUTREACH'} onClick={()=>setNote(res.draft)}>{t('op.prepare')}</button><button className="g" onClick={()=>setNote('WATCH')}>{t('op.watch')}</button><button className="g" onClick={()=>{setRes(null);setNote('')}}>{t('op.ignore')}</button></div>
   {note==='WATCH'?<div className="nt">{t('op.watching')}</div>:note&&<div className="nt"><span className="mono">DRAFT · APPROVAL REQUIRED</span><p>{note}</p><small>{t('op.nothingSent')}</small></div>}</div>}
  {mk.length>0&&<div className="mono" style={{margin:'36px 0 6px'}}>MARKET AROUND YOU<span className="badge b">INFERRED</span></div>}
  {mk.map((m,i)=><div className="sg" key={i}><span>{catL(m.aircraftCategory)} · <span dir="ltr">{m.origin} → {m.destination}</span></span><span className="pr">{m.status.toUpperCase()} · {m.confidence}</span><small>{t('op.market.note')}</small></div>)}
 </section>;
}
