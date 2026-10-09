import {useEffect,useMemo,useRef,useState} from 'react';
import './cabin/cabin.css';import './ask.css';
import {sb} from './lib/supabase';
import {useI18n,LANGS,type Lang} from './i18n';
import {Toggle} from './cabin/Switch';import {HUBS,dist,flightMin,hm} from './cabin/geo';
// «اطلب رحلتك»: العميل يكتب رحلته بكلامه، والعين تفهم وتسأل عمّا ينقص فقط (سؤال واحد كل مرة)،
// ثم يؤكد العميل فهمها ويترك طريقة التواصل. لا يُرسل شيء لأي مشغّل: الطلب يصل إلى إنسان من الفريق (submit-request).
// الفهم يقترحه النموذج (understand-request) وتتحقق منه الشيفرة؛ التأكيد والإرسال قرار العميل.
type F={origin_code:string|null;destination_code:string|null;travel_date:string|null;departure_period:string|null;passengers:number|null;baggage_note:string|null;return_requested:boolean};
type Resp={status:'NEEDS_INFO'|'READY_TO_CONFIRM'|'NEEDS_CHECK'|'UNAVAILABLE';fields?:F;missing_fields?:string[];evidence?:Record<string,string>};
type Ap={iata_code:string;name_ar:string|null;name_en:string|null};
type Stage='say'|'reading'|'ask'|'confirm'|'contact'|'sending'|'sent';
const BASE=import.meta.env.VITE_SUPABASE_URL??'https://yiklciblxwymcxxszkty.supabase.co';
const EMPTY:F={origin_code:null,destination_code:null,travel_date:null,departure_period:null,passengers:null,baggage_note:null,return_requested:false};
// الفترات التي يقبلها باب الإرسال: morning / afternoon / evening / flexible
const toPeriod=(p:string|null)=>p==='morning'?'morning':p==='noon'||p==='afternoon'?'afternoon':p==='evening'||p==='night'?'evening':'flexible';
const QKEY:Record<string,string>={origin_code:'ask.q.origin',destination_code:'ask.q.dest',travel_date:'ask.q.date',passengers:'ask.q.pax'};
const iso=(t:number)=>new Date(t).toISOString().slice(0,10);
export default function Ask(){
 const {t,lang,setLang}=useI18n();
 const [stage,setStage]=useState<Stage>('say'),[lines,setLines]=useState<string[]>([]),[draft,setDraft]=useState('');
 const [f,setF]=useState<F>(EMPTY),[ev,setEv]=useState<Record<string,string>>({}),[check,setCheck]=useState(false),[miss,setMiss]=useState<string[]>([]),[busy,setBusy]=useState('');
 const [aps,setAps]=useState<Ap[]>([]),[err,setErr]=useState('');
 const [name,setName]=useState(''),[ch,setCh]=useState<'whatsapp'|'phone'|'email'>('whatsapp'),[val,setVal]=useState(''),[ok,setOk]=useState(false),[trap,setTrap]=useState('');
 const box=useRef<HTMLTextAreaElement>(null);
 const Q=useMemo(()=>new URLSearchParams(location.search),[]);
 useEffect(()=>{let live=true;fetch(`${BASE}/functions/v1/submit-request`).then(r=>r.ok?r.json():null).then(j=>{if(live&&j?.airports)setAps(j.airports)}).catch(()=>{});return()=>{live=false}},[]);
 useEffect(()=>{if(stage==='say'||stage==='ask')box.current?.focus()},[stage]);
 const apName=(a:Ap)=>`${a.iata_code} · ${lang==='ar'?(a.name_ar||a.name_en):(a.name_en||a.name_ar)}`;
 const label=(c:string|null)=>{if(!c)return '…';const a=aps.find(x=>x.iata_code===c);return a?apName(a):c};
 const text=lines.join('\n');
 // يرسل كل ما قاله العميل حتى الآن؛ الدالة تأخذ الإجابة الأخيرة كتصحيح أو إجابة عن السؤال السابق
 const understand=async(all:string[])=>{
  setErr('');setStage('reading');
  try{
   const {data,error}=await sb.functions.invoke('understand-request',{body:{text:all.join('\n'),website:trap}});
   if(error){const code=(error as any)?.context?.status;setErr(code===429?t('ask.err.limit'):t('ask.err.busy'));setStage(all.length>1?'ask':'say');if(code!==429){setF(EMPTY);setStage('confirm')}return}
   const r=data as Resp;
   if(r.status==='UNAVAILABLE'||!r.fields){setErr(t('ask.err.busy'));setF(EMPTY);setEv({});setCheck(false);setStage('confirm');return}
   setF(r.fields);setEv(r.evidence??{});setMiss(r.missing_fields??[]);setCheck(r.status==='NEEDS_CHECK');
   setStage(r.status==='NEEDS_INFO'?'ask':'confirm');setDraft('');
  }catch{setErr(t('ask.err.busy'));setF(EMPTY);setStage('confirm')}
 };
 const submitSay=()=>{const v=draft.trim();if(v.length<2)return;const all=[...lines,v];setLines(all);setDraft('');understand(all)};
 const complete=f.origin_code&&f.destination_code&&f.travel_date&&f.passengers&&f.origin_code!==f.destination_code;
 const contactOk=name.trim().length>=2&&(ch==='email'?/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim()):/^\+?[0-9]{7,15}$/.test(val.replace(/[\s\-()]/g,'')))&&ok;
 const send=async()=>{
  if(!complete||!contactOk)return;setErr('');setStage('sending');
  const src=(Q.get('src')||'').toUpperCase(),SRC=['HOTEL','TRAVEL_AGENCY','CONCIERGE','YACHT_BROKER','CORPORATE','OTHER'];
  const note=[check?'[needs human check]':'',text.replace(/\n/g,' / '),f.baggage_note?`bags: ${f.baggage_note}`:'',f.return_requested?'return: yes (date not set)':''].filter(Boolean).join(' | ').slice(0,500);
  try{
   const r=await fetch(`${BASE}/functions/v1/submit-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    contact_name:name.trim(),contact_channel:ch,contact_value:val.trim(),origin_code:f.origin_code,destination_code:f.destination_code,travel_date:f.travel_date,
    departure_period:toPeriod(f.departure_period),passengers:f.passengers,note,consent:true,source:SRC.includes(src)?src:'DIRECT',
    referral_partner:Q.get('ref')||undefined,campaign:Q.get('campaign')||'agent_intake',website:trap})});
   if(r.ok){setStage('sent');return}
   const j=await r.json().catch(()=>({}));setErr(r.status===429?t('ask.err.limit'):j?.field?t('ask.err.field',{x:j.field}):t('ask.err.generic'));setStage('contact');
  }catch{setErr(t('ask.err.generic'));setStage('contact')}
 };
 const again=()=>{setLines([]);setDraft('');setF(EMPTY);setEv({});setCheck(false);setMiss([]);setVal('');setOk(false);setErr('');setStage('say')};
 const eo=HUBS.find(h=>h.iata===f.origin_code),ed=HUBS.find(h=>h.iata===f.destination_code),ekm=eo&&ed&&eo.iata!==ed.iata?Math.round(dist(eo,ed)):null;
 const D=lang==='ar'?'rtl':'ltr',arrow=lang==='ar'?'←':'→',top=iso(Date.now());
 const selF=(k:'origin_code'|'destination_code',lbl:string)=><label className="cb-row"><span>{lbl}</span><select value={f[k]??''} onChange={e=>setF({...f,[k]:e.target.value||null})}><option value="">…</option>{aps.length?aps.map(a=><option key={a.iata_code} value={a.iata_code}>{apName(a)}</option>):f[k]?<option value={f[k]!}>{f[k]}</option>:null}</select></label>;
 const said=(k:string)=>ev[k]?<small className="ak-said">{t('ask.said',{x:ev[k]})}</small>:null;
 return <div className="cb ak" data-phase={stage==='sent'?4:stage==='say'||stage==='reading'||stage==='ask'?0:2} dir={D} lang={lang}>
  <header className="cb-top"><span className="cb-brand">THE KING'S EYE</span>
   <div className="cb-lang" role="group" aria-label="Language">{LANGS.map(l=><button key={l} type="button" lang={l} aria-pressed={lang===l} onClick={()=>setLang(l as Lang)}>{l.toUpperCase()}</button>)}</div></header>
  <div className="cb-grid"><section className="cb-panel" aria-live="polite"><div className="cb-body" key={stage}>
   <input className="ak-trap" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={e=>setTrap(e.target.value)} name="website"/>
   {stage==='say'&&<><h1>{t('ask.title')}</h1><p className="cb-sub">{t('ask.sub')}</p>
    <textarea ref={box} className="ak-say" rows={4} maxLength={600} value={draft} placeholder={t('ask.ph')} aria-label={t('ask.title')} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();submitSay()}}}/>
    {err&&<p className="cb-note" role="alert">{err}</p>}
    <button type="button" className="cb-cta" disabled={draft.trim().length<2} onClick={submitSay}>{t('ask.go')}</button>
    <button type="button" className="cb-link" onClick={()=>setDraft(t('ask.egText'))}>{t('ask.eg')}</button></>}
   {stage==='reading'&&<><p className="cb-eye"><i aria-hidden/>{t('ask.reading')}</p><p className="cb-sub ak-quote">{lines[lines.length-1]}</p></>}
   {stage==='ask'&&<><p className="cb-sub ak-quote">{lines[0]}</p><h1>{t(QKEY[miss[0]]??'ask.q.generic')}</h1>
    <textarea ref={box} className="ak-say short" rows={2} maxLength={300} value={draft} placeholder={t('ask.qph')} aria-label={t(QKEY[miss[0]]??'ask.q.generic')} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitSay()}}}/>
    {err&&<p className="cb-note" role="alert">{err}</p>}
    <button type="button" className="cb-cta" disabled={draft.trim().length<1} onClick={submitSay}>{t('ask.send')}</button>
    <button type="button" className="cb-link" onClick={()=>setStage('confirm')}>{t('ask.manual')}</button></>}
   {stage==='confirm'&&<><h1>{t('ask.confirmT')}</h1><p className="cb-sub">{t('ask.confirmSub')}</p>
    {err&&<p className="cb-note" role="alert">{err}</p>}{check&&!err&&<p className="cb-note">{t('ask.check')}</p>}
    <div className="ak-eye"><p><b>{t('eye.saw')}</b> {t('eye.sawD')}</p>{ekm&&<p><b>{t('eye.est')}</b> <span className="ak-est">{t('eye.estB')}</span> {t('eye.estD',{k:ekm,h:hm(flightMin(ekm))})}</p>}<p><b>{t('eye.unk')}</b> <span className="ak-unk">{t('eye.unkB')}</span> {t('eye.unkD')}</p><p><b>{t('eye.shall')}</b> {t('eye.shallD')}</p></div>
    {selF('origin_code',t('ask.f.from'))}{said('origin_code')}{selF('destination_code',t('ask.f.to'))}{said('destination_code')}
    <label className="cb-row"><span>{t('ask.f.date')}</span><input type="date" min={top} value={f.travel_date??''} onChange={e=>setF({...f,travel_date:e.target.value||null})}/></label>{said('travel_date')}
    <div className="cb-row"><span id="akp">{t('ask.f.pax')}</span><div className="cb-step" role="group" aria-labelledby="akp"><button type="button" aria-label="−" disabled={(f.passengers??0)<=1} onClick={()=>setF({...f,passengers:Math.max(1,(f.passengers??2)-1)})}>−</button><output>{f.passengers??'…'}</output><button type="button" aria-label="+" onClick={()=>setF({...f,passengers:Math.min(40,(f.passengers??0)+1)})}>+</button></div></div>{said('passengers')}
    <div className="cb-row col"><span id="akw">{t('ask.f.when')}</span><div className="cb-seg ak-seg4" role="radiogroup" aria-labelledby="akw">{(['morning','afternoon','evening','flexible'] as const).map(p=><button key={p} type="button" role="radio" aria-checked={toPeriod(f.departure_period)===p} onClick={()=>setF({...f,departure_period:p})}>{t('ask.when.'+p)}</button>)}</div></div>
    {f.return_requested&&<p className="cb-pend"><i aria-hidden/>{t('ask.ret')}</p>}
    <button type="button" className="cb-cta" disabled={!complete} onClick={()=>setStage('contact')}>{t('ask.yes')}</button>
    <button type="button" className="cb-ghost" onClick={()=>{setStage('say');setDraft('')}}>{t('ask.fix')}</button></>}
   {(stage==='contact'||stage==='sending')&&<><h1>{t('ask.contactT')}</h1>
    <p className="cb-trip"><b>{label(f.origin_code)} {arrow} {label(f.destination_code)}</b><span>{f.travel_date} · {t('ask.paxN',{n:f.passengers??0})}</span></p>
    <p className="cb-sub">{t('ask.contactSub')}</p>
    <label className="cb-row"><span>{t('ask.name')}</span><input className="ak-in" value={name} maxLength={80} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>
    <div className="cb-row col"><div className="cb-seg" role="radiogroup" aria-label={t('ask.how')}>{(['whatsapp','phone','email'] as const).map(c=><button key={c} type="button" role="radio" aria-checked={ch===c} onClick={()=>{setCh(c);setVal('')}}>{t('ask.ch.'+c)}</button>)}</div></div>
    <label className="cb-row"><span>{t('ask.ch.'+ch)}</span><input className="ak-in" dir="ltr" inputMode={ch==='email'?'email':'tel'} value={val} maxLength={120} autoComplete={ch==='email'?'email':'tel'} onChange={e=>setVal(e.target.value)} placeholder={ch==='email'?'name@example.com':'+9665XXXXXXXX'}/></label>
    <Toggle checked={ok} onChange={setOk}>{t('ask.consent')}</Toggle>
    {err&&<p className="cb-note" role="alert">{err}</p>}
    <button type="button" className="cb-cta" disabled={!contactOk||stage==='sending'} aria-busy={stage==='sending'} onClick={send}>{t('ask.submit')}</button>
    <button type="button" className="cb-link" onClick={()=>setStage('confirm')}>{t('ask.back')}</button></>}
   {stage==='sent'&&<><h1>{t('ask.sentT')}</h1><p className="cb-trip"><b>{label(f.origin_code)} {arrow} {label(f.destination_code)}</b><span>{f.travel_date} · {t('ask.paxN',{n:f.passengers??0})}</span></p><p className="cb-sub">{t('ask.sentBody')}</p>
    <p className="cb-pend"><i aria-hidden/>{t('ask.sentSt')}</p><button type="button" className="cb-ghost" onClick={again}>{t('ask.again')}</button></>}
  </div><p className="cb-foot">{t('ask.foot')}</p></section></div></div>;
}
