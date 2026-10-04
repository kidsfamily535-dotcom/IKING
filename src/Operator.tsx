import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,EmptyLegInput,EmptyLegResult,MarketLeg} from './data/types';
const MODELS=['Citation XLS+','Praetor 600','Challenger 350','Global 6000','Legacy 650'];
export default function OperatorRoom({airports}:{airports:Airport[]}){
 const [f,setF]=useState<EmptyLegInput>({aircraft:MODELS[0],origin:'RUH',from:'18:00',destination:'ANY',seats:6});
 const [steps,setSteps]=useState<string[]>([]),[busy,setBusy]=useState(false),[res,setRes]=useState<EmptyLegResult|null>(null);
 const [mk,setMk]=useState<MarketLeg[]>([]),[note,setNote]=useState(''),[err,setErr]=useState('');
 useEffect(()=>{api.listMarket().then(setMk)},[]);
 const set=<K extends keyof EmptyLegInput>(k:K,v:EmptyLegInput[K])=>setF({...f,[k]:v});
 const go=async()=>{setErr('');setRes(null);setNote('');setSteps([]);setBusy(true);
  try{setRes(await api.analyzeEmptyLeg(f,s=>setSteps(p=>[...p,s])))}catch{setErr('المطار الحالي والوجهة متطابقان. اختر وجهة مختلفة.')}setBusy(false)};
 const T=res?res.score.freshness+res.score.sourceStrength+res.score.urgency+res.score.confidence:0;
 return <section className="sec"><div className="mono">OPERATOR EYE</div><h2>حوّل التموضع الفاضي إلى فرصة</h2>
  <div className="mono" style={{margin:'10px 0'}}>ADD EMPTY LEG</div>
  <div className="f2">
   <label>الطائرة<select value={f.aircraft} onChange={e=>set('aircraft',e.target.value)}>{MODELS.map(m=><option key={m}>{m}</option>)}</select></label>
   <label>الموقع الحالي<select value={f.origin} onChange={e=>set('origin',e.target.value)}>{airports.map(a=><option key={a.iata} value={a.iata}>{a.nameAr} ({a.iata})</option>)}</select></label>
   <label>متاحة من (وقت)<input type="time" value={f.from} onChange={e=>set('from',e.target.value)}/></label>
   <label>الوجهة المفضلة<select value={f.destination} onChange={e=>set('destination',e.target.value)}><option value="ANY">أي وجهة</option>{airports.map(a=><option key={a.iata} value={a.iata}>{a.nameAr} ({a.iata})</option>)}</select></label>
   <label>المقاعد<input type="number" min={1} max={19} value={f.seats} onChange={e=>set('seats',Math.max(1,Number(e.target.value)||1))}/></label>
   <label>السعر المستهدف USD (اختياري)<input type="number" min={0} value={f.targetUsd??''} onChange={e=>set('targetUsd',e.target.value?Number(e.target.value):undefined)}/></label>
  </div>
  <button onClick={go} disabled={busy}>اطلب من العين التحليل</button>{err&&<div className="nt" role="alert">{err}</div>}
  {busy&&<ul id="an" style={{listStyle:'none',padding:0,font:'12px/1.9 JetBrains Mono,monospace',color:'var(--dim)',direction:'ltr',marginTop:14}}><li className="mono">THE EYE IS THINKING<span className="badge b">SIM</span></li>{steps.map(s=><li key={s}>· {s}</li>)}</ul>}
  {res&&<div className="brief"><div className="mono">WHY THE EYE NOTICED<span className="badge u">PENDING_VERIFICATION</span></div><p>في انتظار تحقق الفريق</p><span className="big">{T}</span><span className="mono"> / 100 · CONFIDENCE {res.confidence.toUpperCase()}</span>
   <ul>{res.reasons.map(r=><li key={r}>{r}</li>)}</ul>
   <div className="nt e">العين توصي: {res.recommendation==='OUTREACH'?'التواصل (بعد موافقة بشرية)':'المراقبة'}</div>
   <div className="act"><button disabled={res.recommendation!=='OUTREACH'} onClick={()=>setNote(res.draft)}>جهّز التواصل</button><button className="g" onClick={()=>setNote('WATCH')}>راقب</button><button className="g" onClick={()=>{setRes(null);setNote('')}}>تجاهل</button></div>
   {note==='WATCH'?<div className="nt">العين ستراقب هذه الفرصة وتخبرك بأي تغيير.</div>:note&&<div className="nt"><span className="mono">DRAFT · APPROVAL REQUIRED</span><p>{note}</p><small>لم يُرسل شيء. ينتظر موافقة الفريق.</small></div>}</div>}
  <div className="mono" style={{margin:'36px 0 6px'}}>MARKET AROUND YOU<span className="badge b">INFERRED</span></div>
  {mk.map((m,i)=><div className="sg" key={i}><span>{m.aircraftCategory} · <span dir="ltr">{m.origin} → {m.destination}</span></span><span className="pr">{m.status.toUpperCase()} · {m.confidence}</span><small>استنتاج من حركة الطيران وليس توافرًا</small></div>)}
 </section>;
}
