import {useEffect,useRef,useState} from 'react';
import {sb} from '../lib/supabase';
import {useI18n} from '../i18n';
import './rafiqchat.css';
// «رفيق» على الصفحة الرئيسية: أيقونة في الزاوية تفتح نافذة محادثة (ملء الشاشة على الموبايل).
// كل الردود تأتي من الدالة rafiq-chat: النموذج يفهم الطلب فقط، والقواعد الحساسة ثابتة، ولا سعر ولا توافر ولا حجز.
// لا يُحفظ شيء في المتصفح (لا تخزين محلي). المحادثة تختفي بإغلاق الصفحة.
// DRAFT: المعرفة غير معتمدة بعد، والتحويل لإنسان يتم عبر نموذج «اطلب رحلتك» (?view=ask) وليس تلقائيًا.
type Msg={who:'me'|'rf';text:string;next?:string;human?:boolean;src?:{title:string;name:string;verified_at?:string|null;stale?:boolean}[]};
type L={name:string;role:string;open:string;close:string;ph:string;send:string;hello:string;note:string;busy:string;limit:string;err:string;human:string;form:string;src:string;stale:string;wait:string};
const D:Record<'ar'|'en',L>={
 ar:{name:'رفيق',role:'مرافقك في EYE KING',open:'تحدّث مع رفيق',close:'إغلاق',ph:'اكتب رحلتك أو سؤالك…',send:'إرسال',
  hello:'أهلًا، أنا رفيق، مساعد ذكي لطلبات الطيران الخاص. قل لي رحلتك بكلامك: من أين وإلى أين ومتى وكم شخصًا.',
  note:'مساعد ذكي وقد يخطئ. لا يؤكد سعرًا ولا توفر طائرة ولا حجزًا؛ التأكيد النهائي من المشغّل وفريقنا.',
  busy:'الخدمة غير متاحة مؤقتًا. حاول بعد قليل.',limit:'وصلت للحد المسموح حاليًا. حاول لاحقًا.',err:'تعذّر الإرسال. حاول مرة أخرى.',
  human:'لم يُرسل شيء لأي جهة بعد. لو تحب أن يتابعك زميل من الفريق، اترك بيانات التواصل من هنا.',form:'اترك طلبك للفريق',src:'المصدر',stale:'انتهت مراجعته',wait:'رفيق يكتب…'},
 en:{name:'Rafiq',role:'Your EYE KING companion',open:'Talk to Rafiq',close:'Close',ph:'Write your trip or question…',send:'Send',
  hello:'Hello, I am Rafiq, an AI assistant for private-aviation requests. Tell me your trip in your own words: from where, to where, when and how many people.',
  note:'AI assistant, it can make mistakes. It does not confirm price, aircraft availability or booking; final confirmation comes from the operator and our team.',
  busy:'The service is temporarily unavailable. Please try again shortly.',limit:'You have reached the current limit. Please try again later.',err:'Could not send. Please try again.',
  human:'Nothing has been sent to anyone yet. If you would like a colleague to follow up, leave your contact details here.',form:'Leave your request for the team',src:'Source',stale:'review overdue',wait:'Rafiq is typing…'}};
const Eye=({c='currentColor'}:{c?:string})=><svg viewBox="0 0 48 30" fill="none" stroke={c} strokeWidth="2" aria-hidden="true"><path d="M3 15S11 3 24 3s21 12 21 12-8 12-21 12S3 15 3 15z"/><circle cx="24" cy="15" r="6.5"/><circle cx="24" cy="15" r="2.6" fill={c}/></svg>;
export default function RafiqChat(){
 const {lang}=useI18n(),T=D[lang==='ar'?'ar':'en'];
 const [open,setOpen]=useState(false),[msgs,setMsgs]=useState<Msg[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const end=useRef<HTMLDivElement>(null),inp=useRef<HTMLInputElement>(null),btn=useRef<HTMLButtonElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({block:'end'})},[msgs,busy,open]);
 useEffect(()=>{if(open)setTimeout(()=>inp.current?.focus(),50)},[open]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)});
 // على الموبايل النافذة تغطي الشاشة: نوقف تمرير الصفحة خلفها
 useEffect(()=>{if(!open)return;const m=matchMedia('(max-width:560px)').matches;if(!m)return;const o=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=o}},[open]);
 const close=()=>{setOpen(false);setTimeout(()=>btn.current?.focus(),0)};
 const send=async()=>{
  const v=draft.trim();if(v.length<2||busy)return;
  const prior=msgs.filter(m=>m.who==='me').map(m=>m.text).slice(-4);
  setMsgs(x=>[...x,{who:'me',text:v}]);setDraft('');setErr('');setBusy(true);
  try{
   const {data,error}=await sb.functions.invoke('rafiq-chat',{body:{text:v,history:prior,website:''}});
   if(error){const code=(error as any)?.context?.status;setErr(code===429?T.limit:T.busy);return}
   const d=data as any;
   if(!d||typeof d.text!=='string'){setErr(T.err);return}
   setMsgs(x=>[...x,{who:'rf',text:d.text,next:typeof d.next_step==='string'?d.next_step:undefined,human:!!d.needs_human,src:Array.isArray(d.sources)?d.sources:undefined}]);
  }catch{setErr(T.err)}finally{setBusy(false)}
 };
 const last=[...msgs].reverse().find(m=>m.who==='me')?.text??'';
 const formHref='?view=ask'+(last?'&say='+encodeURIComponent(last.slice(0,600)):'');
 return <div className={`rc${lang==='ar'?' rc-ar':''}`} dir={lang==='ar'?'rtl':'ltr'}>
  {!open&&<button ref={btn} type="button" className="rc-fab" onClick={()=>setOpen(true)} aria-label={T.open} aria-haspopup="dialog"><Eye c="#1b1206"/></button>}
  {open&&<section className="rc-win" role="dialog" aria-modal="true" aria-label={T.name}>
   <header className="rc-head"><span className="rc-av"><Eye c="#1b1206"/></span><div><b>{T.name}</b><small>{T.role}</small></div>
    <button type="button" className="rc-x" onClick={close} aria-label={T.close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
   <div className="rc-log" aria-live="polite">
    <p className="rc-bub rc-rf">{T.hello}</p>
    {msgs.map((m,i)=><div key={i} className={`rc-bub ${m.who==='me'?'rc-me':'rc-rf'}`}>
     {m.text.split('\n').map((l,k)=>l.trim()?<p key={k}>{l}</p>:null)}
     {m.next&&<p className="rc-next">{m.next}</p>}
     {m.src?.map((s,k)=><small key={k} className="rc-src"><em>{T.src}</em> {s.title}{s.name?` · ${s.name}`:''}{s.verified_at?` · ${String(s.verified_at).slice(0,10)}`:''}{s.stale?` · ${T.stale}`:''}</small>)}
     {m.human&&<div className="rc-hand"><p>{T.human}</p><a href={formHref}>{T.form}</a></div>}
    </div>)}
    {busy&&<p className="rc-bub rc-rf rc-wait" role="status">{T.wait}</p>}
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
