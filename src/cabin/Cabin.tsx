import {useEffect,useMemo,useRef,useState} from 'react';
import './cabin.css';import './royal.css';import '../ask.css';
import {useI18n,LANGS,type Lang} from '../i18n';
import {copy} from './copy';
import {HUBS,hub,dist,flightMin,rangeFor,localToUtc,clock,clocksChange,type Hub} from './geo';
import Radar,{type Blip} from './Radar';
import {Spec} from './CabinMedia';
import {Toggle} from './Switch';
const BASE=import.meta.env.VITE_SUPABASE_URL??'https://yiklciblxwymcxxszkty.supabase.co';
// الكابينة: تجربة العميل كاملة حول الرادار. الرادار يستقبل الوجهة، ويعرض البحث، ويتابع الرحلة.
// كل ما هنا محاكاة معلَّمة: لا مشغّل حقيقي ولا إرسال. المسافات والأزمنة تُحسب من الإحداثيات وتُسمّى تقديرًا.
type Stage='doors'|'tracked'|'ask'|'understand'|'search'|'found'|'recommend'|'approve'|'waiting'|'confirmed'|'monitor'|'done';
type Win='am'|'noon'|'pm';type Opt='best'|'value'|'alt';type Note=null|'change'|'alert';
// المسار: «القرار» حتى يؤكد المشغّل، ثم «التجهيز». لا نُظهر «الرحلة» قبل أن تبدأ.
const PHASE:Record<Stage,number>={doors:0,ask:0,understand:0,search:0,found:0,recommend:0,approve:0,waiting:0,confirmed:1,monitor:2,tracked:1,done:4};
const norm=(s:string)=>s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const CAP:Record<string,[number,number]>={LIGHT:[6,2500],MID:[8,4500],SUPER:[9,6000],LARGE:[14,9000],ULR:[16,13000]};
const ORDER=['LIGHT','MID','SUPER','LARGE','ULR'];
const TIME:Record<Win,string>={am:'09:00',noon:'13:00',pm:'18:00'};
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
const demoDate=()=>Date.now()<Date.UTC(2026,9,25)?'2026-10-25':iso(Date.now()+18*864e5);
const km10=(n:number)=>(Math.round(n/10)*10).toLocaleString('en');
// المقصورات المناسبة لهذه المسافة وهذا العدد. المدى يُحتسب بهامش احتياطي 15%.
function fit(km:number,n:number){return ORDER.filter(k=>CAP[k][0]>=n&&CAP[k][1]*.85>=km)}
const Mark=()=><svg className="cb-mark" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 13l4.5 4.5L24 8l7.5 9.5L36 13l-2 7H14z"/><path d="M5 31c5-7 12-10.5 19-10.5S38 24 43 31c-5 7-12 10.5-19 10.5S10 38 5 31z"/><circle cx="24" cy="31" r="4.2"/><circle cx="24" cy="31" r="1.3" fill="currentColor" stroke="none"/></svg>;
export default function Cabin(){
 const {lang,setLang,t}=useI18n(),c=copy(lang),L=lang;
 const [aps,setAps]=useState<string[]>([]),[nm0,setNm0]=useState(''),[ch,setCh]=useState<'whatsapp'|'phone'|'email'>('whatsapp'),[cv,setCv]=useState(''),[agree,setAgree]=useState(false),[sendErr,setSendErr]=useState(''),[sent,setSent]=useState(false);
 useEffect(()=>{let live=true;fetch(`${BASE}/functions/v1/submit-request`).then(r=>r.ok?r.json():null).then(j=>{if(live&&j?.airports)setAps(j.airports.map((a:any)=>a.iata_code))}).catch(()=>{});return()=>{live=false}},[]);
 // الدخول من الصفحة الرئيسية: ?to=LON يفتح الكابينة وقد اختيرت الوجهة
 const init=(()=>{const q=new URLSearchParams(location.search).get('to');return q&&q!=='RUH'&&HUBS.some(h=>h.iata===q)?q:null})();
 const [kind,setKind]=useState<'new'|'booked'>('new'),[q,setQ]=useState(''),[opName,setOpName]=useState(''),[bnotes,setBnotes]=useState('');
 const [stage,setStage]=useState<Stage>(init?'understand':'doors'),[from,setFrom]=useState('RUH'),[to,setTo]=useState<string|null>(init),[mode,setMode]=useState<'to'|'from'>('to');
 const [guests,setGuests]=useState(2),[date,setDate]=useState(()=>iso(Date.now()+864e5)),[win,setWin]=useState<Win>('am');
 const [hover,setHover]=useState<string|null>(null),[opt,setOpt]=useState<Opt>('best'),[ev,setEv]=useState(false),[why,setWhy]=useState(false);
 const [scan,setScan]=useState(0),[prog,setProg]=useState(0),[note,setNote]=useState<Note>(null),[resolved,setResolved]=useState('');
 const nm=(h:Hub)=>L==='ar'?h.ar:h.en,F=hub(from),D=to?hub(to):null,km=D?dist(F,D):null;
 const go=(s:Stage)=>{setStage(s);window.scrollTo({top:0,behavior:'smooth'})};
 // الخيارات الثلاثة: الأنسب = مقصورة أعلى من الأدنى المناسب طلبًا للراحة، الأوفر = الأدنى المناسب، البديل = الأنسب بعد ساعة
 const plan=useMemo(()=>{
  if(!D||km===null)return null;const f=fit(km,guests);if(!f.length)return null;
  const best=f.length>1?f[1]:f[0],value=f.length>1?f[0]:null,dur=flightMin(km);
  const depAt=(add:number)=>{const u=localToUtc(date,TIME[win],F.tz)+add*60000;return{dep:clock(u,F.tz,L),arr:clock(u+dur*60000,D.tz,L),u}};
  const near=HUBS.filter(h=>h.iata!==from&&h.iata!==to).sort((a,b)=>dist(F,a)-dist(F,b));
  const opts:{id:Opt;cat:string;hub:string;off:[number,number];pos:number|null;t:ReturnType<typeof depAt>;desc:string}[]=[
   {id:'best',cat:best,hub:from,off:[26,-20],pos:null,t:depAt(0),desc:c.opt.bestD(guests,km<=CAP[best][1]*.85)},
   ...(value?[{id:'value' as Opt,cat:value,hub:near[1]?.iata??from,off:[-18,-18] as [number,number],pos:near[1]?flightMin(dist(near[1],F)):null,t:depAt(0),desc:c.opt.valueD}]:[]),
   {id:'alt',cat:best,hub:from,off:[-28,22],pos:null,t:depAt(60),desc:c.opt.altD(60)}];
  return{opts,dur,u:depAt(0).u,arrU:depAt(0).u+dur*60000};
 },[D?.iata,from,guests,date,win,L,km]);
 const cur=plan?.opts.find(o=>o.id===opt)??plan?.opts[0]??null;
 const big=D&&km!==null&&!plan;
 // الطائرات التمثيلية على الرادار: تظهر مع تقدّم البحث
 const blips:Blip[]=useMemo(()=>{
  if(kind==='booked'||!plan||!(stage==='search'||stage==='found'||stage==='recommend'))return[];
  const shownN=stage==='search'?Math.max(0,scan-1):99;
  return plan.opts.slice(0,shownN).map(o=>({id:o.id,hub:o.hub,dx:o.off[0],dy:o.off[1],sel:stage!=='search'&&o.id===opt,posFrom:o.pos?from:undefined,label:`${c.aircraft.approx(nm(hub(o.hub)))} · ${c.aircraft.sim}`}));
 },[plan,stage,scan,opt,from,L,kind]);
 // مؤقّتات الحالات
 useEffect(()=>{if(stage!=='search')return;setScan(0);let n=0;const id=setInterval(()=>{n++;setScan(n);if(n>=5){clearInterval(id);setTimeout(()=>go(kind==='booked'?'tracked':'found'),700)}},850);return()=>clearInterval(id)},[stage]);
 const pick=(i:string)=>{
  if(stage!=='ask'&&stage!=='understand')return;
  if(mode==='from'){if(i===to)setTo(from);setFrom(i);setMode('to');return}
  if(i===from){setMode('from');return}
  setTo(i);setMode('to');setHover(null);if(stage==='ask')go('understand');
 };
 const sug=useMemo(()=>{const n=norm(q);return n?HUBS.filter(h=>h.iata!==from&&(norm(h.ar).includes(n)||norm(h.en).includes(n)||h.iata.toLowerCase()===n)).slice(0,6):[]},[q,from]);
 const choose=(i:string)=>{setQ('');setTo(i);setMode('to');setHover(null);go('understand')};
 const demo=()=>{setKind('new');setFrom('RUH');setTo('LON');setGuests(6);setDate(demoDate());setWin('am');setMode('to');go('understand')};
 const reset=()=>{setSent(false);setSendErr('');setTo(null);setFrom('RUH');setMode('to');setOpt('best');setEv(false);setWhy(false);setProg(0);setNote(null);setResolved('');setGuests(2);setKind('new');setQ('');setOpName('');setBnotes('');go('doors')};
 const contactOk=nm0.trim().length>=2&&(ch==='email'?/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cv.trim()):/^\+?[0-9]{7,15}$/.test(cv.replace(/[\s\-()]/g,'')))&&agree;
 // الحجز الحقيقي: طلب يصل إلى إنسان من الفريق (submit-request). لا يُرسل لأي مشغّل ولا يُؤكَّد توفر أو سعر.
 const outside=aps.length>0&&(!aps.includes(from)||!(to&&aps.includes(to)));
 const sendReal=async()=>{
  if(!cur||!to||!contactOk||sent)return;setSendErr('');
  const q=new URLSearchParams(location.search),SRC=['HOTEL','TRAVEL_AGENCY','CONCIERGE','YACHT_BROKER','CORPORATE','OTHER'],src=(q.get('src')||'').toUpperCase();
  const note=`cabin | ${cur.id}: ${cur.cat} | ${TIME[win]}`.slice(0,500);
  try{
   const r=await fetch(`${BASE}/functions/v1/submit-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact_name:nm0.trim(),contact_channel:ch,contact_value:cv.trim(),origin_code:from,destination_code:to,travel_date:date,departure_period:win==='am'?'morning':win==='noon'?'afternoon':'evening',passengers:guests,note,consent:true,source:SRC.includes(src)?src:'DIRECT',referral_partner:q.get('ref')||undefined,campaign:q.get('campaign')||'cabin'})});
   if(r.ok){setSent(true);go('waiting');return}
   const j=await r.json().catch(()=>({}));setSendErr(r.status===429?t('ask.err.limit'):j?.field?t('ask.err.field',{x:j.field}):t('ask.err.generic'));
  }catch{setSendErr(t('ask.err.generic'))}
 };
 // الرحلة: شريط الوقت يحرّك الطائرة على المسار
 const frac=Math.max(0,Math.min(1,(prog-18)/(97-18))),si=prog===0?0:prog<12?1:prog<20?2:prog<85?3:prog<100?4:5;
 const sIdx=Math.max(0,Math.min(4,prog<8?0:prog<14?1:prog<20?2:prog<97?3:4));
 const alertH=D?nm(D):'';
 const durTxt=(m:number)=>m<60?`${m} ${c.units.m}`:`${Math.floor(m/60)} ${c.units.h} ${String(m%60).padStart(2,'0')} ${c.units.m}`;
 const hud=useMemo(()=>{
  if(stage==='ask'){if(hover&&hover!==from){const h=hub(hover);return c.ask.read(nm(F),nm(h),km10(dist(F,h)),durTxt(flightMin(dist(F,h))))}return mode==='from'?c.ask.tapFrom:c.ask.tapTo}
  if(note==='alert')return `${c.alt.alt} · ${L==='ar'?'لوتون':'Luton'}`;
  if(stage==='search')return c.search.say[Math.min(3,Math.max(0,scan-1))];
  if((stage==='found'||stage==='recommend')&&cur)return `${c.aircraft.approx(nm(hub(cur.hub)))} · ${c.aircraft.sim}`;
  if(D&&km!==null)return c.ask.read(nm(F),nm(D),km10(km),durTxt(flightMin(km)));
  return c.ask.here(nm(F));
 },[stage,hover,from,to,mode,scan,L,km,opt,plan,note]);
 const when=new Intl.DateTimeFormat(L==='ar'?'ar-u-nu-latn':L,{day:'numeric',month:'long'}).format(new Date(date+'T12:00:00'));
 const status=(k:'inferred'|'unknown'|'estimated'|'pending'|'confirmed')=><span className={`cb-st ${k}`}>{c.found.st[k]}</span>;
 const stepsDone=(i:number)=>i===3?false:scan>i+0;
 return <div className="cb" data-phase={PHASE[stage]} data-stage={stage} dir={L==='ar'?'rtl':'ltr'} lang={L}>
  <header className="cb-top"><span className="cb-brand"><Mark/><span className="cb-brand-t"><b>{c.brand}</b><small>THE KING'S EYE</small></span></span><span className="cb-sim">{c.sim}</span>
   <div className="cb-lang" role="group" aria-label="Language">{LANGS.map(l=><button key={l} type="button" lang={l} aria-pressed={L===l} onClick={()=>setLang(l as Lang)}>{l.toUpperCase()}</button>)}</div></header>
  <div className="cb-grid">
   <nav className="cb-rail" aria-label={c.phases[PHASE[stage]]}><ol>{c.phases.map((p,i)=><li key={p} className={i<PHASE[stage]?'past':i===PHASE[stage]?'now':''} aria-current={i===PHASE[stage]?'step':undefined}><i/><span>{p}</span></li>)}</ol></nav>
   <section className="cb-panel paper" aria-live="polite">
    {stage!=='doors'&&<div className="cb-ctx">
     {stage==='ask'||(stage==='understand')?<><button type="button" className={`cb-chip${mode==='from'?' on':''}`} aria-pressed={mode==='from'} onClick={()=>setMode('from')}><small>{c.ask.from}</small>{nm(F)}</button>
      <span className="cb-arrow" aria-hidden>{L==='ar'?'←':'→'}</span>
      <button type="button" className={`cb-chip${mode==='to'?' on':''}`} aria-pressed={mode==='to'} onClick={()=>setMode('to')}><small>{c.ask.to}</small>{D?nm(D):'…'}</button></>
      :<p className="cb-trip"><b>{nm(F)} {L==='ar'?'←':'→'} {D?nm(D):''}</b><span>{kind==='booked'?when:`${when} · ${c.und.guestsUnit(guests)}`}</span></p>}
    </div>}
    <p className="cb-eye"><i aria-hidden/>{kind==='booked'&&stage==='ask'?c.bk.askEye:kind==='booked'&&stage==='search'?c.bk.eyeAdd:c.eye[stage]}</p>
    <div className="cb-body" key={stage+(note??'')}>
     {stage==='doors'&&<><h1>{c.doors.title}</h1><p className="cb-sub">{c.doors.sub}</p>
      <div className="cb-doors"><button type="button" className="cb-door" onClick={()=>{setKind('new');go('ask')}}><b>{c.doors.newT}</b><small>{c.doors.newS}</small></button>
       <button type="button" className="cb-door" onClick={()=>{setKind('booked');go('ask')}}><b>{c.doors.bookedT}</b><small>{c.doors.bookedS}</small></button></div></>}
     {stage==='ask'&&<><h1>{kind==='booked'?c.bk.ask:c.ask.title}</h1><p className="cb-sub">{kind==='booked'?c.bk.sub:c.ask.sub}</p>
      <div className="cb-find"><label htmlFor="cbq">{c.find.label}</label><input id="cbq" value={q} placeholder={c.find.ph} autoComplete="off" onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&sug[0])choose(sug[0].iata)}}/>
       {q.trim()&&(sug.length?<div className="cb-sug">{sug.map(h=><button key={h.iata} type="button" onClick={()=>choose(h.iata)}>{nm(h)}</button>)}</div>:<p className="cb-note">{c.find.none}</p>)}</div>
      {kind==='new'&&<button type="button" className="cb-ghost" onClick={demo}>{c.ask.demo}</button>}</>}
     {stage==='understand'&&D&&<><h1>{c.und.title(nm(F),nm(D))}</h1><p className="cb-sub">{kind==='booked'?c.bk.sub:c.und.sub}</p>
      {kind==='new'&&<div className="cb-row"><span id="gl">{c.und.guests}</span><div className="cb-step" role="group" aria-labelledby="gl"><button type="button" onClick={()=>setGuests(g=>Math.max(1,g-1))} aria-label="−" disabled={guests<=1}>−</button><output>{guests}</output><button type="button" onClick={()=>setGuests(g=>Math.min(20,g+1))} aria-label="+">+</button></div></div>}
      <label className="cb-row"><span>{c.und.date}</span><input type="date" value={date} min={iso(Date.now())} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
      {kind==='new'&&<div className="cb-row col"><span id="wl">{c.und.when}</span><div className="cb-seg" role="radiogroup" aria-labelledby="wl">{(['am','noon','pm'] as Win[]).map((w,i)=><button key={w} type="button" role="radio" aria-checked={win===w} onClick={()=>setWin(w)}>{c.und.win[i]}</button>)}</div></div>}
      {kind==='booked'&&<><label className="cb-field"><span>{c.bk.op}</span><input value={opName} maxLength={80} placeholder={c.bk.opPh} onChange={e=>setOpName(e.target.value)}/></label><label className="cb-field"><span>{c.bk.notes}</span><textarea value={bnotes} maxLength={600} placeholder={c.bk.notesPh} onChange={e=>setBnotes(e.target.value)}/></label></>}
      {kind==='new'&&big?<p className="cb-note">{c.und.big}</p>:<button type="button" className="cb-cta" onClick={()=>go('search')}>{kind==='booked'?c.bk.go:c.und.go}</button>}</>}
     {stage==='tracked'&&D&&<><h1>{c.bk.tracked(opName.trim()||c.bk.yourOp)}</h1><p className="cb-sub">{nm(F)} {L==='ar'?'←':'→'} {nm(D)} · {when}</p>
      <ul className="cb-ul">{c.bk.pts.map(x=><li key={x}>{x}</li>)}</ul><p className="cb-note">{c.bk.note}</p>
      <button type="button" className="cb-ghost" onClick={reset}>{c.bk.again}</button></>}
     {stage==='search'&&<><h1>{kind==='booked'?c.bk.title:c.search.title}</h1><ul className="cb-steps">{(kind==='booked'?c.bk.steps:c.search.steps).map((s,i)=><li key={s} className={stepsDone(i)?'ok':i===3?'later':scan===i?'busy':''}><b aria-hidden>{i===3?'○':stepsDone(i)?'✓':'◌'}</b><span>{s}{i===3&&<small>{c.search.later}</small>}</span></li>)}</ul></>}
     {(stage==='found'||stage==='recommend')&&plan&&cur&&<>
      {stage==='found'&&<><h1>{c.found.title}</h1><p className="cb-sub">{c.found.sub}</p>
       <div className="cb-opts">{plan.opts.map(o=><button key={o.id} type="button" className={`cb-opt${opt===o.id?' on':''}`} aria-pressed={opt===o.id} onClick={()=>setOpt(o.id)}>
        <small>{c.opt[o.id]}</small><b>{c.opt.cat[o.cat]}</b><span className="why">{o.desc}</span><em>{c.opt.at(o.t.dep,o.t.arr)}</em>
        <em className="dim">{o.pos?c.opt.pos(durTxt(o.pos)):c.opt.here}</em><em className="pend"><i aria-hidden/>{c.opt.status} · {c.opt.price}</em></button>)}</div>
       <button type="button" className="cb-link" aria-expanded={ev} onClick={()=>setEv(!ev)}>{c.found.evBtn}</button>
       {ev&&<div className="cb-evid"><h2>{c.found.evTitle}</h2><ul>
        <li><span>{c.found.ev.near(plan.opts.length+0,nm(F))}</span>{status('inferred')}<small>{c.found.ev.nearS}</small></li>
        <li><span>{c.found.ev.op}</span>{status('unknown')}<small>{c.found.ev.opS}</small></li>
        <li><span>{c.found.ev.route(km10(km!),durTxt(plan.dur))}</span>{status('estimated')}<small>{c.found.ev.routeS}</small></li>
        {clocksChange(D!.tz,plan.u,plan.arrU)&&<li><span>{c.found.ev.clock(nm(D!))}</span>{status('confirmed')}<small>{c.found.ev.clockS}</small></li>}
        <li><span>{c.found.ev.wx}</span>{status('pending')}<small>{c.found.ev.wxS}</small></li></ul></div>}
       <button type="button" className="cb-cta" onClick={()=>go('recommend')}>{c.rec.pick}</button></>}
      {stage==='recommend'&&<><h1>{cur.id==='best'?c.rec.lead:c.opt[cur.id]}</h1>
       <p className="cb-because">{cur.id==='best'?c.rec.because(cur.desc):cur.desc}</p>
       <div className="cb-hero"><small>{c.opt[cur.id]}</small><b>{c.opt.cat[cur.cat]}</b><span>{nm(F)} {L==='ar'?'←':'→'} {nm(D!)}</span><em>{c.opt.at(cur.t.dep,cur.t.arr)}</em></div>
       <p className="cb-pend"><i aria-hidden/>{c.opt.status} · {c.opt.price}</p>
       <details className="cb-det"><summary>{c.details}</summary><Spec cat={cur.cat} guests={guests} c={c} L={L}/></details>
       <button type="button" className="cb-link" aria-expanded={why} onClick={()=>setWhy(!why)}>{c.rec.why}</button>
       {why&&<div className="cb-evid"><h2>{c.rec.whyT}</h2><ul>{c.rec.w(c.opt.cat[cur.cat]).map(x=><li key={x}><span>{x}</span></li>)}</ul></div>}
       <button type="button" className="cb-cta" onClick={()=>go('approve')}>{c.rec.cta}</button>
       <button type="button" className="cb-ghost" onClick={()=>go('found')}>{c.rec.other}</button></>}</>}
     {stage==='approve'&&cur&&D&&<><h1>{c.appr.title}</h1><p className="cb-sub">{c.appr.body}</p>
      <ul className="cb-sum"><li>{nm(F)} {L==='ar'?'←':'→'} {nm(D)}</li><li>{when} · {c.opt.at(cur.t.dep,cur.t.arr)}</li><li>{guests} · {c.opt.cat[cur.cat]}</li></ul>
      <p className="cb-note">{t('ask.contactSub')}</p>
      {outside?<p className="cb-note" role="alert">{t('ask.outside')}</p>:<>
      <label className="cb-row"><span>{t('ask.name')}</span><input className="ak-in" value={nm0} maxLength={80} autoComplete="name" onChange={e=>setNm0(e.target.value)}/></label>
      <div className="cb-row col"><div className="cb-seg" role="radiogroup" aria-label={t('ask.how')}>{(['whatsapp','phone','email'] as const).map(k=><button key={k} type="button" role="radio" aria-checked={ch===k} onClick={()=>{setCh(k);setCv('')}}>{t('ask.ch.'+k)}</button>)}</div></div>
      <label className="cb-row"><span>{t('ask.ch.'+ch)}</span><input className="ak-in" dir="ltr" inputMode={ch==='email'?'email':'tel'} value={cv} maxLength={120} autoComplete={ch==='email'?'email':'tel'} onChange={e=>setCv(e.target.value)} placeholder={ch==='email'?'name@example.com':'+9665XXXXXXXX'}/></label>
      <Toggle checked={agree} onChange={setAgree}>{t('ask.consent')}</Toggle>
      {sendErr&&<p className="cb-note" role="alert">{sendErr}</p>}
      <button type="button" className="cb-cta" disabled={!contactOk||sent} onClick={sendReal}>{c.appr.send}</button>{!contactOk&&<p className="cb-hint">{t('ask.need')}</p>}</>}
      <button type="button" className="cb-link" onClick={()=>go('recommend')}>{c.appr.back}</button></>}
     {stage==='waiting'&&<><h1>{t('ask.sentT')}</h1><p className="cb-sub">{t('ask.sentBody')}</p><p className="cb-pend"><i aria-hidden/>{t('ask.sentSt')}</p>
      <button type="button" className="cb-ghost" onClick={()=>go('confirmed')}>{t('ask.seeDemo')}</button></>}
     {stage==='confirmed'&&cur&&<><h1>{c.conf.title}</h1><p className="cb-sub">{c.conf.body(c.opt.cat[cur.cat])}</p>
      <ul className="cb-evid inline"><li><span>{c.conf.ev}</span></li><li><span>{c.conf.price}</span></li></ul>
      <button type="button" className="cb-cta" onClick={()=>{setProg(0);go('monitor')}}>{c.conf.cta}</button></>}
     {stage==='monitor'&&cur&&D&&plan&&<><h1>{c.mon.title}</h1>
      {note===null&&<p className="cb-sub">{resolved||c.mon.say(c.mon.stages[si],clock(plan.arrU+(cur.id==='alt'?60*6e4:0),D.tz,L))}{!resolved&&prog<100&&<><br/>{c.mon.calm}</>}</p>}
      {note==='change'&&<div className="cb-card"><h2>{c.chg.title}</h2><p>{c.chg.body}</p><p className="cb-pend"><i aria-hidden/>{c.chg.diff}</p><div className="cb-two"><button type="button" className="cb-cta" onClick={()=>{setNote(null);setResolved(c.chg.did)}}>{c.chg.approve}</button><button type="button" className="cb-ghost" onClick={()=>{setNote(null);setResolved(c.chg.kept)}}>{c.chg.keep}</button></div></div>}
      {note==='alert'&&<div className="cb-card warn"><h2>{c.alt.title}</h2><p>{c.alt.body(alertH,L==='ar'?'لوتون':'Luton')}</p><p className="cb-note">{c.alt.note}</p><p className="cb-hint">{c.alt.sim}</p><div className="cb-two"><button type="button" className="cb-cta" onClick={()=>{setNote(null);setResolved(c.alt.did)}}>{c.alt.approve}</button><button type="button" className="cb-ghost" onClick={()=>{setNote(null);setResolved(c.alt.kept)}}>{c.alt.keep}</button></div></div>}
      <ol className="cb-tl">{c.mon.tl.map((x,i)=><li key={x} className={i<sIdx?'past':i===sIdx?'now':''}><i aria-hidden/><span>{x}</span></li>)}</ol>
      <label className="cb-scrub"><span>{c.mon.scrub}</span><input type="range" min={0} max={100} value={prog} onChange={e=>setProg(+e.target.value)}/></label>
      {note===null&&prog<100&&<div className="cb-sims"><span>{c.mon.sim}</span><button type="button" className="cb-chipb" onClick={()=>{setResolved('');setNote('change')}}>{c.mon.simChange}</button><button type="button" className="cb-chipb" onClick={()=>{setResolved('');setNote('alert')}}>{c.mon.simAlert}</button></div>}
      {prog>=100&&note===null&&<button type="button" className="cb-cta" onClick={()=>go('done')}>{c.done.title(nm(D))}</button>}</>}
     {stage==='done'&&cur&&D&&<><h1>{c.done.title(nm(D))}</h1><p className="cb-sub">{c.done.body}</p>
      <ul className="cb-sum"><li>{nm(F)} {L==='ar'?'←':'→'} {nm(D)}</li><li>{when} · {guests} · {c.opt.cat[cur.cat]}</li></ul><button type="button" className="cb-cta" onClick={reset}>{c.done.again}</button></>}
    </div>
    <p className="cb-foot">{c.simFoot}</p>
   </section>
   <div className="cb-stage"><Radar hubs={HUBS} from={from} to={to} hover={hover} name={nm} range={rangeFor(km)} blips={blips} scanning={stage==='search'}
    plane={stage==='monitor'||stage==='done'?(stage==='done'?1:frac):null} alt={note==='alert'?(L==='ar'?c.alt.alt+' · لوتون':c.alt.alt+' · Luton'):null} hud={hud} aria={c.gl.radar} kmUnit={c.units.km}
    onHover={stage==='ask'||stage==='understand'?setHover:()=>{}} onPick={pick} onBlip={id=>setOpt(id as Opt)}/></div>
  </div>
 </div>;
}
