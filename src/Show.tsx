import Route from './Route';
import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,ParsedRequest} from './data/types';
import {useI18n,airportName,catL} from './i18n';
import JourneyRoom from './Journey';
import Glyph from './Glyph';
const GL=['plane','radar','clock','wx','air','road','land'];
const IC:Record<string,string>={'show.t1':'road','show.t2':'air','show.t3':'plane','show.t4':'land','show.t5':'road'};
const OG:Record<string,string>={a:'speed',b:'seat',c:'scale'},PG:Record<string,string>={speed:'speed',privacy:'lock',comfort:'seat',flex:'flex',exp:'star'};
const PRI=['speed','privacy','comfort','flex','exp'] as const;
const PICK:Record<string,string>={speed:'a',privacy:'b',comfort:'b',flex:'c',exp:'b'};
const hm=(s:string,add:number)=>{const [h,m]=s.split(':').map(Number);const x=((h*60+m+add)%1440+1440)%1440;return `${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`};
// تجربة "جرّب رحلة": العين تكشف ذكاءها تدريجيًا. كل ما هنا بيانات تمثيلية ومعلّمة بذلك، ولا شيء منها توافر أو سعر حقيقي.
export default function Show({airports,who='',rel=''}:{airports:Airport[];who?:string;rel?:string}){
 const {t}=useI18n();const [step,setStep]=useState(0),[txt,setTxt]=useState(''),[p,setP]=useState<ParsedRequest|null>(null),[n,setN]=useState(0),[pri,setPri]=useState<string>(''),[err,setErr]=useState(false),[busy,setBusy]=useState(false);
 const nm=(c?:string)=>{const a=airports.find(x=>x.iata===c);return a?airportName(a):c??''};
 const go=async(q:string)=>{setErr(false);setBusy(true);const r=await api.parseRequest(q);setBusy(false);if(!r.origin||!r.destination||!r.options.length){setErr(true);return}setP(r);setStep(1)};
 useEffect(()=>{if(step!==1)return;const id=setTimeout(()=>setStep(2),2600);return()=>clearTimeout(id)},[step]);
 useEffect(()=>{if(step!==2)return;setN(0);const id=setInterval(()=>setN(x=>x<7?x+1:x),650);return()=>clearInterval(id)},[step]);
 const best=p?.options.find(o=>o.id===PICK[pri])??p?.options[0];
 const forTxt=who?t('show.for',{w:who==='me'?t('d.me'):who==='group'?t('d.group'):rel?t(rel):t('d.other')}):'';
 const route=p?<Route from={nm(p.origin)} to={nm(p.destination)}/>:null;
 const RT=<><p className="rt">{route}</p>{forTxt&&<p className="dim sm">{forTxt}</p>}</>;
 const back=()=>setStep(step<=3?0:step-1);
 const dep=best?.departure??'09:00';
 if(step===10&&p)return <JourneyRoom guest airports={airports} real={false} ask={txt}/>;
 return <section className="show" aria-live="polite"><span className="chip">{t('show.demo')}</span>{step>=2&&<button className="g bk" onClick={back}>{t('d.back')}</button>}
  {step===0&&<><div className="hd"><Glyph k="air" s={56}/><h2>{t('show.ask')}</h2></div><div className="ask"><input aria-label={t('show.ask')} placeholder={t('j.req.ph')} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&txt.trim()&&go(txt)}/></div>
   <div className="act">{['j.ex1','j.ex2'].map(k=><button key={k} className="g" onClick={()=>{setTxt(t(k));go(t(k))}}>{t(k)}</button>)}</div>
   {err&&<div className="nt" role="alert">{t('show.miss')}</div>}<button disabled={busy||!txt.trim()} onClick={()=>go(txt)}>{t('show.go')}</button></>}
  {step===1&&<><div className="eye an" aria-hidden><i/></div><p className="big">{t('show.see')}</p>{RT}<p className="dim">{t('show.look')}</p></>}
  {step===2&&<>{RT}<ul className="scan">{GL.map((g,j)=><li key={g} className={j<n?'on':''}><Glyph k={g}/><span>{t('show.s'+(j+1))}</span><b aria-hidden>{g==='radar'?'◌':'✓'}</b></li>)}</ul>
   {n>=7&&<><Glyph k="lens" s={52}/><p className="big">{t('show.found')}</p><button onClick={()=>setStep(3)}>{t('show.next')}</button></>}</>}
  {step===3&&p&&<><p className="big">{t('show.pick')}</p><div className="opts">{p.options.slice(0,3).map(o=><div className="o" key={o.id}><Glyph k={OG[o.id]??'seat'} s={44}/><b>{t('opt.'+o.id)}</b><span>{catL(o.category)}</span><small>{t('show.why.'+o.id)}</small></div>)}</div>
   <p className="dim">{t('show.fit')}</p><button onClick={()=>setStep(4)}>{t('show.next')}</button></>}
  {step===4&&<><p className="big">{t('show.q')}</p><div className="act">{PRI.map(k=><button key={k} className="g pri" onClick={()=>{setPri(k);setStep(5)}}><Glyph k={PG[k]} s={34}/>{t('show.p.'+k)}</button>)}</div></>}
  {step===5&&p&&<><Glyph k="wx" s={56}/><p className="big">{t('show.wx.t')}</p>{RT}
   <ul className="scan">{[p.origin,p.destination].map(c=><li className="on" key={c}><Glyph k="air" s={30}/><span>{nm(c)}</span><b className="w" aria-hidden>◌</b></li>)}</ul>
   <p className="dim">{t('show.wx.n')}</p><button onClick={()=>setStep(6)}>{t('show.next')}</button></>}
  {step===6&&p&&best&&<><p className="dim">{t('show.got',{p:t('show.p.'+pri)})}</p><p className="big">{t('show.plan')}</p>{RT}
   <ol className="plan">{([['show.t1',-90,1],['show.t2',-45,1],['show.t3',0,0],['show.t4',best.durationMin,0],['show.t5',best.durationMin+15,1]] as const).map(([k,a,g])=><li key={k}><span dir="ltr">{hm(best.departure,a)}</span><Glyph k={IC[k]} s={26}/>{t(k)}<small>{g?t('show.soon'):t('show.est')}</small></li>)}</ol>
   <button onClick={()=>setStep(7)}>{t('show.next')}</button></>}
  {step===7&&p&&<><Glyph k="star" s={56}/><p className="big">{t('show.after',{d:nm(p.destination)})}</p>
   <ul className="scan">{[['plane','show.after1'],['radar','show.after2']].map(([g,k])=><li className="on" key={k}><Glyph k={g} s={30}/><span>{t(k)}</span><small>{t('show.soon')}</small></li>)}</ul>
   <p className="dim">{t('show.after.n')}</p><button onClick={()=>setStep(8)}>{t('show.next')}</button></>}
  {step===8&&p&&<><Glyph k="clock" s={56}/><p className="big">{t('show.alt')}</p>{RT}
   <ul className="scan">{[-60,0,60].map(a=><li className="on" key={a}><span dir="ltr">{hm(dep,a)}</span><span>{a===0?t('show.alt.now'):t('show.est')}</span><b className="w" aria-hidden>◌</b></li>)}</ul>
   <p className="dim">{t('show.alt.n')}</p><button onClick={()=>setStep(9)}>{t('show.next')}</button></>}
  {step===9&&p&&<><Glyph k="land" s={56}/><p className="big">{t('show.end1')}</p><p className="dim">{t('show.end2')}</p><div className="act"><button onClick={()=>setStep(10)}>{t('show.real')}</button><button className="g" onClick={()=>{setStep(0);setP(null);setTxt('');setPri('')}}>{t('show.again')}</button></div></>}
 </section>}
