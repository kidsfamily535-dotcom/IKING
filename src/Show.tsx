import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,ParsedRequest} from './data/types';
import {useI18n,airportName,catL} from './i18n';
import JourneyRoom from './Journey';
const PRI=['speed','privacy','comfort','flex','exp'] as const;
const PICK:Record<string,string>={speed:'a',privacy:'b',comfort:'b',flex:'c',exp:'b'};
const hm=(s:string,add:number)=>{const [h,m]=s.split(':').map(Number);const x=((h*60+m+add)%1440+1440)%1440;return `${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`};
// تجربة "جرّب رحلة": العين تكشف ذكاءها تدريجيًا. كل ما هنا بيانات تمثيلية ومعلّمة بذلك، ولا شيء منها توافر أو سعر حقيقي.
export default function Show({airports}:{airports:Airport[]}){
 const {t}=useI18n();const [step,setStep]=useState(0),[txt,setTxt]=useState(''),[p,setP]=useState<ParsedRequest|null>(null),[n,setN]=useState(0),[pri,setPri]=useState<string>(''),[err,setErr]=useState(false),[busy,setBusy]=useState(false);
 const nm=(c?:string)=>{const a=airports.find(x=>x.iata===c);return a?airportName(a):c??''};
 const go=async(q:string)=>{setErr(false);setBusy(true);const r=await api.parseRequest(q);setBusy(false);if(!r.origin||!r.destination||!r.options.length){setErr(true);return}setP(r);setStep(1)};
 useEffect(()=>{if(step!==1)return;const id=setTimeout(()=>setStep(2),2600);return()=>clearTimeout(id)},[step]);
 useEffect(()=>{if(step!==2)return;setN(0);const id=setInterval(()=>setN(x=>x<7?x+1:x),650);return()=>clearInterval(id)},[step]);
 const best=p?.options.find(o=>o.id===PICK[pri])??p?.options[0];
 const route=p?<span dir="ltr">{nm(p.origin)} → {nm(p.destination)}</span>:null;
 if(step===6&&p)return <JourneyRoom guest airports={airports} real={false} ask={txt}/>;
 return <section className="show" aria-live="polite"><span className="chip">{t('show.demo')}</span>
  {step===0&&<><h2>{t('show.ask')}</h2><div className="ask"><input aria-label={t('show.ask')} placeholder={t('j.req.ph')} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&txt.trim()&&go(txt)}/></div>
   <div className="act">{['j.ex1','j.ex2'].map(k=><button key={k} className="g" onClick={()=>{setTxt(t(k));go(t(k))}}>{t(k)}</button>)}</div>
   {err&&<div className="nt" role="alert">{t('show.miss')}</div>}<button disabled={busy||!txt.trim()} onClick={()=>go(txt)}>{t('show.go')}</button></>}
  {step===1&&<><div className="eye an" aria-hidden><i/></div><p className="big">{t('show.see')}</p><p className="rt">{route}</p><p className="dim">{t('show.look')}</p></>}
  {step===2&&<><p className="rt">{route}</p><ul className="scan">{[1,2,3,4,5,6,7].map(i=><li key={i} className={i<=n?'on':''}><b aria-hidden>✓</b>{t('show.s'+i)}</li>)}</ul>
   {n>=7&&<><p className="big">{t('show.found')}</p><button onClick={()=>setStep(3)}>{t('j.agree')}</button></>}</>}
  {step===3&&p&&<><p className="big">{t('show.pick')}</p><div className="opts">{p.options.slice(0,3).map(o=><div key={o.id}><b>{t('opt.'+o.id)}</b><span>{catL(o.category)}</span><small>{t('show.why.'+o.id)}</small></div>)}</div>
   <p className="dim">{t('show.fit')}</p><button onClick={()=>setStep(4)}>{t('j.agree')}</button></>}
  {step===4&&<><p className="big">{t('show.q')}</p><div className="act">{PRI.map(k=><button key={k} className="g" onClick={()=>{setPri(k);setStep(5)}}>{t('show.p.'+k)}</button>)}</div></>}
  {step===5&&p&&best&&<><p className="dim">{t('show.got',{p:t('show.p.'+pri)})}</p><p className="big">{t('show.plan')}</p><p className="rt">{route}</p>
   <ol className="plan">{([['show.t1',-90,1],['show.t2',-45,1],['show.t3',0,0],['show.t4',best.durationMin,0],['show.t5',best.durationMin+15,1]] as const).map(([k,a,g])=><li key={k}><span dir="ltr">{hm(best.departure,a)}</span>{t(k)}<small>{g?t('show.soon'):t('show.est')}</small></li>)}</ol>
   <p className="big">{t('show.end1')}</p><p className="dim">{t('show.end2')}</p><div className="act"><button onClick={()=>setStep(6)}>{t('show.real')}</button><button className="g" onClick={()=>{setStep(0);setP(null);setTxt('');setPri('')}}>{t('show.again')}</button></div></>}
 </section>}
