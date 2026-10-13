import {useMemo,useState} from 'react';
import './trip.css';
import HoldRing from '../Hold';
import StatusChip,{type ChipKind} from '../StatusChip';
import LangSwitch from '../LangSwitch';
import {useTripCopy} from './copy';
// «ملف الرحلة الحي»: خط زمن واحد من الباب إلى الباب، وسجل بما فعلته العين، وقرارات تُعتمد بالضغط المطوّل.
// كله محاكاة موسومة: لا اتصال بالقاعدة، ولا إرسال، ولا حالة «مؤكد» تظهر لشيء لم يؤكده مشغّل أو شريك.
type Kind=Extract<ChipKind,'estimate'|'sim'|'unknown'>;
type Node={id:string;time:string;kind:Kind;dec?:'wx'|'car'};
const NODES:Node[]=[
 {id:'car1',time:'06:30',kind:'estimate'},{id:'apt',time:'07:15',kind:'unknown'},{id:'fly',time:'08:00',kind:'sim'},
 {id:'wx',time:'09:00',kind:'estimate',dec:'wx'},{id:'land',time:'09:35',kind:'estimate'},{id:'car2',time:'09:50',kind:'unknown',dec:'car'},{id:'event',time:'11:00',kind:'sim'}];
const hm=()=>new Date().toTimeString().slice(0,5);
type Entry={k:'noticed'|'prepared'|'approved';text:string;at?:string};
export default function TripFile(){
 const t=useTripCopy();
 const [open,setOpen]=useState<Record<string,boolean>>({});
 const [plan,setPlan]=useState<'a'|'b'|'c'|''>('');
 const [done,setDone]=useState<Record<string,boolean>>({});
 const [more,setMore]=useState<Entry[]>([]);
 const [hu,setHu]=useState(false);
 const waiting=(done.wx?0:1)+(done.car?0:1);
 const base:Entry[]=useMemo(()=>[{k:'prepared',text:t('l.3')},{k:'noticed',text:t('l.2')},{k:'noticed',text:t('l.1')}],[t]);
 const ledger=[...more,...base];
 const approve=(d:'wx'|'car')=>{
  if(done[d])return;
  setDone(s=>({...s,[d]:true}));
  setMore(m=>[{k:'approved',at:hm(),text:d==='wx'?t('l.a',{x:t('d.wx.'+plan)}):t('l.b')},...m]);
 };
 const chipText=(k:Kind)=>t('chip.'+k);
 const src=(k:Kind)=>k==='sim'?t('src.sim'):k==='estimate'?t('src.est'):t('src.unk');
 return <div className="tf">
  <LangSwitch/>
  <header className="tf-top"><a className="tf-back" href="/">{t('back')}</a><span className="tf-sim">{t('sim')}</span></header>
  <main className="tf-main">
   <section className="tf-head"><p className="tf-eye">{t('route')}</p><h1>{t('title')}</h1><p className="tf-sub">{t('sub')}</p>
    <div className="tf-brief" role="note"><b>{t('brief.t')}</b><ul><li>{t('brief.wx')}</li><li>{t('brief.car')}</li><li className={waiting?'w':''}>{waiting?t('brief.wait',{n:waiting}):t('brief.none')}</li></ul></div>
   </section>
   <div className="tf-grid">
    <ol className="tf-line" aria-label={t('title')}>
     {NODES.map(n=>{const isOpen=!!open[n.id];return <li key={n.id} className={`tf-n${n.dec&&!done[n.dec]?' tf-ask':''}${n.dec&&done[n.dec]?' tf-ok':''}`}>
      <span className="tf-dot" aria-hidden/>
      <div className="tf-card">
       <div className="tf-row"><b>{t('n.'+n.id)}</b><span className="tf-time" dir="ltr">{n.time}</span></div>
       <p>{n.kind==='unknown'&&n.id!=='car2'?t('unk.msg'):t('n.'+n.id+'.d')}</p>
       <div className="tf-meta"><StatusChip kind={n.kind}>{chipText(n.kind)}</StatusChip>
        <button type="button" className="tf-src" aria-expanded={isOpen} onClick={()=>setOpen(o=>({...o,[n.id]:!o[n.id]}))}>{t('src')}</button></div>
       {isOpen&&<div className="tf-srcl">{src(n.kind)}</div>}
       {n.dec==='wx'&&!done.wx&&<div className="tf-dec"><p>{t('d.wx.q')}</p>
        <div role="radiogroup" className="tf-opts">{(['a','b','c'] as const).map(o=><button key={o} type="button" role="radio" aria-checked={plan===o} className={plan===o?'on':''} onClick={()=>setPlan(o)}>{t('d.wx.'+o)}</button>)}</div>
        <div className="tf-act">{plan?<HoldRing onDone={()=>approve('wx')}/>:null}<span>{plan?t('d.hold'):t('d.pick')}</span></div></div>}
       {n.dec==='car'&&!done.car&&<div className="tf-dec"><p>{t('d.car.q')}</p><div className="tf-act"><HoldRing onDone={()=>approve('car')}/><span>{t('d.hold')}</span></div></div>}
       {n.dec&&done[n.dec]&&<div className="tf-done" role="status">{t('d.done')}</div>}
      </div></li>})}
    </ol>
    <aside className="tf-led" aria-label={t('led.t')}><h2>{t('led.t')}</h2>
     <ul>{ledger.map((e,i)=><li key={i}><span className={`tf-k ${e.k}`}>{t('k.'+e.k)}</span><span>{e.text}{e.at&&<small> · {t('at',{t:e.at})}</small>}</span></li>)}</ul>
     <button type="button" className="tf-human" onClick={()=>setHu(true)}>{t('human')}</button>
     {hu&&<div className="tf-done" role="status">{t('human.msg')}</div>}
    </aside>
   </div>
  </main>
 </div>;
}
