import {useEffect,useRef,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import './rafiqchat.css';
// «رفيق» على الصفحة الرئيسية: أيقونة في الزاوية تفتح نافذة محادثة (ملء الشاشة على الموبايل).
// كل الردود تأتي من الدالة rafiq-chat: النموذج يفهم الطلب فقط، والقواعد الحساسة ثابتة، ولا سعر ولا توافر ولا حجز.
// لا يُحفظ شيء في المتصفح (لا تخزين محلي). المحادثة تختفي بإغلاق الصفحة.
// DRAFT: المعرفة غير معتمدة بعد، والتحويل لإنسان يتم عبر نموذج «اطلب رحلتك» (?view=ask) وليس تلقائيًا.
type Msg={who:'me'|'rf';text:string;next?:string;human?:boolean;general?:boolean;journey?:boolean;local?:boolean;src?:{title:string;name:string;verified_at?:string|null;stale?:boolean}[]};
type L={name:string;role:string;open:string;close:string;ph:string;send:string;hello:string;note:string;busy:string;limit:string;err:string;human:string;form:string;src:string;stale:string;wait:string;gen:string;jchip:string};
const D:Record<'ar'|'en',L>={
 ar:{name:'رفيق',role:'مرافقك في EYE KING',open:'تحدّث مع رفيق',close:'إغلاق',ph:'اكتب رحلتك أو سؤالك…',send:'إرسال',
  hello:'أهلًا، أنا رفيق، مساعد ذكي لطلبات الطيران الخاص. قل لي رحلتك بكلامك: من أين وإلى أين ومتى وكم شخصًا.',
  note:'مساعد ذكي وقد يخطئ. لا يؤكد سعرًا ولا توفر طائرة ولا حجزًا؛ التأكيد النهائي من المشغّل وفريقنا.',
  busy:'الخدمة غير متاحة مؤقتًا. حاول بعد قليل.',limit:'وصلت للحد المسموح حاليًا. حاول لاحقًا.',err:'تعذّر الإرسال. حاول مرة أخرى.',
  human:'لم يُرسل شيء لأي جهة بعد. لو تحب أن يتابعك زميل من الفريق، اترك بيانات التواصل من هنا.',form:'اترك طلبك للفريق',src:'المصدر',stale:'انتهت مراجعته',wait:'رفيق يكتب…',gen:'معلومة عامة، مش من مصدر معتمد من EYE KING',jchip:'أدير رحلتي'},
 en:{name:'Rafiq',role:'Your EYE KING companion',open:'Talk to Rafiq',close:'Close',ph:'Write your trip or question…',send:'Send',
  hello:'Hello, I am Rafiq, an AI assistant for private-aviation requests. Tell me your trip in your own words: from where, to where, when and how many people.',
  note:'AI assistant, it can make mistakes. It does not confirm price, aircraft availability or booking; final confirmation comes from the operator and our team.',
  busy:'The service is temporarily unavailable. Please try again shortly.',limit:'You have reached the current limit. Please try again later.',err:'Could not send. Please try again.',
  human:'Nothing has been sent to anyone yet. If you would like a colleague to follow up, leave your contact details here.',form:'Leave your request for the team',src:'Source',stale:'review overdue',wait:'Rafiq is typing…',gen:'General information, not from an approved EYE KING source',jchip:'Manage my trip'}};
// أزرار الرد السريع: كل زر يرسل جملة عادية للدالة rafiq-chat، ولا يغيّر أي حالة ولا يعد بشيء.
const Q:Record<'ar'|'en',{trip:[string,string];price:[string,string];mgr:string;cap:string;ready:string;go:string;when:[string,string][];pax:[string,string][];prio:[string,string][]}>={
 ar:{trip:['✈️ عايز أسافر','عايز أسافر بطائرة خاصة'],price:['💰 كام تكلفة؟','كام تكلفة رحلة بطائرة خاصة تقريبًا؟'],mgr:'🧑‍💼 كلّم مدير',cap:'🔎 العين هتعمل إيه ليك؟',ready:'تمام، فهمت رحلتك. الخطوة الجاية: اسمك وطريقة التواصل، وبعدها طلبك يتسلّم للعين.',go:'📨 سلّم طلبي للعين',
  when:[['النهارده','النهارده'],['بكرة','بكرة'],['الأسبوع ده','الأسبوع ده']],
  pax:[['1','عدد الركاب 1'],['2','عدد الركاب 2'],['3-5','عدد الركاب بين 3 و 5'],['6 أو أكتر','عدد الركاب 6 أو أكتر']],
  prio:[['الأسرع','الأهم عندي السرعة'],['الأريح','الأهم عندي الراحة'],['الأوفر','الأهم عندي التوفير']]},
 en:{trip:['✈️ I want to travel','I want to travel by private jet'],price:['💰 Rough cost?','Roughly how much does a private jet trip cost?'],mgr:'🧑‍💼 Talk to a manager',cap:'🔎 What will the Eye do for me?',ready:'Got your trip. Next step: your name and how to reach you, and then your request is handed to the Eye.',go:'📨 Hand my request to the Eye',
  when:[['Today','Today'],['Tomorrow','Tomorrow'],['This week','This week']],
  pax:[['1','Passengers: 1'],['2','Passengers: 2'],['3-5','Passengers: 3 to 5'],['6 or more','Passengers: 6 or more']],
  prio:[['Fastest','Most important to me is speed'],['Most comfortable','Most important to me is comfort'],['Best value','Most important to me is value']]}};
const RX={trip:/(رحلة|سفر|أسافر|اسافر|جدة|الرياض|دبي|القاهرة|trip|travel|fly|flight)/i,
 when:/(النهارد|اليوم|بكر|غدا|غدًا|الأسبوع|الاسبوع|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|\d{1,2}\s*[\/\-]\s*\d{1,2}|today|tomorrow|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)/i,
 pax:/(\d+\s*(شخص|أشخاص|اشخاص|ركاب|راكب|فرد|أفراد|people|passengers|pax)|الركاب|passengers)/i,
 prio:/(السرعة|الراحة|التوفير|الأسرع|الأريح|الأوفر|speed|comfort|value)/i};
type K='live'|'trial'|'grow'|'hand'|'soon';
// خط رحلة رفيق: كل مرحلة بوسم صادق يطابق ما تقوله الدالة rafiq-chat (route journey). لا نعد بما ليس شغّالًا.
const J:Record<'ar'|'en',{lead:string;badge:Record<K,string>;st:[string,string,K][];foot:string;next:string}>={
 ar:{lead:'أرافقك من أول كلمة لحد ما تنزل. وكل خطوة مهمة يؤكدها فريقنا والمشغّل قبل ما تتنفّذ:',
  badge:{live:'شغّال',trial:'تجريبي',grow:'قيد التوسّع',hand:'يدويًا مع الفريق',soon:'قريبًا'},
  st:[['فهم الطلب','أفهم رحلتك بكلامك.','live'],['الخيارات','خيارات إرشادية بأسعار تقديرية.','live'],['موافقة الفريق والمشغّل','يؤكدون التوفر والسعر النهائي، ولا يُرسل شيء بدون موافقة إنسان.','live'],['المطار والوثائق والأرض','معلومات من مصادر معتمدة. النقل الأرضي والاستقبال «قيد الإضافة» ولا أعد بيهم.','grow'],['المراقبة والطقس','متابعة الرحلة وتنبيهك بأي تغيير.','trial'],['يوم الرحلة','متابعة وتنسيق مع الفريق.','hand'],['بعد الرحلة','متابعة رأيك وتفضيلاتك للمرة الجاية.','soon']],
  foot:'الأوسمة تعكس الحالة الحقيقية اليوم.',next:'الخطوة التالية: قولي رحلتك وأبدأ من الخطوة الأولى.'},
 en:{lead:'I accompany you from your first words until you land, and every important step is confirmed by our team and the operator before it happens:',
  badge:{live:'Live',trial:'Trial',grow:'Expanding',hand:'Manual with the team',soon:'Coming soon'},
  st:[['Understand the request','I understand your trip in your own words.','live'],['Options','Indicative options with estimated prices.','live'],['Team and operator approval','They confirm availability and the final price, and nothing is sent without a person approving it.','live'],['Airport, documents and ground','Information from approved sources. Ground transport and meet-and-greet are "being added" and not promised.','grow'],['Monitoring and weather','I watch your trip and alert you to changes.','trial'],['Trip day','Follow-up and coordination with the team.','hand'],['After the trip','Follow-up on your feedback and preferences for next time.','soon']],
  foot:'Badges show the real status today.',next:'Next step: tell me your trip and I will start with step one.'}};
const Eye=({c='currentColor'}:{c?:string})=><svg viewBox="0 0 48 30" fill="none" stroke={c} strokeWidth="2" aria-hidden="true"><path d="M3 15S11 3 24 3s21 12 21 12-8 12-21 12S3 15 3 15z"/><circle cx="24" cy="15" r="6.5"/><circle cx="24" cy="15" r="2.6" fill={c}/></svg>;
export default function RafiqChat(){
 const {lang}=useI18n(),T=D[lang==='ar'?'ar':'en'];
 const [open,setOpen]=useState(false),[msgs,setMsgs]=useState<Msg[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const end=useRef<HTMLDivElement>(null),inp=useRef<HTMLInputElement>(null),btn=useRef<HTMLButtonElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({block:'end'})},[msgs,busy,open]);
 useEffect(()=>{if(open)setTimeout(()=>inp.current?.focus(),50)},[open]);
 useEffect(()=>{const h=(e:Event)=>{const t=(e as CustomEvent).detail;setOpen(true);if(typeof t==='string')setDraft(t.slice(0,300))};addEventListener('rafiq:open',h);return()=>removeEventListener('rafiq:open',h)},[]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)});
 // على الموبايل النافذة تغطي الشاشة: نوقف تمرير الصفحة خلفها
 useEffect(()=>{if(!open)return;const m=matchMedia('(max-width:560px)').matches;if(!m)return;const o=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=o}},[open]);
 const close=()=>{setOpen(false);setTimeout(()=>btn.current?.focus(),0)};
 const send=async(t?:string)=>{
  const v=(t??draft).trim();if(v.length<2||busy)return;
  const prior=msgs.filter(m=>m.who==='me'&&!m.local).map(m=>m.text).slice(-4);
  setMsgs(x=>[...x,{who:'me',text:v}]);if(t===undefined)setDraft('');setErr('');setBusy(true);
  try{
   const {data,error}=await sb.functions.invoke('rafiq-chat',{body:{text:v,history:prior,website:''}});
   if(error){const code=(error as any)?.context?.status;setErr(code===429?T.limit:T.busy);return}
   const d=data as any;
   if(!d||typeof d.text!=='string'){setErr(T.err);return}
   setMsgs(x=>[...x,{who:'rf',text:d.text,next:typeof d.next_step==='string'?d.next_step:undefined,human:!!d.needs_human,general:d.general===true,src:Array.isArray(d.sources)?d.sources:undefined}]);
  }catch{setErr(T.err)}finally{setBusy(false)}
 };
 const J_=J[lang==='ar'?'ar':'en'];
 const runJourney=(label:string=T.jchip)=>{if(busy)return;setErr('');setMsgs(x=>[...x,{who:'me',text:label,local:true},{who:'rf',text:J_.lead,next:J_.next,journey:true,local:true}])};
 const QQ=Q[lang==='ar'?'ar':'en'];
 const mine=msgs.filter(m=>m.who==='me'&&!m.local).map(m=>m.text).join(' ');
 const tripOn=RX.trip.test(mine);
 const stage:[string,string][]=msgs.length===0?[]:!tripOn?[]:!RX.when.test(mine)?QQ.when:!RX.pax.test(mine)?QQ.pax:!RX.prio.test(mine)?QQ.prio:[];
 const ready=tripOn&&RX.when.test(mine)&&RX.pax.test(mine)&&RX.prio.test(mine);
 const goHref='?view=ask&say='+encodeURIComponent(mine.slice(0,600));
 const lastIsJourney=msgs[msgs.length-1]?.journey===true;
 const last=[...msgs].reverse().find(m=>m.who==='me'&&!m.local)?.text??'';
 const formHref='?view=ask'+(last?'&say='+encodeURIComponent(last.slice(0,600)):'');
 return <div className={`rc${lang==='ar'?' rc-ar':''}`} dir={lang==='ar'?'rtl':'ltr'}>
  {!open&&<button ref={btn} type="button" className="rc-fab" onClick={()=>setOpen(true)} aria-label={T.open} aria-haspopup="dialog"><span className="rc-fab-t">{T.name}</span><span className="rc-fab-av"><Eye c="#1b1206"/></span></button>}
  {open&&<section className="rc-win" role="dialog" aria-modal="true" aria-label={T.name}>
   <header className="rc-head"><span className="rc-av"><Eye c="#1b1206"/></span><div><b>{T.name}</b><small>{T.role}</small></div>
    <button type="button" className="rc-x" onClick={close} aria-label={T.close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
   <div className="rc-log" aria-live="polite">
    <p className="rc-bub rc-rf">{T.hello}</p>
        {msgs.map((m,i)=><div key={i} className={`rc-bub ${m.who==='me'?'rc-me':'rc-rf'}`}>
     {m.text.split('\n').map((l,k)=>l.trim()?<p key={k}>{l}</p>:null)}
     {m.journey&&<ol className="rc-jl">{J_.st.map(([t,d,k],i)=><li key={i} className={`rc-j-${k}`}><b>{i+1}. {t}</b><span className="rc-jb">{J_.badge[k]}</span><small>{d}</small></li>)}</ol>}
     {m.journey&&<small className="rc-src">{J_.foot}</small>}
     {m.general&&<small className="rc-gen">{T.gen}</small>}
     {m.next&&<p className="rc-next">{m.next}</p>}
     {m.src?.map((s,k)=><small key={k} className="rc-src"><em>{T.src}</em> {s.title}{s.name?` · ${s.name}`:''}{s.verified_at?` · ${String(s.verified_at).slice(0,10)}`:''}{s.stale?` · ${T.stale}`:''}</small>)}
     {m.human&&<div className="rc-hand"><p>{T.human}</p><a href={formHref}>{T.form}</a></div>}
    </div>)}
    {busy&&<p className="rc-bub rc-rf rc-wait" role="status">{T.wait}</p>}
    {!busy&&ready&&<div className="rc-bub rc-rf"><p>{QQ.ready}</p><a className="rc-go" href={goHref}>{QQ.go}</a></div>}
    {!busy&&<div className="rc-chips">
     {msgs.length===0&&<><button type="button" onClick={()=>send(QQ.trip[1])}>{QQ.trip[0]}</button><button type="button" onClick={()=>send(QQ.price[1])}>{QQ.price[0]}</button><button type="button" onClick={()=>runJourney()}>{T.jchip}</button></>}
     {stage.map(([l,say],i)=><button key={l+i} type="button" onClick={()=>send(say)}>{l}</button>)}
     {msgs.length>0&&!lastIsJourney&&<button type="button" onClick={()=>runJourney(QQ.cap)}>{QQ.cap}</button>}
     <a className="rc-chip-a" href={formHref}>{QQ.mgr}</a>
    </div>}
    {err&&<p className="rc-err" role="alert">{err}</p>}
    <div ref={end}/>
   </div>
   <form className="rc-form" onSubmit={e=>{e.preventDefault();send()}}>
    <input ref={inp} type="text" value={draft} maxLength={500} placeholder={T.ph} aria-label={T.ph} onChange={e=>setDraft(e.target.value)}/>
    <button type="submit" disabled={busy||draft.trim().length<2}>{T.send}</button>
   </form>
   <p className="rc-note">{T.note}</p>
  </section>}
 </div>;
}
