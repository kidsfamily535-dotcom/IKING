import {useCallback,useEffect,useMemo,useState} from 'react';
import './trip.css';
import StatusChip,{type ChipKind} from '../StatusChip';
import LangSwitch from '../LangSwitch';
import {realApi} from '../data/supabaseApi';
import type {Airport,RouteWx} from '../data/types';
import {airportName,useI18n} from '../i18n';
import {useTripCopy} from './copy';
import {loadRealTrip,type RealTrip,type Transfer,type Margin} from './tripData';
// «ملف الرحلة الحي» بالبيانات الفعلية: قراءة فقط. لا كتابة في القاعدة ولا إرسال لأي جهة.
// قاعدة العرض: «مؤكد» فقط لرصد طقس رسمي حديث أو لسجل أكّده فريقنا. ما أدخله العميل يُوسم «من إدخالك». والمجهول يُقال مجهولًا.
type VNode={id:string;time:string;kind:ChipKind;text:string;src:string};
const hm=(x:string)=>new Date(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const dt=(x:string)=>new Date(x).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export default function TripReal(){
 const t=useTripCopy();const {lang}=useI18n();
 const [r,setR]=useState<RealTrip|null|undefined>(undefined),[fail,setFail]=useState(false),[ap,setAp]=useState<Airport[]>([]),[open,setOpen]=useState<Record<string,boolean>>({});
 const load=useCallback(()=>{setFail(false);loadRealTrip().then(setR,()=>{setFail(true);setR(null)})},[]);
 useEffect(()=>{load();realApi.listAirports().then(setAp).catch(()=>setAp([]));const i=setInterval(load,600000);return()=>clearInterval(i)},[load]);
 const nm=useCallback((c:string)=>{const a=ap.find(x=>x.iata===c);return a?airportName(a):c},[ap,lang]);
 const v=useMemo(()=>r?build(r,t,nm):null,[r,t,nm]);
 return <div className="tf">
  <LangSwitch/>
  <header className="tf-top"><a className="tf-back" href="/">{t('back')}</a><span className="tf-sim">{t('real.pill')}</span></header>
  <main className="tf-main">
   {r===undefined&&<p role="status">{t('real.load')}</p>}
   {fail&&<div className="tf-done" role="alert" style={{background:'#f3e4dc',borderColor:'#8a4b2b',color:'#4a2412'}}>{t('real.fail')} <button type="button" className="tf-human" style={{marginInlineStart:8}} onClick={()=>{setR(undefined);load()}}>{t('real.retry')}</button></div>}
   {r===null&&!fail&&<div className="tf-brief"><p>{t('real.none')}</p><a className="tf-back" href="/?view=watch">{t('real.add')}</a></div>}
   {r&&v&&<>
    <section className="tf-head"><p className="tf-eye" dir="ltr">{r.trip.origin} → {r.trip.destination}</p><h1>{nm(r.trip.origin)} · {nm(r.trip.destination)}</h1><p className="tf-sub">{t('sub')}</p>
     <div className="tf-brief" role="note"><b>{t('brief.t')}</b><ul>{v.brief.map((b,i)=><li key={i}>{b}</li>)}</ul></div></section>
    <div className="tf-grid">
     <ol className="tf-line" aria-label={t('title')}>
      {v.nodes.map(n=><li key={n.id} className="tf-n"><span className="tf-dot" aria-hidden/>
       <div className="tf-card"><div className="tf-row"><b>{t('n.'+n.id)}</b><span className="tf-time" dir="ltr">{n.time}</span></div>
        <p>{n.text}</p>
        <div className="tf-meta"><StatusChip kind={n.kind}>{t('chip.'+n.kind)}</StatusChip>
         <button type="button" className="tf-src" aria-expanded={!!open[n.id]} onClick={()=>setOpen(o=>({...o,[n.id]:!o[n.id]}))}>{t('src')}</button></div>
        {open[n.id]&&<div className="tf-srcl">{n.src}</div>}</div></li>)}
     </ol>
     <aside className="tf-led" aria-label={t('led.t')}><h2>{t('led.t')}</h2>
      <ul>{v.ledger.length?v.ledger.map((e,i)=><li key={i}><span className="tf-k noticed">{t('k.noticed')}</span><span>{e.text}{e.at&&<small> · {t('at',{t:e.at})}</small>}</span></li>):<li>{t('rl.none')}</li>}</ul>
      <p className="tf-sub" style={{fontSize:14}}>{t('real.ro')}</p>
      <a className="tf-human" style={{display:'inline-flex',alignItems:'center',textDecoration:'none'}} href="/?view=watch">{t('real.add')}</a></aside>
    </div>
    {v.plan&&<section className="tf-led" style={{marginTop:22,position:'static'}} aria-label={t('plan.t')}><h2>{t('plan.t')} · <span dir="ltr">{v.plan.date}</span></h2>
     <p>{v.plan.demo&&<StatusChip kind="sim">{t('plan.demo')}</StatusChip>} <StatusChip kind="estimate">{t('m.'+v.plan.worst)}</StatusChip>{v.plan.ret&&<small> · {v.plan.ret}</small>}</p>
     <ul>{v.plan.stops.map(s=><li key={s.seq}><span dir="ltr" style={{flex:'none',minWidth:92}}>{s.startsAt?hm(s.startsAt):'—'}{s.endsAt?'–'+hm(s.endsAt):''}</span><span>{s.kind==='LEG'?t('plan.leg',{a:nm(s.from??''),b:nm(s.to??'')}):(s.title??'—')}{s.margin&&<small> · {t('m.'+s.margin)}</small>}</span></li>)}</ul></section>}
   </>}
  </main></div>;
}
type Tr=ReturnType<typeof useTripCopy>;
function build(r:RealTrip,t:Tr,nm:(c:string)=>string){
 const tr=r.transfers.ok?r.transfers.v:null;
 const pick=(d:Transfer['direction'])=>tr?tr.find(x=>x.direction===d)??null:null;
 const car=(id:'car1'|'car2',d:Transfer['direction']):VNode=>{
  if(!tr)return{id,time:'—',kind:'unknown',text:t('r.car.fail'),src:t('rs.fail')};
  const x=pick(d);if(!x)return{id,time:'—',kind:'unknown',text:t(id==='car1'?'r.car1.none':'r.car2.none'),src:t('rs.nodata')};
  const note=x.note?t('r.car.note',{n:x.note}):'';
  return{id,time:hm(x.pickupAt),kind:x.status==='EXECUTED'?'confirmed':x.status==='REQUESTED'?'given':'unknown',text:t('r.car.'+x.status,{t:hm(x.pickupAt)})+note,src:t('rs.car.'+x.status)}};
 const dep=r.trip.departureAt;
 const arr=r.wx.ok?r.wx.v.find((w:RouteWx)=>w.leg==='arr'):undefined;
 const fresh=arr&&arr.status==='CURRENT';
 const cat=arr?.cat?t('wc.'+arr.cat):t('wc.none'),wind=arr?.windKt!=null?t('wc.wind',{k:arr.windKt}):'';
 const wx:VNode=!r.wx.ok?{id:'wx',time:'—',kind:'unknown',text:t('r.wx.fail'),src:t('rs.fail')}
  :fresh&&arr?{id:'wx',time:arr.observedAt?hm(arr.observedAt):'—',kind:'confirmed',text:t('r.wx',{a:nm(arr.code),n:arr.ageMin??0,c:cat,w:wind}),src:t('rs.wx',{n:arr.ageMin??0})}
  :{id:'wx',time:'—',kind:'unknown',text:t('r.wx.no',{a:nm(r.trip.destination)}),src:t('rs.wx.no')};
 const legStop=r.plan.ok&&r.plan.v?r.plan.v.stops.find(s=>s.kind==='LEG'&&s.from===r.trip.origin&&s.to===r.trip.destination&&s.endsAt):undefined;
 const land:VNode=legStop?.endsAt?{id:'land',time:hm(legStop.endsAt),kind:'estimate',text:t('r.land',{t:hm(legStop.endsAt)}),src:t('rs.land.'+legStop.basis)}
  :{id:'land',time:'—',kind:'unknown',text:t(r.plan.ok?'r.land.none':'rs.fail'),src:t(r.plan.ok?'rs.nodata':'rs.fail')};
 const m=r.mission.ok?r.mission.v:null;
 const event:VNode=!r.mission.ok?{id:'event',time:'—',kind:'unknown',text:t('rs.fail'),src:t('rs.fail')}
  :m?{id:'event',time:m.arriveLocal?m.arriveLocal.slice(11,16)||'—':'—',kind:'given',text:t('r.event',{ti:m.title??t('n.event'),t:m.arriveLocal?m.arriveLocal.replace('T',' ').slice(0,16):'—'}),src:t('rs.event')}
  :{id:'event',time:'—',kind:'unknown',text:t('r.event.none'),src:t('rs.nodata')};
 const nodes:VNode[]=[car('car1','TO_AIRPORT'),{id:'apt',time:'—',kind:'unknown',text:t('n.apt.d'),src:t('src.unk')},
  dep?{id:'fly',time:hm(dep),kind:'given',text:t('r.fly'),src:t('rs.fly',{t:dt(r.trip.createdAt)})}:{id:'fly',time:'—',kind:'unknown',text:t('r.fly.none'),src:t('rs.nodata')},
  wx,land,car('car2','FROM_AIRPORT'),event];
 const st=(d:Transfer['direction'])=>!tr?t('s.fail'):t('s.'+(pick(d)?.status??'none'));
 const brief=[
  !r.wx.ok?t('rb.wx.fail'):fresh&&arr?t('rb.wx',{a:nm(arr.code),w:cat+wind}):t('rb.wx.no'),
  t('rb.car',{s:st('TO_AIRPORT')}),
  !r.alerts.ok?t('rb.al.fail'):(r.alerts.v.optIn?t('rb.al.on'):t('rb.al.off'))+(r.alerts.v.live?'':t('rb.al.nolive'))];
 const ledger:{text:string;at?:string}[]=[];
 if(fresh&&arr)ledger.push({text:t('rl.wx',{a:nm(arr.code)}),at:arr.observedAt?hm(arr.observedAt):undefined});
 for(const d of ['TO_AIRPORT','FROM_AIRPORT'] as const){const x=pick(d);if(x)ledger.push({text:t('rl.car',{d:t('rl.d.'+d),s:t('s.'+x.status)})})}
 const p=r.plan.ok?r.plan.v:null;
 if(p)ledger.push({text:t('rl.plan',{m:t('m.'+p.worst)})});
 const plan=p?{date:p.date,demo:p.isDemo,worst:p.worst as Margin,ret:p.returnAt?t('plan.ret',{t:hm(p.returnAt)}):'',stops:p.stops}:null;
 return{nodes,brief,ledger,plan};
}
