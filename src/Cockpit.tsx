import {useCallback,useEffect,useMemo,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n,airportName} from './i18n';
import Route from './Route';
import HoldRing from './Hold';
import type {Airport} from './data/types';
import './cockpit.css';

// غرفة الوسيط: طلب واحد في كل مرة، وخيط يوضّح أين وصل الطلب وما المطلوب منك الآن.
// كل قرار يخرج من هنا يمرّ بدالة في القاعدة تتحقق من الصلاحية والحالة. لا شيء يُرسَل إلى أحد تلقائيًا:
// المراسلة والتأكيد مع المشغّل يتمّان بيدك، والنظام يسجّلهما فقط.
type Req={id:string;customer_id:string;raw_text:string|null;origin_code:string|null;destination_code:string|null;travel_date:string|null;departure_period:string|null;passengers:number|null;baggage_note:string|null;return_requested:boolean|null;status:string;missing_fields:string[]|null;loop_status:string;loop_status_reason:string|null;created_at:string};
type Rfq={id:string;operator_name:string;operator_contact:string|null;contact_channel:string;status:string;contacted_at:string;responded_at:string|null;decline_reason:string|null;link_expires_at:string|null;link_first_opened_at:string|null};
type Off={id:string;rfq_id:string;aircraft_type:string;operator_total_price:number;currency:string;includes_fees:boolean;flight_time_minutes:number|null;restrictions:string|null;valid_until:string};
type Co={id:string;rfq_offer_id:string;client_price:number;currency:string;cabin_label:string;client_note:string|null;fees_note:string|null;status:string;valid_until:string;decision_reason:string|null};
type Ap={seq:number;gate:number;decision:string;note:string|null;scope:{operators?:string[]}|null;target_id:string|null;decided_at:string};
type Detail={rfqs:Rfq[];offs:Off[];cos:Co[];appr:Ap[]};
type Turn='me'|'op'|'cl'|'done';

const T={
ar:{h:'غرفة الوسيط',lead:'لا شيء يخرج من هنا تلقائيًا: كل مراسلة وكل تأكيد بيدك، والنظام يسجّل ويتحقق.',none:'لا طلبات بعد. أول طلب يرسله عميل يظهر هنا.',
 wait:(n:number)=>n?`${n} ينتظر قرارك`:'لا شيء ينتظر قرارك الآن',turn:{me:'بانتظارك',op:'بانتظار المشغّل',cl:'بانتظار العميل',done:'مغلق'},
 client:'عميل',unknownRoute:'طلب ناقص',stages:['الطلب','المشغّلون','الردود','عرض العميل','قرار العميل','التأكيد'],gate:'بوابة',
 per:{morning:'صباحًا',noon:'ظهرًا',evening:'مساءً',night:'ليلًا'} as Record<string,string>,pax:'ركاب',ret:'مع عودة',bag:'الأمتعة',said:'نص الطلب',nodate:'بلا تاريخ',
 miss:'ينقص في الطلب',mf:{origin_code:'المغادرة',destination_code:'الوصول',travel_date:'التاريخ',passengers:'عدد الركاب'} as Record<string,string>,
 begin:'ابدأ البحث',beginH:'يفتح الطلب للتواصل مع المشغّلين. لا يخرج شيء قبل أن تقرّ من تراسل.',
 g1:'من تراسل؟',g1h:'اكتب من مشغّل إلى خمسة تسمح بمراسلتهم بشأن هذا الطلب. لا يرسل النظام شيئًا، والمراسلة بيدك.',g1ph:'اسم المشغّل',add:'أضف',g1note:'ملاحظة (اختياري)',g1hold:'اضغط مطوّلًا لإقرار المشغّلين',g1more:'أضف مشغّلًا آخر',g1empty:'أضف مشغّلًا واحدًا على الأقل',
 ct:'سجّل المراسلة',cth:'راسل المشغّل بنفسك ثم سجّل القناة، فيبدأ انتظار الرد.',how:'القناة',who:'هاتف أو بريد (اختياري)',csave:'سجّلت المراسلة',ch:{phone:'هاتف',whatsapp:'واتساب',email:'بريد',platform:'المنصّة',other:'أخرى'} as Record<string,string>,
 rfq:'المشغّلون والردود',rs:{AWAITING:'بانتظار الرد',OFFER:'ردّ بعرض',DECLINED:'اعتذر',NO_RESPONSE:'لم يرد'} as Record<string,string>,
 lnk:'رابط الرد',lnk2:'رابط جديد (يلغي السابق)',hrs:'صلاحية',copy:'نسخ',copied:'تم النسخ',mail:'مسودة بريد',once:'يظهر الرابط الآن فقط. أرسله بنفسك.',opened:'فُتح الرابط',notOpened:'لم يُفتح بعد',exp:'ينتهي',
 mailS:'طلب عرض لرحلة',mailB:(r:string,u:string)=>`مرحبًا،\n\nلدينا طلب رحلة ${r}. التفاصيل والرد (عرض أو اعتذار) من هذا الرابط الخاص بك، بلا حاجة إلى حساب:\n${u}\n\nشكرًا لكم.`,
 rp:'سجّل ردًّا وصلك خارج المنصّة',av:'متاحة',na:'غير متاحة',ac:'نوع الطائرة',pr:'السعر الكلي من المشغّل',cur:'العملة',fees:'السعر يشمل الرسوم؟',y:'نعم',n:'لا',vh:'صلاحية العرض (ساعات)',ft:'مدة الطيران بالدقائق (اختياري)',rs2:'قيود (اختياري)',why:'السبب (اختياري)',rsave:'سجّل الرد',nor:'لم يرد',
 got:'ما وصل من المشغّلين',inn:'داخلي: لا يراه العميل ولا مشغّل آخر.',inc:'شامل الرسوم',exc:'الرسوم غير مشمولة',till:'صالح حتى',fmin:'دقيقة طيران',prep:'جهّز عرض العميل',
 pt:'عرض العميل',cp:'السعر للعميل',cab:'الطائرة أو الفئة كما يراها العميل',cabH:'لا تذكر اسم المشغّل.',cn:'ملاحظة للعميل (اختياري)',fn:'ملاحظة الرسوم (مطلوبة إن لم يشملها المشغّل)',mg:'هامشك',min:'لا يقل عن',psave:'احفظ المسودة',
 co:{DRAFT:'مسودة',APPROVED:'مُقرّ',PRESENTED:'عند العميل',ACCEPTED:'قبله العميل',REJECTED:'رفضه العميل',WITHDRAWN:'سُحب',EXPIRED:'انتهى'} as Record<string,string>,
 g2:'ما ستقرّه هو ما سيراه العميل',g2h:'راجع السعر والوصف والرسوم. أي تعديل بعد الإقرار يُسقط الإقرار.',g2hold:'اضغط مطوّلًا لإقرار العرض',edit:'عدّل',rej:'ارفض المسودة',rejW:'سبب الرفض',rejGo:'ارفض',present:'اعرضه على العميل',presentH:'يظهر العرض في غرفة العميل فقط. لا يُرسل بريد ولا رسالة.',cancel:'تراجع',
 atc:'العرض عند العميل. ننتظر قراره.',valid:'مهلة العرض',expired:'انتهت مهلة العرض',reopen:'أعد البحث',reopenW:'أعد فتح البحث عن مشغّل',
 g3:'العميل سجّل نية حجز',g3h:'هذه ليست حجزًا. أقرّ لتبدأ بتأكيد الطائرة والسعر مع المشغّل.',g3hold:'اضغط مطوّلًا للإقرار',g3note:'ملاحظة (اختياري)',
 cf:'سجّل تأكيد المشغّل',cfh:'سجّل هنا بعد أن يؤكد المشغّل الطائرة والسعر فعليًا: من أكّد وبأي وسيلة.',cfph:'مثال: أكّد المشغّل هاتفيًا الساعة 14:30',cfs:'سجّل التأكيد النهائي',cff:'لم يؤكد المشغّل، أعد البحث',
 more:'خيارات أخرى',close:'أغلق: لا خيار متاح',cancelReq:'ألغِ الطلب',reason:'السبب',go:'نفّذ',
 fin:{CONFIRMED:'تأكدت الرحلة',CLIENT_DECLINED:'رفض العميل العرض',CLOSED_NO_SUPPLY:'أُغلق: لا خيار متاح',CLOSED_NO_OPERATOR_REPLY:'أُغلق: لم يرد مشغّل',CLOSED_NO_CLIENT_REPLY:'أُغلق: لم يرد العميل',CANCELLED:'أُلغي الطلب'} as Record<string,string>,
 log:'سجل القرارات',dec:{APPROVED:'أُقرّ',CHANGES_REQUESTED:'طُلب تعديل',REJECTED:'رُفض'} as Record<string,string>,loading:'جارٍ التحميل…',err:'تعذّر التنفيذ'},
en:{h:'Broker room',lead:'Nothing leaves from here automatically: every message and confirmation is yours. The system records and checks.',none:'No requests yet. The first request a client sends appears here.',
 wait:(n:number)=>n?`${n} waiting for you`:'Nothing is waiting for you',turn:{me:'Your move',op:'Waiting on operator',cl:'Waiting on client',done:'Closed'},
 client:'Client',unknownRoute:'Incomplete request',stages:['Request','Operators','Replies','Client offer','Client decision','Confirmation'],gate:'Gate',
 per:{morning:'morning',noon:'midday',evening:'evening',night:'night'} as Record<string,string>,pax:'passengers',ret:'return trip',bag:'Baggage',said:'Request text',nodate:'No date',
 miss:'Missing from the request',mf:{origin_code:'Departure',destination_code:'Arrival',travel_date:'Date',passengers:'Passengers'} as Record<string,string>,
 begin:'Start the search',beginH:'Opens the request for operator contact. Nothing goes out until you approve who to contact.',
 g1:'Who do you contact?',g1h:'Enter one to five operators you allow to be contacted about this request. The system sends nothing; contact is yours.',g1ph:'Operator name',add:'Add',g1note:'Note (optional)',g1hold:'Press and hold to approve the operators',g1more:'Add another operator',g1empty:'Add at least one operator',
 ct:'Record the contact',cth:'Contact the operator yourself, then record the channel. The wait for a reply starts.',how:'Channel',who:'Phone or email (optional)',csave:'I contacted them',ch:{phone:'Phone',whatsapp:'WhatsApp',email:'Email',platform:'Platform',other:'Other'} as Record<string,string>,
 rfq:'Operators and replies',rs:{AWAITING:'Awaiting reply',OFFER:'Replied with an offer',DECLINED:'Declined',NO_RESPONSE:'No reply'} as Record<string,string>,
 lnk:'Reply link',lnk2:'New link (revokes the old one)',hrs:'Lifetime',copy:'Copy',copied:'Copied',mail:'Email draft',once:'The link is shown only now. Send it yourself.',opened:'Link opened',notOpened:'Not opened yet',exp:'Expires',
 mailS:'Quote request',mailB:(r:string,u:string)=>`Hello,\n\nWe have a trip request ${r}. Details and your reply (offer or decline) are at your private link, no account needed:\n${u}\n\nThank you.`,
 rp:'Record a reply received outside the platform',av:'Available',na:'Not available',ac:'Aircraft type',pr:'Operator total price',cur:'Currency',fees:'Price includes fees?',y:'Yes',n:'No',vh:'Offer valid for (hours)',ft:'Flight time in minutes (optional)',rs2:'Restrictions (optional)',why:'Reason (optional)',rsave:'Record reply',nor:'No reply',
 got:'What came back',inn:'Internal: never shown to the client or another operator.',inc:'Fees included',exc:'Fees not included',till:'Valid until',fmin:'min flight',prep:'Prepare client offer',
 pt:'Client offer',cp:'Price to the client',cab:'Aircraft or class as the client sees it',cabH:'Do not name the operator.',cn:'Note to the client (optional)',fn:'Fees note (required if the operator excludes fees)',mg:'Your margin',min:'At least',psave:'Save draft',
 co:{DRAFT:'Draft',APPROVED:'Approved',PRESENTED:'With the client',ACCEPTED:'Accepted',REJECTED:'Declined by client',WITHDRAWN:'Withdrawn',EXPIRED:'Expired'} as Record<string,string>,
 g2:'What you approve is exactly what the client sees',g2h:'Check price, description and fees. Any edit after approval voids the approval.',g2hold:'Press and hold to approve the offer',edit:'Edit',rej:'Reject draft',rejW:'Reason for rejecting',rejGo:'Reject',present:'Show it to the client',presentH:'The offer appears in the client\'s room only. No email, no message is sent.',cancel:'Back',
 atc:'The offer is with the client. Waiting for their decision.',valid:'Offer valid until',expired:'The offer expired',reopen:'Search again',reopenW:'Reopen the search',
 g3:'The client registered booking intent',g3h:'This is not a booking. Approve to start confirming aircraft and price with the operator.',g3hold:'Press and hold to approve',g3note:'Note (optional)',
 cf:'Record the operator\'s confirmation',cfh:'Record only after the operator has actually confirmed aircraft and price: who confirmed and how.',cfph:'Example: operator confirmed by phone at 14:30',cfs:'Record final confirmation',cff:'Operator did not confirm, search again',
 more:'Other options',close:'Close: no option available',cancelReq:'Cancel the request',reason:'Reason',go:'Do it',
 fin:{CONFIRMED:'Trip confirmed',CLIENT_DECLINED:'Client declined the offer',CLOSED_NO_SUPPLY:'Closed: nothing available',CLOSED_NO_OPERATOR_REPLY:'Closed: no operator replied',CLOSED_NO_CLIENT_REPLY:'Closed: client did not reply',CANCELLED:'Request cancelled'} as Record<string,string>,
 log:'Decision log',dec:{APPROVED:'Approved',CHANGES_REQUESTED:'Changes requested',REJECTED:'Rejected'} as Record<string,string>,loading:'Loading…',err:'Could not complete'}};
type Tx=typeof T.ar;

const STAGE:Record<string,number>={NEW_REQUEST:0,SEARCHING:1,OPERATOR_CONTACTED:2,AWAITING_OFFER:2,OFFER_RECEIVED:3,BROKER_REVIEW:3,PRESENTED:4,OFFER_EXPIRED:4,ACCEPTED:5,AWAITING_BOOKING:5,CONFIRMED:6};
const GATE_AT:Record<number,number>={1:1,3:2,5:3};// موضع البوابة في الخيط → رقمها
const turnOf=(r:Req):Turn=>{const s=r.loop_status;
 if(s==='NEW_REQUEST')return r.status==='READY'?'me':'cl';
 if(['SEARCHING','OFFER_RECEIVED','BROKER_REVIEW','ACCEPTED','AWAITING_BOOKING','OFFER_EXPIRED'].includes(s))return 'me';
 if(s==='OPERATOR_CONTACTED'||s==='AWAITING_OFFER')return 'op';
 if(s==='PRESENTED')return 'cl';return 'done'};
const money=(n:number,c:string)=>`${new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n)} ${c}`;
const lk=(s:string)=>s.trim().toLowerCase();

async function call<R=unknown>(fn:string,args?:Record<string,unknown>):Promise<R>{const {data,error}=await sb.rpc(fn,args);if(error)throw new Error(error.message);return data as R}

function Approve({label,onDone}:{label:string;onDone:()=>Promise<void>}){
 // الحلقة لا تعيد نفسها بعد اكتمالها، فنغيّر مفتاحها بعد كل محاولة حتى لا يُحبَس الوسيط بعد خطأ
 const [k,setK]=useState(0);
 return <div className="act"><HoldRing key={k} onDone={()=>{onDone().finally(()=>setK(x=>x+1))}}/><span className="mono">{label}</span></div>;
}

function Rail({stage,gates,t}:{stage:number;gates:Set<number>;t:Tx}){
 return <ol className="kc-rail" aria-label={t.h}>{t.stages.map((s,i)=>{const g=GATE_AT[i];const st=i<stage?'done':i===stage?'cur':'';
  return <li key={s} className={st} aria-current={i===stage?'step':undefined}><span className={`kc-n${g?' g':''}${g&&gates.has(g)?' ok':''}`}>{g??''}</span><span className="kc-l">{s}</span></li>})}</ol>;
}

function Gate1({req,t,done,onErr,first}:{req:Req;t:Tx;done:()=>void;onErr:(m:string)=>void;first:boolean}){
 const [ops,setOps]=useState<string[]>([]),[v,setV]=useState(''),[note,setNote]=useState('');
 const add=()=>{const x=v.trim();if(x.length<2||x.length>120||ops.length>=5||ops.some(o=>lk(o)===lk(x)))return;setOps([...ops,x]);setV('')};
 const go=async()=>{if(!ops.length){onErr(t.g1empty);return}
  try{await call('loop_approve_gate',{p_request:req.id,p_gate:1,p_decision:'APPROVED',p_note:note.trim()||null,p_operators:ops,p_client_offer:null});setOps([]);setNote('');done()}catch(e:any){onErr(e.message)}};
 return <div className={first?'kc-p':'kc-p q'}><h3>{t.g1}</h3><p className="kc-h">{t.g1h}</p>
  <div className="kc-chips">{ops.map(o=><button key={o} className="g kc-chip" onClick={()=>setOps(ops.filter(x=>x!==o))} aria-label={o}><bdi>{o}</bdi> ×</button>)}</div>
  <div className="act"><input aria-label={t.g1ph} placeholder={t.g1ph} value={v} maxLength={120} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}}/><button className="g" onClick={add} disabled={ops.length>=5}>{t.add}</button></div>
  <div className="act"><input aria-label={t.g1note} placeholder={t.g1note} value={note} maxLength={500} onChange={e=>setNote(e.target.value)}/></div>
  <Approve label={t.g1hold} onDone={go}/></div>;
}

function Contact({req,name,t,done,onErr}:{req:Req;name:string;t:Tx;done:()=>void;onErr:(m:string)=>void}){
 const [ch,setCh]=useState('phone'),[c,setC]=useState(''),[busy,setBusy]=useState(false);
 const go=async()=>{setBusy(true);try{await call('loop_record_contact',{p_request:req.id,p_operator_name:name,p_contact:c.trim()||null,p_channel:ch});done()}catch(e:any){onErr(e.message)}finally{setBusy(false)}};
 return <div className="kc-p"><h3>{t.ct}: <bdi className="kc-op">{name}</bdi></h3><p className="kc-h">{t.cth}</p>
  <div className="f2"><div><label>{t.how}</label><select aria-label={t.how} value={ch} onChange={e=>setCh(e.target.value)}>{Object.keys(t.ch).map(k=><option key={k} value={k}>{t.ch[k]}</option>)}</select></div>
   <div><label>{t.who}</label><input aria-label={t.who} value={c} maxLength={200} onChange={e=>setC(e.target.value)}/></div></div>
  <div className="act"><button disabled={busy} onClick={go}>{t.csave}</button></div></div>;
}

function ReplyForm({rfq,t,done,onErr}:{rfq:Rfq;t:Tx;done:()=>void;onErr:(m:string)=>void}){
 const [open,setOpen]=useState(false),[av,setAv]=useState(true),[ac,setAc]=useState(''),[pr,setPr]=useState(''),[cur,setCur]=useState('USD'),[fees,setFees]=useState(true),[vh,setVh]=useState('24'),[ft,setFt]=useState(''),[rs,setRs]=useState(''),[why,setWhy]=useState(''),[busy,setBusy]=useState(false);
 const go=async()=>{setBusy(true);try{
  await call('loop_record_reply',av?{p_rfq:rfq.id,p_available:true,p_aircraft_type:ac.trim(),p_price:Number(pr),p_currency:cur,p_includes_fees:fees,p_valid_until:new Date(Date.now()+Number(vh)*36e5).toISOString(),p_flight_minutes:ft?Number(ft):null,p_restrictions:rs.trim()||null,p_reason:null}
   :{p_rfq:rfq.id,p_available:false,p_reason:why.trim()||null});setOpen(false);done()}catch(e:any){onErr(e.message)}finally{setBusy(false)}};
 const none=async()=>{setBusy(true);try{await call('loop_mark_no_response',{p_rfq:rfq.id});done()}catch(e:any){onErr(e.message)}finally{setBusy(false)}};
 if(!open)return <div className="act"><button className="g" onClick={()=>setOpen(true)}>{t.rp}</button><button className="g" disabled={busy} onClick={none}>{t.nor}</button></div>;
 return <div className="kc-sub"><h4>{t.rp}</h4>
  <div className="kc-yn" role="group"><button className={av?'':'g'} onClick={()=>setAv(true)}>{t.av}</button><button className={av?'g':''} onClick={()=>setAv(false)}>{t.na}</button></div>
  {av?<div className="f2">
   <div><label>{t.ac}</label><input aria-label={t.ac} value={ac} maxLength={80} onChange={e=>setAc(e.target.value)}/></div>
   <div><label>{t.pr}</label><input aria-label={t.pr} type="number" inputMode="decimal" min="1" value={pr} onChange={e=>setPr(e.target.value)} dir="ltr"/></div>
   <div><label>{t.cur}</label><select aria-label={t.cur} value={cur} onChange={e=>setCur(e.target.value)}>{['USD','SAR','AED'].map(c=><option key={c}>{c}</option>)}</select></div>
   <div><label>{t.fees}</label><select aria-label={t.fees} value={fees?'1':'0'} onChange={e=>setFees(e.target.value==='1')}><option value="1">{t.y}</option><option value="0">{t.n}</option></select></div>
   <div><label>{t.vh}</label><input aria-label={t.vh} type="number" min="1" max="168" value={vh} onChange={e=>setVh(e.target.value)} dir="ltr"/></div>
   <div><label>{t.ft}</label><input aria-label={t.ft} type="number" min="10" max="1200" value={ft} onChange={e=>setFt(e.target.value)} dir="ltr"/></div>
   <div className="wide"><label>{t.rs2}</label><input aria-label={t.rs2} value={rs} maxLength={500} onChange={e=>setRs(e.target.value)}/></div></div>
  :<div className="f2"><div className="wide"><label>{t.why}</label><input aria-label={t.why} value={why} maxLength={300} onChange={e=>setWhy(e.target.value)}/></div></div>}
  <div className="act"><button disabled={busy||(av&&(ac.trim().length<2||!(Number(pr)>0)))} onClick={go}>{t.rsave}</button><button className="g" onClick={()=>setOpen(false)}>{t.cancel}</button></div></div>;
}

function LinkIssue({rfq,route,t,done,onErr}:{rfq:Rfq;route:string;t:Tx;done:()=>void;onErr:(m:string)=>void}){
 const [h,setH]=useState('48'),[url,setUrl]=useState(''),[copied,setCopied]=useState(false),[busy,setBusy]=useState(false);
 const issue=async()=>{setBusy(true);setCopied(false);try{const tok=await call<string>('loop_issue_operator_link',{p_rfq:rfq.id,p_ttl_hours:Number(h)});setUrl(`${location.origin}/?view=operator#t=${tok}`);done()}catch(e:any){onErr(e.message)}finally{setBusy(false)}};
 return <div className="kc-sub"><div className="act"><label className="mono">{t.hrs}<select value={h} onChange={e=>setH(e.target.value)} style={{marginInlineStart:10}}>{[6,24,48,72,168].map(x=><option key={x} value={x}>{x}h</option>)}</select></label>
   <button className={rfq.link_expires_at?'g':''} disabled={busy} onClick={issue}>{rfq.link_expires_at?t.lnk2:t.lnk}</button></div>
  {url&&<div className="nt e"><p dir="ltr" style={{wordBreak:'break-all',fontSize:13}}>{url}</p>
   <div className="act"><button onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{/* النسخ غير متاح */}}}>{copied?t.copied:t.copy}</button>
    <a className="mono" href={`mailto:${encodeURIComponent(rfq.operator_contact&&rfq.operator_contact.includes('@')?rfq.operator_contact:'')}?subject=${encodeURIComponent(t.mailS)}&body=${encodeURIComponent(t.mailB(route,url))}`}>{t.mail}</a></div><small>{t.once}</small></div>}</div>;
}

function Prep({off,cur,t,done,onErr,onClose}:{off:Off;cur?:Co;t:Tx;done:()=>void;onErr:(m:string)=>void;onClose:()=>void}){
 const [p,setP]=useState(cur?String(cur.client_price):''),[cab,setCab]=useState(cur?.cabin_label??''),[cn,setCn]=useState(cur?.client_note??''),[fn,setFn]=useState(cur?.fees_note??''),[busy,setBusy]=useState(false);
 const mg=Number(p)-off.operator_total_price,pct=off.operator_total_price?mg/off.operator_total_price*100:0;
 const go=async()=>{setBusy(true);try{
  if(cur)await call('loop_revise_client_offer',{p_client_offer:cur.id,p_client_price:Number(p),p_cabin_label:cab.trim(),p_client_note:cn.trim()||null,p_fees_note:fn.trim()||null});
  else await call('loop_prepare_client_offer',{p_rfq_offer:off.id,p_client_price:Number(p),p_cabin_label:cab.trim(),p_client_note:cn.trim()||null,p_fees_note:fn.trim()||null});
  onClose();done()}catch(e:any){onErr(e.message)}finally{setBusy(false)}};
 return <div className="kc-sub"><h4>{t.pt}</h4>
  <div className="f2"><div><label>{t.cp} ({off.currency}) · {t.min} {money(off.operator_total_price,off.currency)}</label><input aria-label={t.cp} type="number" inputMode="decimal" min={off.operator_total_price} value={p} onChange={e=>setP(e.target.value)} dir="ltr"/></div>
   <div><label>{t.cab}</label><input aria-label={t.cab} value={cab} maxLength={80} onChange={e=>setCab(e.target.value)}/><small className="kc-h">{t.cabH}</small></div>
   <div className="wide"><label>{t.cn}</label><input aria-label={t.cn} value={cn} maxLength={500} onChange={e=>setCn(e.target.value)}/></div>
   <div className="wide"><label>{t.fn}</label><input aria-label={t.fn} value={fn} maxLength={300} onChange={e=>setFn(e.target.value)}/></div></div>
  {Number(p)>0&&<p className="kc-mg"><span className="badge b">{t.inn.split(':')[0]}</span> {t.mg}: <b dir="ltr">{money(mg,off.currency)} · {pct.toFixed(1)}%</b></p>}
  <div className="act"><button disabled={busy||!(Number(p)>=off.operator_total_price)||cab.trim().length<2} onClick={go}>{t.psave}</button><button className="g" onClick={onClose}>{t.cancel}</button></div></div>;
}

function Thread({req,t,lang,nm,reload,onList}:{req:Req;t:Tx;lang:string;nm:(c:string|null)=>string;reload:()=>void;onList:()=>void}){
 const [d,setD]=useState<Detail|null>(null),[err,setErr]=useState(''),[prepOff,setPrepOff]=useState(''),[addOp,setAddOp]=useState(false),[rejId,setRejId]=useState(''),[rejW,setRejW]=useState(''),[note,setNote]=useState(''),[cf,setCf]=useState('');
 const [xo,setXo]=useState<''|'close'|'cancel'|'reopen'>(''),[xw,setXw]=useState('');
 const loc=lang==='ar'?'ar-u-nu-latn':'en-GB';
 const dt=(s:string)=>new Date(s).toLocaleString(loc,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const load=useCallback(async()=>{
  const [a,b,c,e]=await Promise.all([
   sb.from('operator_rfqs').select('id,operator_name,operator_contact,contact_channel,status,contacted_at,responded_at,decline_reason,link_expires_at,link_first_opened_at').eq('travel_request_id',req.id).order('contacted_at'),
   sb.from('rfq_offers').select('id,rfq_id,aircraft_type,operator_total_price,currency,includes_fees,flight_time_minutes,restrictions,valid_until').eq('travel_request_id',req.id).order('received_at',{ascending:false}),
   sb.from('client_offers').select('id,rfq_offer_id,client_price,currency,cabin_label,client_note,fees_note,status,valid_until,decision_reason').eq('travel_request_id',req.id).order('created_at',{ascending:false}),
   sb.from('request_approvals').select('seq,gate,decision,note,scope,target_id,decided_at').eq('travel_request_id',req.id).order('seq')]);
  if(a.error||b.error||c.error||e.error){setErr(t.err);return}
  setD({rfqs:a.data as Rfq[],offs:b.data as unknown as Off[],cos:c.data as unknown as Co[],appr:e.data as unknown as Ap[]})},[req.id,req.loop_status,t.err]);
 useEffect(()=>{setD(null);setErr('');setPrepOff('');setAddOp(false);setRejId('');setXo('');load()},[load]);
 const after=()=>{setErr('');reload();load()};
 const fail=(m:string)=>setErr(m||t.err);
 const act=async(f:()=>Promise<unknown>)=>{setErr('');try{await f();after()}catch(e:any){fail(e.message)}};

 const approved=useMemo(()=>{const m=new Map<string,{name:string;ok:boolean}>();for(const a of d?.appr??[])if(a.gate===1)for(const n of a.scope?.operators??[])m.set(lk(n),{name:n,ok:a.decision==='APPROVED'});return [...m.values()].filter(x=>x.ok).map(x=>x.name)},[d]);
 const toContact=approved.filter(n=>!(d?.rfqs??[]).some(r=>lk(r.operator_name)===lk(n)));
 const gates=useMemo(()=>{const s=new Set<number>();for(const a of d?.appr??[])if(a.decision==='APPROVED')s.add(a.gate);return s},[d]);
 const rfqName=(id:string)=>d?.rfqs.find(r=>r.id===id)?.operator_name??'';
 const route=`${req.origin_code??'?'} → ${req.destination_code??'?'}${req.travel_date?' · '+req.travel_date:''}`;
 const s=req.loop_status,stage=STAGE[s]??-1,fin=stage<0,turn=turnOf(req);
 const live=(d?.cos??[]).filter(c=>['DRAFT','APPROVED','PRESENTED'].includes(c.status));
 const shown=(d?.cos??[]).find(c=>c.status==='PRESENTED'||c.status==='ACCEPTED')??null;

 const Head=<div className="kc-req"><div className="kc-rt"><Route from={nm(req.origin_code)} to={nm(req.destination_code)}/></div>
  <p className="kc-meta">{req.travel_date??t.nodate}{req.departure_period?` · ${t.per[req.departure_period]??''}`:''} · {req.passengers??'?'} {t.pax}{req.return_requested?` · ${t.ret}`:''}</p>
  {req.baggage_note&&<p className="kc-meta">{t.bag}: <bdi>{req.baggage_note}</bdi></p>}
  {req.raw_text&&<p className="kc-meta">{t.said}: <bdi>{req.raw_text}</bdi></p>}</div>;

 const Other=!fin&&s!=='CONFIRMED'&&<details className="kc-more"><summary className="mono">{t.more}</summary>
  <div className="act">{['SEARCHING','AWAITING_OFFER','BROKER_REVIEW'].includes(s)&&<button className="g" onClick={()=>setXo('close')}>{t.close}</button>}<button className="g" onClick={()=>setXo('cancel')}>{t.cancelReq}</button></div>
  {xo&&xo!=='reopen'&&<div className="act"><input aria-label={t.reason} placeholder={t.reason} value={xw} onChange={e=>setXw(e.target.value)}/><button disabled={xo==='close'&&xw.trim().length<3} onClick={()=>act(async()=>{if(xo==='close')await call('loop_set_status',{p_request:req.id,p_new:'CLOSED_NO_SUPPLY',p_reason:xw.trim()});else await call('cancel_travel_request',{p_id:req.id});setXo('');setXw('')})}>{t.go}</button></div>}</details>;

 return <section className="kc-thread" aria-live="polite">
  <button className="g kc-back" onClick={onList}>{t.h}</button>
  {Head}
  {!fin&&<Rail stage={stage} gates={gates} t={t}/>}
  {fin&&<div className="nt e"><b>{t.fin[s]??s}</b>{req.loop_status_reason&&<> · <bdi>{req.loop_status_reason}</bdi></>}</div>}
  {err&&<div className="nt" role="alert"><bdi>{err}</bdi></div>}
  {!d&&!err&&<p className="kc-h">{t.loading}</p>}
  {d&&<>
   {s==='NEW_REQUEST'&&(req.status==='READY'
     ?<div className="kc-p"><p className="kc-h">{t.beginH}</p><div className="act"><button onClick={()=>act(()=>call('loop_begin_search',{p_request:req.id}))}>{t.begin}</button></div></div>
     :<div className="nt">{t.miss}: {(req.missing_fields??[]).map(f=>t.mf[f]??f).join('، ')}</div>)}

   {(s==='SEARCHING'||s==='AWAITING_OFFER'||s==='OPERATOR_CONTACTED')&&<>
    {toContact.map(n=><Contact key={n} req={req} name={n} t={t} done={after} onErr={fail}/>)}
    {s==='SEARCHING'&&!toContact.length&&<Gate1 req={req} t={t} done={after} onErr={fail} first/>}
    {s!=='SEARCHING'&&<>
     {d.rfqs.length>0&&<div className="kc-p q"><h3>{t.rfq}</h3>{d.rfqs.map(r=><div className="kc-rf" key={r.id}>
       <div className="row"><span><bdi className="kc-op">{r.operator_name}</bdi> · {t.ch[r.contact_channel]??r.contact_channel}</span><span>{t.rs[r.status]??r.status}</span></div>
       {r.status==='AWAITING'&&<>
        <div className="row"><span>{r.link_first_opened_at?t.opened:r.link_expires_at?t.notOpened:''}</span><span>{r.link_expires_at?`${t.exp} ${dt(r.link_expires_at)}`:''}</span></div>
        <LinkIssue rfq={r} route={route} t={t} done={after} onErr={fail}/><ReplyForm rfq={r} t={t} done={after} onErr={fail}/></>}
       {r.status==='DECLINED'&&r.decline_reason&&<small className="kc-h"><bdi>{r.decline_reason}</bdi></small>}</div>)}</div>}
     {!toContact.length&&(addOp?<Gate1 req={req} t={t} done={()=>{setAddOp(false);after()}} onErr={fail} first={false}/>:<div className="act"><button className="g" onClick={()=>setAddOp(true)}>{t.g1more}</button></div>)}</>}
   </>}

   {(s==='OFFER_RECEIVED'||s==='BROKER_REVIEW')&&<div className="kc-p"><h3>{t.got}</h3><p className="kc-h">{t.inn}</p>
    {d.offs.map(o=>{const co=live.find(c=>c.rfq_offer_id===o.id);const expired=Date.parse(o.valid_until)<Date.now();
     return <div className="kc-off" key={o.id}>
      <div className="row"><span><bdi className="kc-op">{rfqName(o.rfq_id)}</bdi> · <bdi>{o.aircraft_type}</bdi></span><span className="kc-m">{money(o.operator_total_price,o.currency)}</span></div>
      <div className="row"><span>{o.includes_fees?t.inc:t.exc}{o.flight_time_minutes?` · ${o.flight_time_minutes} ${t.fmin}`:''}</span><span>{t.till} {dt(o.valid_until)}</span></div>
      {o.restrictions&&<small className="kc-h"><bdi>{o.restrictions}</bdi></small>}
      {!co&&!expired&&prepOff!==o.id&&<div className="act"><button className="g" onClick={()=>setPrepOff(o.id)}>{t.prep}</button></div>}
      {!co&&prepOff===o.id&&<Prep off={o} t={t} done={after} onErr={fail} onClose={()=>setPrepOff('')}/>}
      {co&&<div className="kc-co">
       <div className="row"><span><b><bdi>{co.cabin_label}</bdi></b> · {t.co[co.status]??co.status}</span><span className="kc-m">{money(co.client_price,co.currency)}</span></div>
       <p className="kc-mg"><span className="badge b">{t.inn.split(':')[0]}</span> {t.mg}: <b dir="ltr">{money(co.client_price-o.operator_total_price,co.currency)}</b></p>
       {co.client_note&&<small className="kc-h"><bdi>{co.client_note}</bdi></small>}{co.fees_note&&<small className="kc-h"><bdi>{co.fees_note}</bdi></small>}
       {prepOff===co.id?<Prep off={o} cur={co} t={t} done={after} onErr={fail} onClose={()=>setPrepOff('')}/>:<>
        {co.status==='DRAFT'&&<><p className="kc-h"><b>{t.g2}.</b> {t.g2h}</p>
         <Approve label={t.g2hold} onDone={async()=>{setErr('');try{await call('loop_approve_gate',{p_request:req.id,p_gate:2,p_decision:'APPROVED',p_note:null,p_operators:null,p_client_offer:co.id});after()}catch(e:any){fail(e.message)}}}/>
         <div className="act"><button className="g" onClick={()=>setPrepOff(co.id)}>{t.edit}</button><button className="g" onClick={()=>setRejId(rejId===co.id?'':co.id)}>{t.rej}</button></div>
         {rejId===co.id&&<div className="act"><input aria-label={t.rejW} placeholder={t.rejW} value={rejW} onChange={e=>setRejW(e.target.value)}/><button disabled={rejW.trim().length<3} onClick={()=>act(async()=>{await call('loop_approve_gate',{p_request:req.id,p_gate:2,p_decision:'REJECTED',p_note:rejW.trim(),p_operators:null,p_client_offer:co.id});setRejId('');setRejW('')})}>{t.rejGo}</button></div>}</>}
        {co.status==='APPROVED'&&<><p className="kc-h">{t.presentH}</p><div className="act"><button onClick={()=>act(()=>call('loop_present_client_offer',{p_client_offer:co.id}))}>{t.present}</button><button className="g" onClick={()=>setPrepOff(co.id)}>{t.edit}</button></div></>}</>}
      </div>}
     </div>})}</div>}

   {s==='PRESENTED'&&<div className="kc-p"><p>{t.atc}</p>{shown&&<><div className="row"><span><b><bdi>{shown.cabin_label}</bdi></b></span><span className="kc-m">{money(shown.client_price,shown.currency)}</span></div><div className="row"><span>{t.valid}</span><span>{dt(shown.valid_until)}</span></div></>}</div>}

   {s==='OFFER_EXPIRED'&&<div className="kc-p"><p>{t.expired}</p><div className="act"><button onClick={()=>act(()=>call('loop_set_status',{p_request:req.id,p_new:'SEARCHING',p_reason:'offer expired, search reopened'}))}>{t.reopen}</button></div></div>}

   {s==='ACCEPTED'&&<div className="kc-p"><h3>{t.g3}</h3><p className="kc-h">{t.g3h}</p>
    {shown&&<div className="row"><span><b><bdi>{shown.cabin_label}</bdi></b></span><span className="kc-m">{money(shown.client_price,shown.currency)}</span></div>}
    <div className="act"><input aria-label={t.g3note} placeholder={t.g3note} value={note} maxLength={500} onChange={e=>setNote(e.target.value)}/></div>
    <Approve label={t.g3hold} onDone={async()=>{setErr('');try{await call('loop_approve_gate',{p_request:req.id,p_gate:3,p_decision:'APPROVED',p_note:note.trim()||null,p_operators:null,p_client_offer:null});setNote('');after()}catch(e:any){fail(e.message)}}}/></div>}

   {s==='AWAITING_BOOKING'&&<div className="kc-p"><h3>{t.cf}</h3><p className="kc-h">{t.cfh}</p>
    <textarea aria-label={t.cf} rows={3} maxLength={300} placeholder={t.cfph} value={cf} onChange={e=>setCf(e.target.value)}/>
    <div className="act"><button disabled={cf.trim().length<5} onClick={()=>act(async()=>{await call('loop_confirm',{p_request:req.id,p_note:cf.trim()});setCf('')})}>{t.cfs}</button>
     <button className="g" onClick={()=>act(()=>call('loop_set_status',{p_request:req.id,p_new:'SEARCHING',p_reason:'operator did not confirm, search reopened'}))}>{t.cff}</button></div></div>}

   {Other}
   {d.appr.length>0&&<details className="kc-more"><summary className="mono">{t.log}</summary>
    {[...d.appr].reverse().map(a=><div className="row" key={a.seq}><span>{t.gate} {a.gate} · {t.dec[a.decision]??a.decision}{a.note?<> · <bdi>{a.note}</bdi></>:null}{a.scope?.operators?.length?<> · <bdi className="kc-op">{a.scope.operators.join('، ')}</bdi></>:null}</span><span>{dt(a.decided_at)}</span></div>)}</details>}
  </>}
 </section>;
}

export default function Cockpit({airports}:{airports:Airport[]}){
 const {lang}=useI18n();const t=T[lang==='ar'?'ar':'en'];
 const [reqs,setReqs]=useState<Req[]|null>(null),[names,setNames]=useState<Record<string,string>>({}),[sel,setSel]=useState<string|null>(null),[err,setErr]=useState(''),[auto,setAuto]=useState(true);
 const load=useCallback(async()=>{
  const {data,error}=await sb.from('travel_requests').select('id,customer_id,raw_text,origin_code,destination_code,travel_date,departure_period,passengers,baggage_note,return_requested,status,missing_fields,loop_status,loop_status_reason,created_at').neq('status','CANCELLED').order('created_at',{ascending:false}).limit(60);
  if(error){setErr(t.err);setReqs([]);return}
  const rows=data as unknown as Req[];setReqs(rows);setErr('');
  const ids=[...new Set(rows.map(r=>r.customer_id))];
  if(ids.length){const p=await sb.from('profiles').select('id,full_name').in('id',ids);if(!p.error)setNames(Object.fromEntries((p.data??[]).filter((x:any)=>x.full_name).map((x:any)=>[x.id,x.full_name as string])))}
 },[t.err]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{if(auto&&reqs&&!sel){const f=reqs.find(r=>turnOf(r)==='me');if(f)setSel(f.id)}},[reqs,auto,sel]);
 const nm=useCallback((c:string|null)=>{if(!c)return '?';const a=airports.find(x=>x.iata===c);return a?airportName(a):c},[airports]);
 const mine=reqs?.filter(r=>turnOf(r)==='me').length??0;
 const cur=reqs?.find(r=>r.id===sel)??null;
 const order=useMemo(()=>{const w:Record<Turn,number>={me:0,op:1,cl:2,done:3};return [...(reqs??[])].sort((a,b)=>w[turnOf(a)]-w[turnOf(b)]||b.created_at.localeCompare(a.created_at))},[reqs]);
 return <section className="kc" aria-label={t.h}>
  <div className="mono">BROKER ROOM</div><h2>{t.h}</h2><p className="lead" style={{margin:'0 0 8px'}}>{t.lead}</p>
  {err&&<div className="nt" role="alert">{err}</div>}
  {cur?<Thread req={cur} t={t} lang={lang} nm={nm} reload={load} onList={()=>{setSel(null);setAuto(false)}}/>
  :<>
   <p className="kc-wait">{t.wait(mine)}</p>
   {reqs&&!reqs.length&&<div className="empty">{t.none}</div>}
   <div className="kc-list">{order.map(r=>{const tn=turnOf(r);return <button key={r.id} className="kc-it" onClick={()=>setSel(r.id)}>
    <span className={`kc-dot ${tn}`} aria-hidden/>
    <span className="kc-it-m"><span className="kc-it-r">{r.origin_code&&r.destination_code?<Route from={nm(r.origin_code)} to={nm(r.destination_code)}/>:t.unknownRoute}</span>
     <small>{r.travel_date??t.nodate} · {r.passengers??'?'} {t.pax} · {names[r.customer_id]?<bdi>{names[r.customer_id]}</bdi>:t.client}</small></span>
    <span className={`kc-tn ${tn}`}>{r.loop_status in t.fin?t.fin[r.loop_status]:t.turn[tn]}</span></button>})}</div>
  </>}
 </section>;
}
