import {useCallback,useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';

// خطوات التجربة مع مشغّل واحد، داخل «غرفة الوسيط». كل خطوة تمرّ بدالة في القاعدة تتحقق من الصلاحية والحالة؛
// الواجهة لا تكتب في الجداول مباشرة. الدفع هنا تسجيل تحويل استلمه المشغّل (يسجّله الموظف)، وليس بوابة دفع.
const X={ar:{
 th:'شروط العرض',thH:'يراها العميل مع العرض. إن لم يذكرها المشغّل اكتب «غير معروفة» ولا تفترض.',inc:'يشمل (سطر لكل بند)',exc:'لا يشمل (سطر لكل بند)',
 tax:'الضرائب',taxU:'غير معروف',taxY:'مشمولة',taxN:'غير مشمولة',can:'سياسة الإلغاء',pay:'شروط الدفع (اختياري)',save:'احفظ الشروط',edit:'عدّل الشروط',
 rec:(v:number)=>`الشروط مسجّلة (نسخة ${v})`,need:'سجّل شروط العرض أولًا. لا إقرار ولا عرض للعميل بدونها.',
 ah:'بعد تأكيد المشغّل',ahH:'ثلاث خطوات يسجّلها الموظف. لا شيء يُرسل إلى أحد تلقائيًا.',
 p1:'الدفع',p1H:'سجّل التحويل بعد أن يستلمه المشغّل فعلًا. لا يصير الطلب مدفوعًا إلا بتسجيلك مع مرجع التحويل.',amt:'المبلغ المستلم',cur:'العملة',ref:'مرجع التحويل أو الإيصال',
 payGo:'سجّل أنه دُفع',paid:'مدفوع',confirmPay:(a:string)=>`تسجيل دفعة ${a}؟ لا يمكن التراجع عنها من هنا.`,
 p2:'الرحلة',p2H:'تُنشأ بعد تأكيد المشغّل فقط، وتبدأ مراقبتها وسجلها.',dep:'موعد الإقلاع إن كان مؤكدًا (اختياري)',nt:'من أكّد وكيف',tripGo:'أنشئ الرحلة',trip:'الرحلة منشأة',
 unpaid:'تنبيه: لم يُسجَّل دفع لهذا الطلب بعد.',
 p3:'عمولتك من المشغّل',p3H:'داخلي: لا يراها العميل ولا المشغّل. العميل يدفع سعر المشغّل، والعمولة تُحصَّل منه.',
 basis:'الأساس',pct:'نسبة من سعر المشغّل',fix:'مبلغ ثابت',rate:'النسبة %',fixA:'المبلغ',comGo:'احفظ العمولة',expected:'المتوقع',
 st:{EXPECTED:'متوقعة',INVOICED:'صدرت فاتورتها',RECEIVED:'استُلمت',WAIVED:'أُسقطت'} as Record<string,string>,
 inv:'صدرت الفاتورة',rcv:'استُلمت',wv:'أسقطها',cn:'ملاحظة (مرجع التحويل أو سبب الإسقاط)',err:'تعذّر التنفيذ',tripSt:'حالة الرحلة',loading:'جارٍ التحميل…'},
en:{
 th:'Offer terms',thH:'Shown to the client with the offer. If the operator did not state something, write "unknown"; do not assume.',inc:'Includes (one item per line)',exc:'Excludes (one item per line)',
 tax:'Taxes',taxU:'Unknown',taxY:'Included',taxN:'Not included',can:'Cancellation policy',pay:'Payment terms (optional)',save:'Save terms',edit:'Edit terms',
 rec:(v:number)=>`Terms recorded (version ${v})`,need:'Record the offer terms first. No approval and no client offer without them.',
 ah:'After the operator confirmed',ahH:'Three steps recorded by staff. Nothing is sent to anyone automatically.',
 p1:'Payment',p1H:'Record the transfer once the operator has actually received it. A request is paid only when you record it with a reference.',amt:'Amount received',cur:'Currency',ref:'Transfer or receipt reference',
 payGo:'Record as paid',paid:'Paid',confirmPay:(a:string)=>`Record a payment of ${a}? It cannot be undone from here.`,
 p2:'Trip',p2H:'Created only after the operator confirmed. Monitoring and its timeline start from here.',dep:'Departure time if confirmed (optional)',nt:'Who confirmed and how',tripGo:'Create the trip',trip:'Trip created',
 unpaid:'Note: no payment has been recorded for this request yet.',
 p3:'Your commission from the operator',p3H:'Internal: never shown to the client or the operator. The client pays the operator price; the commission is collected from the operator.',
 basis:'Basis',pct:'Percent of the operator price',fix:'Fixed amount',rate:'Rate %',fixA:'Amount',comGo:'Save commission',expected:'Expected',
 st:{EXPECTED:'Expected',INVOICED:'Invoiced',RECEIVED:'Received',WAIVED:'Waived'} as Record<string,string>,
 inv:'Mark invoiced',rcv:'Mark received',wv:'Waive',cn:'Note (transfer reference or waiver reason)',err:'Could not complete',tripSt:'Trip status',loading:'Loading…'}};

async function call<R=unknown>(fn:string,args:Record<string,unknown>):Promise<R>{const {data,error}=await sb.rpc(fn,args);if(error)throw new Error(error.message);return data as R}
const lines=(s:string)=>s.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,20);
const money=(n:number,c:string)=>`${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)} ${c}`;

export function TermsForm({coId,onState}:{coId:string;onState:(has:boolean)=>void}){
 const {lang}=useI18n();const t=X[lang==='ar'?'ar':'en'];
 const [ver,setVer]=useState<number|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const [inc,setInc]=useState(''),[exc,setExc]=useState(''),[tax,setTax]=useState<''|'1'|'0'>(''),[can,setCan]=useState(''),[pay,setPay]=useState('');
 const load=useCallback(async()=>{
  const {data,error}=await sb.from('offer_terms').select('version,inclusions,exclusions,taxes_included,cancellation_policy,payment_terms').eq('client_offer_id',coId).order('version',{ascending:false}).limit(1);
  if(error){setErr(t.err);return}
  const r=(data??[])[0] as {version:number;inclusions:string[];exclusions:string[];taxes_included:boolean|null;cancellation_policy:string|null;payment_terms:string|null}|undefined;
  if(r){setVer(r.version);setInc((r.inclusions??[]).join('\n'));setExc((r.exclusions??[]).join('\n'));setTax(r.taxes_included===null?'':r.taxes_included?'1':'0');setCan(r.cancellation_policy??'');setPay(r.payment_terms??'');setOpen(false);onState(true)}
  else{setVer(null);setOpen(true);onState(false)}
 },[coId,t.err,onState]);
 useEffect(()=>{load()},[load]);
 const go=async()=>{setErr('');setBusy(true);try{
  await call('staff_set_offer_terms',{p_quote:null,p_client_offer:coId,p_inclusions:lines(inc),p_exclusions:lines(exc),p_taxes_included:tax===''?null:tax==='1',p_cancellation:can.trim(),p_payment_terms:pay.trim()||null});
  await load()}catch(e:any){setErr(e.message||t.err)}finally{setBusy(false)}};
 return <div className="kc-sub"><h4>{t.th}</h4>
  {!open&&ver!==null&&<div className="act"><span className="badge b">{t.rec(ver)}</span><button className="g" onClick={()=>setOpen(true)}>{t.edit}</button></div>}
  {open&&<><p className="kc-h">{t.thH}</p>
   <div className="f2">
    <div className="wide"><label>{t.inc}</label><textarea aria-label={t.inc} rows={3} value={inc} onChange={e=>setInc(e.target.value)}/></div>
    <div className="wide"><label>{t.exc}</label><textarea aria-label={t.exc} rows={3} value={exc} onChange={e=>setExc(e.target.value)}/></div>
    <div><label>{t.tax}</label><select aria-label={t.tax} value={tax} onChange={e=>setTax(e.target.value as ''|'1'|'0')}><option value="">{t.taxU}</option><option value="1">{t.taxY}</option><option value="0">{t.taxN}</option></select></div>
    <div className="wide"><label>{t.can}</label><input aria-label={t.can} value={can} maxLength={1000} onChange={e=>setCan(e.target.value)}/></div>
    <div className="wide"><label>{t.pay}</label><input aria-label={t.pay} value={pay} maxLength={500} onChange={e=>setPay(e.target.value)}/></div></div>
   <div className="act"><button disabled={busy||can.trim().length<5} onClick={go}>{t.save}</button>{ver!==null&&<button className="g" onClick={()=>{setOpen(false);load()}}>×</button>}</div></>}
  {err&&<div className="nt" role="alert"><bdi>{err}</bdi></div>}</div>;
}

type Pay={id:string;amount:number;currency:string;status:string;paid_at:string|null;provider_ref:string|null};
type Trip={id:string;status:string;planned_departure:string|null};
type Com={id:string;basis:string;rate_pct:number|null;currency:string;expected_amount:number;status:string};

export function AfterConfirm({reqId,offer,defaultNote}:{reqId:string;offer:{id:string;client_price:number;currency:string};defaultNote:string}){
 const {lang}=useI18n();const t=X[lang==='ar'?'ar':'en'];
 const [pays,setPays]=useState<Pay[]|null>(null),[trip,setTrip]=useState<Trip|null>(null),[com,setCom]=useState<Com|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const [amt,setAmt]=useState(String(offer.client_price)),[ref,setRef]=useState('');
 const [dep,setDep]=useState(''),[nt,setNt]=useState(defaultNote);
 const [basis,setBasis]=useState<'PERCENT_OF_PRICE'|'FIXED'>('PERCENT_OF_PRICE'),[rate,setRate]=useState(''),[fixA,setFixA]=useState(''),[cn,setCn]=useState('');
 const load=useCallback(async()=>{
  const [a,b,c]=await Promise.all([
   sb.from('payment_sessions').select('id,amount,currency,status,paid_at,provider_ref').eq('client_offer_id',offer.id).order('created_at'),
   sb.from('trips').select('id,status,planned_departure').eq('travel_request_id',reqId).maybeSingle(),
   sb.from('broker_commissions').select('id,basis,rate_pct,currency,expected_amount,status').eq('travel_request_id',reqId).maybeSingle()]);
  if(a.error||b.error||c.error){setErr(t.err);return}
  setPays(a.data as unknown as Pay[]);setTrip(b.data as unknown as Trip|null);setCom(c.data as unknown as Com|null)},[offer.id,reqId,t.err]);
 useEffect(()=>{load()},[load]);
 const run=async(f:()=>Promise<unknown>)=>{setErr('');setBusy(true);try{await f();await load()}catch(e:any){setErr(e.message||t.err)}finally{setBusy(false)}};
 const paid=(pays??[]).find(p=>p.status==='PAID');
 const dt=(s:string)=>new Date(s).toLocaleString(lang==='ar'?'ar-u-nu-latn':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 if(!pays&&!err)return <p className="kc-h">{t.loading}</p>;
 return <div className="kc-p"><h3>{t.ah}</h3><p className="kc-h">{t.ahH}</p>
  {err&&<div className="nt" role="alert"><bdi>{err}</bdi></div>}

  <div className="kc-sub"><h4>1 · {t.p1}</h4>
   {paid?<div className="row"><span><span className="badge b">{t.paid}</span> {paid.provider_ref&&<bdi>{paid.provider_ref}</bdi>}</span><span className="kc-m">{money(paid.amount,paid.currency)}{paid.paid_at?` · ${dt(paid.paid_at)}`:''}</span></div>
   :<><p className="kc-h">{t.p1H}</p>
    <div className="f2"><div><label>{t.amt} ({offer.currency})</label><input aria-label={t.amt} type="number" inputMode="decimal" min="0" value={amt} onChange={e=>setAmt(e.target.value)} dir="ltr"/></div>
     <div className="wide"><label>{t.ref}</label><input aria-label={t.ref} value={ref} maxLength={120} onChange={e=>setRef(e.target.value)}/></div></div>
    <div className="act"><button disabled={busy||!(Number(amt)>0)||ref.trim().length<3} onClick={()=>{if(!window.confirm(t.confirmPay(money(Number(amt),offer.currency))))return;run(()=>call('staff_record_manual_payment',{p_amount:Number(amt),p_currency:offer.currency,p_reference:ref.trim(),p_booking:null,p_client_offer:offer.id}))}}>{t.payGo}</button></div></>}</div>

  <div className="kc-sub"><h4>2 · {t.p2}</h4>
   {trip?<div className="row"><span><span className="badge b">{t.trip}</span> {t.tripSt}: {trip.status}</span><span>{trip.planned_departure?dt(trip.planned_departure):''}</span></div>
   :<><p className="kc-h">{t.p2H}</p>{!paid&&<div className="nt">{t.unpaid}</div>}
    <div className="f2"><div><label>{t.dep}</label><input aria-label={t.dep} type="datetime-local" value={dep} onChange={e=>setDep(e.target.value)} dir="ltr"/></div>
     <div className="wide"><label>{t.nt}</label><input aria-label={t.nt} value={nt} maxLength={300} onChange={e=>setNt(e.target.value)}/></div></div>
    <div className="act"><button disabled={busy||nt.trim().length<5} onClick={()=>run(()=>call('staff_confirm_trip_from_request',{p_request:reqId,p_note:nt.trim(),p_planned_departure:dep?new Date(dep).toISOString():null}))}>{t.tripGo}</button></div></>}</div>

  <div className="kc-sub"><h4>3 · {t.p3}</h4><p className="kc-h">{t.p3H}</p>
   {com&&<div className="row"><span><span className="badge b">{t.st[com.status]??com.status}</span> {com.basis==='PERCENT_OF_PRICE'&&com.rate_pct!==null?`${com.rate_pct}%`:''}</span><span className="kc-m">{t.expected}: {money(com.expected_amount,com.currency)}</span></div>}
   {(!com||com.status==='EXPECTED')&&<>
    <div className="f2"><div><label>{t.basis}</label><select aria-label={t.basis} value={basis} onChange={e=>setBasis(e.target.value as 'PERCENT_OF_PRICE'|'FIXED')}><option value="PERCENT_OF_PRICE">{t.pct}</option><option value="FIXED">{t.fix}</option></select></div>
     {basis==='PERCENT_OF_PRICE'?<div><label>{t.rate}</label><input aria-label={t.rate} type="number" inputMode="decimal" min="0" max="100" step="0.5" value={rate} onChange={e=>setRate(e.target.value)} dir="ltr"/></div>
      :<div><label>{t.fixA} ({offer.currency})</label><input aria-label={t.fixA} type="number" inputMode="decimal" min="0" value={fixA} onChange={e=>setFixA(e.target.value)} dir="ltr"/></div>}</div>
    <div className="act"><button className={com?'g':''} disabled={busy||(basis==='PERCENT_OF_PRICE'?!(Number(rate)>0):!(Number(fixA)>0))}
     onClick={()=>run(()=>call('staff_set_commission',{p_booking:null,p_request:reqId,p_basis:basis,p_rate_pct:basis==='PERCENT_OF_PRICE'?Number(rate):null,p_fixed_amount:basis==='FIXED'?Number(fixA):null,p_fixed_currency:basis==='FIXED'?offer.currency:null,p_note:null}))}>{t.comGo}</button></div></>}
   {com&&(com.status==='EXPECTED'||com.status==='INVOICED')&&<>
    <div className="f2"><div className="wide"><label>{t.cn}</label><input aria-label={t.cn} value={cn} maxLength={300} onChange={e=>setCn(e.target.value)}/></div></div>
    <div className="act">
     {com.status==='EXPECTED'&&<button className="g" disabled={busy} onClick={()=>run(()=>call('staff_set_commission_status',{p_id:com.id,p_new:'INVOICED',p_note:cn.trim()||null}))}>{t.inv}</button>}
     {com.status==='INVOICED'&&<button disabled={busy||cn.trim().length<3} onClick={()=>run(()=>call('staff_set_commission_status',{p_id:com.id,p_new:'RECEIVED',p_note:cn.trim()}))}>{t.rcv}</button>}
     <button className="g" disabled={busy||cn.trim().length<3} onClick={()=>run(()=>call('staff_set_commission_status',{p_id:com.id,p_new:'WAIVED',p_note:cn.trim()}))}>{t.wv}</button></div></>}
  </div></div>;
}

// ما يراه العميل: آخر نسخة من الشروط فقط. الضرائب غير المعروفة تُعرض «غير محدد» ولا تُفترض مشمولة.
type MyTerms={terms_recorded:boolean;inclusions?:string[];exclusions?:string[];taxes_included?:boolean|null;cancellation_policy?:string|null;payment_terms?:string|null};
const V={ar:{h:'شروط العرض',inc:'يشمل',exc:'لا يشمل',tax:'الضرائب',y:'مشمولة',n:'غير مشمولة',u:'غير محدد بعد',can:'سياسة الإلغاء',pay:'شروط الدفع'},
 en:{h:'Offer terms',inc:'Includes',exc:'Excludes',tax:'Taxes',y:'Included',n:'Not included',u:'Not specified yet',can:'Cancellation policy',pay:'Payment terms'}};
export function TermsView({coId}:{coId:string}){
 const {lang}=useI18n();const t=V[lang==='ar'?'ar':'en'];
 const [d,setD]=useState<MyTerms|null>(null);
 useEffect(()=>{let live=true;sb.rpc('get_my_offer_terms',{p_quote:null,p_client_offer:coId}).then(({data,error})=>{if(live&&!error)setD(data as MyTerms)});return()=>{live=false}},[coId]);
 if(!d||!d.terms_recorded)return null;
 return <div className="dim sm" style={{textAlign:'start',marginTop:10}}><b>{t.h}</b>
  {!!d.inclusions?.length&&<p style={{margin:'4px 0'}}>{t.inc}: <bdi>{d.inclusions.join('، ')}</bdi></p>}
  {!!d.exclusions?.length&&<p style={{margin:'4px 0'}}>{t.exc}: <bdi>{d.exclusions.join('، ')}</bdi></p>}
  <p style={{margin:'4px 0'}}>{t.tax}: {d.taxes_included===null||d.taxes_included===undefined?t.u:d.taxes_included?t.y:t.n}</p>
  {d.cancellation_policy&&<p style={{margin:'4px 0'}}>{t.can}: <bdi>{d.cancellation_policy}</bdi></p>}
  {d.payment_terms&&<p style={{margin:'4px 0'}}>{t.pay}: <bdi>{d.payment_terms}</bdi></p>}</div>;
}
