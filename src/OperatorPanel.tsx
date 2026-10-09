import {useCallback,useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
import LangSwitch from './LangSwitch';
import './opanel.css';
// لوحة المشغّل الحقيقية (?view=panel): 4 تبويبات فوق قاعدة I KING. كل الصلاحيات من RLS والدوال، والواجهة لا تقرّر شيئًا حرجًا.
const S={
ar:{title:'لوحة المشغّل',in:'ادخل بالإيميل',email:'الإيميل',send:'ابعت رابط الدخول',sent:'الرابط وصل إيميلك. افتحه وارجع هنا.',out:'خروج',noop:'حسابك مش مفعّل كمشغّل لسه. كلّم فريق iKing.',
tabs:['طائراتي','رحلاتي','الطلبات','الدفع'],sub:['طائراتك المسجّلة وحالة اعتمادها','رحلاتك المعروضة وحالة كل واحدة','طلبات مناسبة لطائراتك، بانتظار سعرك','طريقة استلام دفعتك والرحلات التي قبلها العملاء'],
brandSub:'بوابة المشغّل',loginH:'ادخل إلى لوحتك',loginP:'اكتب إيميلك ونرسل لك رابط دخول. من غير كلمة سر.',another:'استخدم إيميلًا آخر',
side:'الطلبات المناسبة تصلك. وفريقنا يراجع كل سعر قبل ما يشوفه العميل.',
qTitle:'سعرك للمراجعة',qHow:'كيف يصل سعرك للعميل',qHow1:'تكتب سعرك الإجمالي وصلاحيته.',qHow2:'فريق iKing يراجعه ويؤكد التوفر معك.',qHow3:'بعد موافقته يظهر للعميل. اسم العميل يبقى عندنا.',
qPick:'اختر طلبًا من القائمة لتسعّره.',qTrust:'السعر هنا للمراجعة. مش عرضًا نهائيًا للعميل.',noPhoto:'بدون صورة',seatsN:'مقاعد',
add:'إضافة',save:'حفظ',edit:'تعديل',cancel:'إلغاء',
model:'الطراز',maker:'الشركة المصنّعة',year:'سنة الصنع',pax:'عدد المقاعد',bag:'حد الأمتعة (كجم)',range:'المدى (ميل بحري)',layout:'التخطيط',amen:'المرافق (افصل بفاصلة)',apt:'متطلبات المطارات',lic:'رقم الترخيص / AOC',reg:'التسجيل (خاص، مش بيظهر للعملاء)',photos:'روابط صور حقيقية (https، افصل بفاصلة)',notes:'ملاحظات',
DECLARED:'بانتظار تأكيد الفريق',CONFIRMED:'مؤكدة',REJECTED:'مرفوضة',nofleet:'لسه ماضفتش طائرات.',needfleet:'أضف طائرة الأول.',
aircraft:'الطائرة',kind:'النوع',SCHEDULED:'رحلة مجدولة',EMPTY_LEG:'رحلة فارغة',ON_DEMAND:'عند الطلب',from:'من',to:'إلى',dep1:'أبكر إقلاع',dep2:'آخر إقلاع',seats:'مقاعد متاحة',price:'السعر الإجمالي (USD)',onreq:'السعر عند الطلب',
note1:'أي رحلة تدخل «بانتظار التحقق». مش بتتعرض كمتاحة إلا بعد تأكيد فريقنا.',withdraw:'سحب',noflights:'مفيش رحلات.',
PENDING_VERIFICATION:'بانتظار التحقق',AVAILABLE:'متاحة',HELD:'محجوزة مؤقتًا',BOOKED:'محجوزة',EXPIRED:'منتهية',CANCELLED:'مسحوبة',
noreq:'مفيش طلبات جديدة.',pax2:'ركّاب',offer:'رد بسعر',decline:'اعتذار',quoteP:'سعرك (USD)',hrs:'صالح لمدة (ساعات)',reason:'السبب (اختياري)',sendq:'ابعت السعر للمراجعة',sentq:'اتبعت. الفريق هيراجعه قبل ما يوصل للعميل.',
paydet:'طريقة استلام الدفع',link:'رابط دفع',bank:'تحويل بنكي',linkF:'رابط الدفع (https)',bankF:'بيانات التحويل',warn:'ما تكتبش أرقام بطاقات. البيانات دي بتبان للفريق بس.',
acc:'رحلات قبلها العميل',none:'مفيش رحلات مقبولة لسه.',got:'استلمت الدفع',ref:'رقم التحويل / الإيصال',conf:'تأكيد',waiting:'بانتظار تأكيد الفريق',done:'الفريق أكّد الدفع',pnote:'ضغطك على «استلمت الدفع» تسجيل منك، والفريق هو اللي يأكده.',err:'حصلت مشكلة'},
en:{title:'Operator panel',in:'Sign in by email',email:'Email',send:'Send sign-in link',sent:'Link sent. Open it, then come back.',out:'Sign out',noop:'Your account is not an active operator yet. Contact the iKing team.',
tabs:['My aircraft','My flights','Requests','Payment'],sub:['Your registered aircraft and their approval status','Your listed flights and the status of each','Requests that fit your aircraft, waiting for your price','How you get paid and the flights customers accepted'],
brandSub:'Operator portal',loginH:'Open your panel',loginP:'Enter your email and we send a sign-in link. No password.',another:'Use another email',
side:'Matching requests reach you. Our team reviews every price before a customer sees it.',
qTitle:'Your price, for review',qHow:'How your price reaches the customer',qHow1:'You enter your total price and how long it holds.',qHow2:'The iKing team reviews it and confirms availability with you.',qHow3:'Only then does the customer see it. The customer name stays with us.',
qPick:'Pick a request from the list to price it.',qTrust:'This price is for review. It is not a final offer to the customer.',noPhoto:'No photo',seatsN:'seats',
add:'Add',save:'Save',edit:'Edit',cancel:'Cancel',
model:'Model',maker:'Manufacturer',year:'Year built',pax:'Seats',bag:'Baggage limit (kg)',range:'Range (nm)',layout:'Layout',amen:'Amenities (comma separated)',apt:'Airport requirements',lic:'Licence / AOC no.',reg:'Registration (private, never shown to customers)',photos:'Real photo links (https, comma separated)',notes:'Notes',
DECLARED:'Awaiting team confirmation',CONFIRMED:'Confirmed',REJECTED:'Rejected',nofleet:'No aircraft yet.',needfleet:'Add an aircraft first.',
aircraft:'Aircraft',kind:'Type',SCHEDULED:'Scheduled flight',EMPTY_LEG:'Empty leg',ON_DEMAND:'On demand',from:'From',to:'To',dep1:'Earliest departure',dep2:'Latest departure',seats:'Seats available',price:'Total price (USD)',onreq:'Price on request',
note1:'Every flight starts as pending verification. It is not shown as available until our team confirms it.',withdraw:'Withdraw',noflights:'No flights.',
PENDING_VERIFICATION:'Pending verification',AVAILABLE:'Available',HELD:'Held',BOOKED:'Booked',EXPIRED:'Expired',CANCELLED:'Withdrawn',
noreq:'No new requests.',pax2:'passengers',offer:'Quote',decline:'Decline',quoteP:'Your price (USD)',hrs:'Valid for (hours)',reason:'Reason (optional)',sendq:'Send price for review',sentq:'Sent. Our team reviews it before the customer sees it.',
paydet:'How you receive payment',link:'Payment link',bank:'Bank transfer',linkF:'Payment link (https)',bankF:'Transfer details',warn:'Never enter card numbers. Only our team can see this.',
acc:'Flights the customer accepted',none:'No accepted flights yet.',got:'I received payment',ref:'Transfer / receipt number',conf:'Confirm',waiting:'Awaiting team confirmation',done:'Team confirmed payment',pnote:'“I received payment” is your declaration; our team confirms it.',err:'Something went wrong'}};
type Tx=typeof S.ar;type Row=Record<string,any>;
const empty={model:'',manufacturer:'',year_built:'',max_pax:'',baggage_kg:'',range_nm:'',layout:'',amenities:'',airport_requirements:'',license_ref:'',registration:'',photos:'',notes:''};
const num=(v:string)=>v===''?null:Number(v);
function Fld({l,v,on,type='text',area}:{l:string;v:string;on:(s:string)=>void;type?:string;area?:boolean}){
 return <label className="opf">{l}{area?<textarea value={v} onChange={e=>on(e.target.value)} rows={2}/>:<input type={type} value={v} onChange={e=>on(e.target.value)}/>}</label>}
const IC=[
 <path key="a" d="M3 14l8-2 6-8c.7-.8 2 .3 1.3 1.2L15 11l5 1.5-.7 1.6L13 13.8 10.5 20l-1.7.2.4-5.6L3 15.7z"/>,
 <path key="b" d="M4 6h16M4 12h16M4 18h10"/>,
 <path key="c" d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5"/>,
 <path key="d" d="M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2"/>];
const Ic=({i}:{i:number})=><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[i]}</svg>;
const Brand=({T}:{T:Tx})=><div className="op-brand"><i aria-hidden="true"/><span><b>THE KING'S EYE</b><small>{T.brandSub}</small></span></div>;
export default function OperatorPanel(){
 const {lang,dir}=useI18n();const T:Tx=lang==='ar'?S.ar:S.en;
 const [ses,setSes]=useState<string|null|undefined>(undefined),[mail,setMail]=useState(''),[ok,setOk]=useState<boolean|null>(null),[tab,setTab]=useState(0),[err,setErr]=useState(''),[cnt,setCnt]=useState(0);
 useEffect(()=>{sb.auth.getSession().then(r=>{setSes(r.data.session?.user.id??null);setMail(r.data.session?.user.email??'')});const {data}=sb.auth.onAuthStateChange((_e,s)=>{setSes(s?.user.id??null);setMail(s?.user.email??'')});return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!ses){setOk(null);return}sb.from('profiles').select('role,status').eq('id',ses).maybeSingle().then(r=>setOk(r.data?.role==='operator'&&r.data?.status==='active'))},[ses]);
 const run=async(f:()=>PromiseLike<{error:{message:string}|null}>)=>{setErr('');const r=await f();if(r.error){setErr(r.error.message||T.err);return false}return true};
 if(ses===undefined)return <div className="op" dir={dir}/>;
 if(!ses)return <div className="op" dir={dir}><Login T={T}/></div>;
 if(ok===null)return <div className="op" dir={dir}/>;
 if(!ok)return <div className="op" dir={dir}><div className="op-solo"><Brand T={T}/><p className="opn">{T.noop}</p><button className="g" onClick={()=>sb.auth.signOut()}>{T.out}</button></div></div>;
 return <div className="op op-app" dir={dir}>
  <aside className="op-side"><Brand T={T}/>
   <nav role="tablist" aria-label={T.title}>{T.tabs.map((x,i)=><button key={x} role="tab" aria-selected={tab===i} className={tab===i?'on':''} onClick={()=>{setTab(i);setErr('')}}><Ic i={i}/><span>{x}</span>{i===2&&cnt>0&&<em aria-label={String(cnt)}>{cnt}</em>}</button>)}</nav>
   <p className="op-tag">{T.side}</p></aside>
  <div className="op-main">
   <header><div><h1>{T.tabs[tab]}</h1><p>{T.sub[tab]}</p></div>
    <div className="op-who"><LangSwitch/><span dir="ltr">{mail}</span><button className="g" onClick={()=>sb.auth.signOut()}>{T.out}</button></div></header>
   {err&&<div className="ope" role="alert">{err}</div>}
   {tab===0&&<Fleet T={T} uid={ses} run={run}/>}{tab===1&&<Flights T={T} uid={ses} run={run}/>}{tab===2&&<Requests T={T} run={run} onCount={setCnt}/>}{tab===3&&<Pay T={T} uid={ses} run={run}/>}
  </div></div>}
function Login({T}:{T:Tx}){const [e,setE]=useState(''),[m,setM]=useState(''),[b,setB]=useState(false),[sent,setSent]=useState(false);
 const go=async()=>{setB(true);setM('');const r=await sb.auth.signInWithOtp({email:e.trim(),options:{emailRedirectTo:location.href}});setB(false);if(r.error){setM(T.err);return}setSent(true)};
 const valid=e.includes('@')&&e.includes('.');
 return <div className="op-login"><div className="op-lside" aria-hidden="true"><div className="op-rings"><i/><i/><i/><b/></div></div>
  <div className="op-lform"><Brand T={T}/><div className="op-lbox"><LangSwitch/><h1>{T.loginH}</h1>
   {sent?<><p className="op-ok" role="status">{T.sent}</p><button className="g" onClick={()=>setSent(false)}>{T.another}</button></>
   :<><p>{T.loginP}</p><Fld l={T.email} v={e} on={setE} type="email"/><button disabled={b||!valid} onClick={go}>{T.send}</button>{m&&<div className="ope" role="alert">{m}</div>}</>}
   <small>{T.side}</small></div></div></div>}
type P={T:Tx;run:(f:()=>PromiseLike<{error:{message:string}|null}>)=>Promise<boolean>};
function Fleet({T,uid,run}:P&{uid:string}){
 const [rows,setRows]=useState<Row[]>([]),[f,setF]=useState({...empty}),[eid,setEid]=useState<string|null>(null),[open,setOpen]=useState(false);
 const load=useCallback(()=>{sb.from('aircraft_fleet').select('*').eq('operator_id',uid).eq('active',true).order('created_at',{ascending:false}).then(r=>setRows(r.data??[]))},[uid]);useEffect(load,[load]);
 const s=(k:keyof typeof empty)=>(v:string)=>setF(p=>({...p,[k]:v}));
 const save=async()=>{const body={model:f.model.trim(),manufacturer:f.manufacturer.trim()||null,year_built:num(f.year_built),max_pax:num(f.max_pax),baggage_kg:num(f.baggage_kg),range_nm:num(f.range_nm),layout:f.layout.trim()||null,
  amenities:f.amenities.split(',').map(x=>x.trim()).filter(Boolean),airport_requirements:f.airport_requirements.trim()||null,license_ref:f.license_ref.trim()||null,registration:f.registration.trim()||null,
  photo_urls:f.photos.split(',').map(x=>x.trim()).filter(x=>x.startsWith('https://')),notes:f.notes.trim()||null};
  const okk=await run(()=>eid?sb.from('aircraft_fleet').update(body).eq('id',eid):sb.from('aircraft_fleet').insert({...body,operator_id:uid}));if(okk){setF({...empty});setEid(null);setOpen(false);load()}};
 const edit=(r:Row)=>{setEid(r.id);setOpen(true);setF({model:r.model??'',manufacturer:r.manufacturer??'',year_built:r.year_built?.toString()??'',max_pax:r.max_pax?.toString()??'',baggage_kg:r.baggage_kg?.toString()??'',range_nm:r.range_nm?.toString()??'',layout:r.layout??'',amenities:(r.amenities??[]).join(', '),airport_requirements:r.airport_requirements??'',license_ref:r.license_ref??'',registration:r.registration??'',photos:(r.photo_urls??[]).join(', '),notes:r.notes??''})};
 return <section>{!open&&<button onClick={()=>setOpen(true)}>{T.add}</button>}
  {open&&<div className="opc"><div className="opg">
   <Fld l={T.model} v={f.model} on={s('model')}/><Fld l={T.maker} v={f.manufacturer} on={s('manufacturer')}/><Fld l={T.year} v={f.year_built} on={s('year_built')} type="number"/><Fld l={T.pax} v={f.max_pax} on={s('max_pax')} type="number"/>
   <Fld l={T.bag} v={f.baggage_kg} on={s('baggage_kg')} type="number"/><Fld l={T.range} v={f.range_nm} on={s('range_nm')} type="number"/><Fld l={T.layout} v={f.layout} on={s('layout')}/><Fld l={T.amen} v={f.amenities} on={s('amenities')}/>
   <Fld l={T.lic} v={f.license_ref} on={s('license_ref')}/><Fld l={T.reg} v={f.registration} on={s('registration')}/></div>
   <Fld l={T.apt} v={f.airport_requirements} on={s('airport_requirements')} area/><Fld l={T.photos} v={f.photos} on={s('photos')} area/><Fld l={T.notes} v={f.notes} on={s('notes')} area/>
   <div className="opa"><button disabled={!f.model.trim()} onClick={save}>{T.save}</button><button className="g" onClick={()=>{setOpen(false);setEid(null);setF({...empty})}}>{T.cancel}</button></div></div>}
  {rows.length===0&&!open&&<p className="opn">{T.nofleet}</p>}
  <div className="op-cards">{rows.map(r=>{const ph=(r.photo_urls??[]).find((x:string)=>x.startsWith('https://'));return <article className="op-ac" key={r.id}>
   <div className="op-ph">{ph?<img src={ph} alt={r.model} loading="lazy"/>:<span><Ic i={0}/><small>{T.noPhoto}</small></span>}</div>
   <div className="op-ab"><b>{r.model}</b><small>{r.manufacturer??''}{r.year_built?` · ${r.year_built}`:''}</small>
    <div className="op-meta"><span>{r.max_pax??'?'} {T.seatsN}</span>{r.range_nm?<span dir="ltr">{r.range_nm} nm</span>:null}</div></div>
   <div className="op-af"><span className={`opb ${r.verification==='CONFIRMED'?'ok':''}`}>{(T as any)[r.verification]}</span><button className="g" onClick={()=>edit(r)}>{T.edit}</button></div></article>})}</div>
 </section>}
function Flights({T,uid,run}:P&{uid:string}){
 const [rows,setRows]=useState<Row[]>([]),[fl,setFl]=useState<Row[]>([]),[ap,setAp]=useState<Row[]>([]),[open,setOpen]=useState(false);
 const [f,setF]=useState({fleet:'',kind:'EMPTY_LEG',o:'',d:'',a:'',b:'',seats:'',price:''});
 const load=useCallback(()=>{sb.from('aircraft_availability').select('id,origin_code,destination_code,departure_from,departure_until,seats,status,kind,aircraft_model,indicative_price_usd').eq('operator_id',uid).order('departure_from',{ascending:false}).limit(50).then(r=>setRows(r.data??[]));
  sb.from('aircraft_fleet').select('id,model,max_pax').eq('operator_id',uid).eq('active',true).then(r=>setFl(r.data??[]))},[uid]);useEffect(()=>{load();sb.from('airports').select('iata').order('iata').then(r=>setAp(r.data??[]))},[load]);
 const set=(k:string)=>(v:string)=>setF(p=>({...p,[k]:v}));
 const save=async()=>{const m=fl.find(x=>x.id===f.fleet);if(!m)return;const body:Row={operator_id:uid,fleet_id:m.id,aircraft_model:m.model,kind:f.kind,origin_code:f.o,destination_code:f.d||null,departure_from:new Date(f.a).toISOString(),departure_until:new Date(f.b||f.a).toISOString(),
  seats:Number(f.seats),min_pax:1,status:'PENDING_VERIFICATION',source:'OFFICIAL_OPERATOR',confidence:'low',expires_at:new Date(f.b||f.a).toISOString(),pricing_mode:f.price?'FIXED_TOTAL':'ON_REQUEST',indicative_price_usd:f.price?Number(f.price):null};
  if(await run(()=>sb.from('aircraft_availability').insert(body))){setOpen(false);setF({fleet:'',kind:'EMPTY_LEG',o:'',d:'',a:'',b:'',seats:'',price:''});load()}};
 const bad=!f.fleet||!f.o||!f.a||!f.seats||(f.kind!=='ON_DEMAND'&&!f.d);
 return <section><p className="opn">{T.note1}</p>
  {!open&&<button onClick={()=>setOpen(true)} disabled={fl.length===0}>{fl.length?T.add:T.needfleet}</button>}
  {open&&<div className="opc"><div className="opg">
   <label className="opf">{T.aircraft}<select value={f.fleet} onChange={e=>set('fleet')(e.target.value)}><option value=""/>{fl.map(x=><option key={x.id} value={x.id}>{x.model}</option>)}</select></label>
   <label className="opf">{T.kind}<select value={f.kind} onChange={e=>set('kind')(e.target.value)}>{['EMPTY_LEG','SCHEDULED','ON_DEMAND'].map(k=><option key={k} value={k}>{(T as any)[k]}</option>)}</select></label>
   <label className="opf">{T.from}<select value={f.o} onChange={e=>set('o')(e.target.value)}><option value=""/>{ap.map(x=><option key={x.iata}>{x.iata}</option>)}</select></label>
   <label className="opf">{T.to}<select value={f.d} onChange={e=>set('d')(e.target.value)}><option value=""/>{ap.filter(x=>x.iata!==f.o).map(x=><option key={x.iata}>{x.iata}</option>)}</select></label>
   <Fld l={T.dep1} v={f.a} on={set('a')} type="datetime-local"/><Fld l={T.dep2} v={f.b} on={set('b')} type="datetime-local"/><Fld l={T.seats} v={f.seats} on={set('seats')} type="number"/><Fld l={T.price} v={f.price} on={set('price')} type="number"/></div>
   {!f.price&&<small>{T.onreq}</small>}<div className="opa"><button disabled={bad} onClick={save}>{T.save}</button><button className="g" onClick={()=>setOpen(false)}>{T.cancel}</button></div></div>}
  {rows.length===0&&<p className="opn">{T.noflights}</p>}
  <div className="op-cards">{rows.map(r=><article className="op-fl" key={r.id}>
   <div className="op-route" dir="ltr"><b>{r.origin_code}</b><i aria-hidden="true">→</i><b>{r.destination_code??'—'}</b></div>
   <div className="op-ab"><b>{r.aircraft_model}</b><small>{fmt(r.departure_from)} · {r.seats} {T.seatsN}</small></div>
   <div className="op-af"><span className={`opb ${r.status==='AVAILABLE'?'ok':''}`}>{(T as any)[r.status]}</span>
   {['PENDING_VERIFICATION','AVAILABLE','HELD'].includes(r.status)&&<button className="g" onClick={async()=>{if(await run(()=>sb.rpc('set_availability_status',{p_id:r.id,p_new:'CANCELLED',p_reason:'withdrawn by operator'})))load()}}>{T.withdraw}</button>}</div></article>)}</div>
 </section>}
const lang2=()=>document.documentElement.lang||'ar';
const fmt=(d:string)=>new Date(d).toLocaleString(lang2(),{dateStyle:'medium',timeStyle:'short'});
function Requests({T,run,onCount}:P&{onCount:(n:number)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[sel,setSel]=useState<string|null>(null),[mode,setMode]=useState<'q'|'d'>('q'),[price,setPrice]=useState(''),[hrs,setHrs]=useState('24'),[txt,setTxt]=useState(''),[msg,setMsg]=useState('');
 const load=()=>{sb.rpc('list_operator_requests').then(r=>{const d=r.data??[];setRows(d);onCount(d.length)})};useEffect(load,[]);
 const cur=rows.find(r=>r.quote_request_id===sel);
 const go=async()=>{if(!sel)return;const okk=await run(()=>mode==='q'?sb.rpc('operator_submit_quote',{p_quote_request_id:sel,p_price_usd:Number(price),p_valid_until:new Date(Date.now()+Number(hrs)*36e5).toISOString(),p_note:txt||null}):sb.rpc('operator_decline_request',{p_quote_request_id:sel,p_reason:txt||null}));
  if(okk){setMsg(mode==='q'?T.sentq:'');setSel(null);setPrice('');setTxt('');load()}};
 return <section className="op-split">
  <div className="op-cards">{msg&&<p className="op-ok" role="status">{msg}</p>}{rows.length===0&&<p className="opn">{T.noreq}</p>}
   {rows.map(r=><article key={r.quote_request_id} className={`op-fl op-rq${sel===r.quote_request_id?' on':''}`}>
    <div className="op-route" dir="ltr"><b>{r.origin_code}</b><i aria-hidden="true">→</i><b>{r.destination_code??'—'}</b></div>
    <div className="op-ab"><b>{r.passengers} {T.pax2}</b><small>{fmt(r.departure_from)}</small></div>
    <div className="op-af"><button onClick={()=>{setSel(r.quote_request_id);setMode('q');setMsg('')}}>{T.offer}</button><button className="g" onClick={()=>{setSel(r.quote_request_id);setMode('d');setMsg('')}}>{T.decline}</button></div></article>)}</div>
  <aside className="op-q" aria-live="polite">
   {!cur?<><h2>{T.qHow}</h2><ol><li>{T.qHow1}</li><li>{T.qHow2}</li><li>{T.qHow3}</li></ol><p className="opn">{T.qPick}</p></>
   :<><h2>{mode==='q'?T.qTitle:T.decline}</h2>
    <div className="op-route sm" dir="ltr"><b>{cur.origin_code}</b><i aria-hidden="true">→</i><b>{cur.destination_code??'—'}</b></div>
    <p className="opn">{cur.passengers} {T.pax2} · {fmt(cur.departure_from)}</p>
    {mode==='q'&&<div className="opg"><Fld l={T.quoteP} v={price} on={setPrice} type="number"/><Fld l={T.hrs} v={hrs} on={setHrs} type="number"/></div>}
    <Fld l={mode==='q'?T.notes:T.reason} v={txt} on={setTxt} area/>
    {mode==='q'&&<p className="op-trust">{T.qTrust}</p>}
    <div className="opa"><button disabled={mode==='q'&&(!price||Number(price)<=0)} onClick={go}>{mode==='q'?T.sendq:T.decline}</button><button className="g" onClick={()=>setSel(null)}>{T.cancel}</button></div></>}
  </aside></section>}
function Pay({T,uid,run}:P&{uid:string}){
 const [m,setM]=useState<'PAYMENT_LINK'|'BANK_TRANSFER'>('PAYMENT_LINK'),[lk,setLk]=useState(''),[bk,setBk]=useState(''),[rows,setRows]=useState<Row[]>([]),[ask,setAsk]=useState<string|null>(null),[ref,setRef]=useState(''),[saved,setSaved]=useState(false);
 const load=useCallback(()=>{sb.from('operator_payment_details').select('*').eq('operator_id',uid).maybeSingle().then(r=>{if(r.data){setM(r.data.method);setLk(r.data.payment_link??'');setBk(r.data.bank_details??'')}});sb.rpc('list_operator_accepted_quotes').then(r=>setRows(r.data??[]))},[uid]);useEffect(load,[load]);
 const save=async()=>{if(await run(()=>sb.from('operator_payment_details').upsert({operator_id:uid,method:m,payment_link:m==='PAYMENT_LINK'?lk.trim():null,bank_details:m==='BANK_TRANSFER'?bk.trim():null})))setSaved(true)};
 const decl=async(r:Row)=>{if(await run(()=>sb.rpc('operator_declare_payment_received',{p_quote:r.quote_id,p_amount:r.price,p_currency:r.currency,p_reference:ref}))){setAsk(null);setRef('');load()}};
 return <section><div className="opc"><b>{T.paydet}</b><div className="opa"><button className={m==='PAYMENT_LINK'?'':'g'} onClick={()=>setM('PAYMENT_LINK')}>{T.link}</button><button className={m==='BANK_TRANSFER'?'':'g'} onClick={()=>setM('BANK_TRANSFER')}>{T.bank}</button></div>
  {m==='PAYMENT_LINK'?<Fld l={T.linkF} v={lk} on={v=>{setLk(v);setSaved(false)}}/>:<Fld l={T.bankF} v={bk} on={v=>{setBk(v);setSaved(false)}} area/>}<small>{T.warn}</small>
  <button disabled={m==='PAYMENT_LINK'?!lk.startsWith('https://'):bk.trim().length<5} onClick={save}>{T.save}{saved?' ✓':''}</button></div>
  <h3>{T.acc}</h3><p className="opn">{T.pnote}</p>{rows.length===0&&<p className="opn">{T.none}</p>}
  {rows.map(r=><div className="opr col" key={r.quote_id}><div><b dir="ltr">{r.origin_code} → {r.destination_code??'—'}</b> · <span dir="ltr">{r.price} {r.currency}</span></div>
   {r.declaration_status?<span className={`opb ${r.declaration_status==='STAFF_CONFIRMED'?'ok':''}`}>{r.declaration_status==='STAFF_CONFIRMED'?T.done:T.waiting}</span>
   :ask!==r.quote_id?<button onClick={()=>setAsk(r.quote_id)}>{T.got}</button>:<div className="opc"><Fld l={T.ref} v={ref} on={setRef}/><div className="opa"><button disabled={ref.trim().length<3} onClick={()=>decl(r)}>{T.conf}</button><button className="g" onClick={()=>setAsk(null)}>{T.cancel}</button></div></div>}</div>)}
 </section>}
