import {useMemo,useRef,useState} from 'react';
import '../cabin/cabin.css';import './ask-eye.css';
import {sb} from '../lib/supabase';
import {useI18n,LANGS,type Lang} from '../i18n';
import SECS from './askQuestions.json';
// «اسأل العين»: كل الأسئلة المتوقعة (210 سؤالًا في 12 قسمًا من ملف IKING_client_questions) جاهزة للضغط، وسؤال حر.
// الرد يأتي من دالة ask_eye في القاعدة (حتمية، قراءة فقط، بلا نموذج لغوي): الحالة + المصدر + التاريخ + خطوة واحدة.
// الواجهة لا تؤلّف إجابة ولا تقول «آمن»: تعرض ما رجعت به القاعدة كما هو، وتكتب «غير معروف يحتاج تحققًا» عند الفشل.
type Fact={region_code:string;level:number;level_name:string;verification:string;verified_at:string;stale:boolean};
type Ans={intent:string;answer_type:'ANSWER'|'PARTIAL'|'UNKNOWN'|'HANDOFF'|'REFERRAL';text_ar:string;next_step_ar:string;needs_human:boolean;facts?:Fact[];generated_at:string};
type Err=''|'auth'|'bad'|'net';
const KIND:Record<Ans['answer_type'],string>={ANSWER:'ok',PARTIAL:'warn',UNKNOWN:'warn',HANDOFF:'blue',REFERRAL:'blue'};
export default function AskEye(){
 const {t,lang,setLang}=useI18n();
 const [sec,setSec]=useState(0),[draft,setDraft]=useState(''),[asked,setAsked]=useState(''),[ans,setAns]=useState<Ans|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState<Err>('');
 const box=useRef<HTMLInputElement>(null),out=useRef<HTMLElement>(null);
 const D=lang==='ar'?'rtl':'ltr';
 const dt=(s:string)=>new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));
 const all=useMemo(()=>SECS.flatMap(s=>s.qs.map(q=>({q,s:s.id}))),[]);
 const hits=useMemo(()=>{const v=draft.trim();return v.length<2?[]:all.filter(x=>x.q.includes(v)).slice(0,6)},[draft,all]);
 const ask=async(text:string)=>{
  const q=text.trim();if(q.length<2||q.length>500||busy)return;
  setBusy(true);setErr('');setAns(null);setAsked(q);setDraft('');
  try{
   const {data,error}=await sb.rpc('ask_eye',{p_question:q});
   if(error){setErr(error.code==='42501'||/not authorized/i.test(error.message)?'auth':/invalid question/i.test(error.message)?'bad':'net');return}
   setAns(data as Ans);
   requestAnimationFrame(()=>out.current?.scrollIntoView({behavior:'smooth',block:'nearest'}));
  }catch{setErr('net')}finally{setBusy(false)}
 };
 const cur=SECS[sec];
 return <div className="cb ae" data-phase={0} dir={D} lang={lang}>
  <header className="cb-top"><span className="cb-brand">THE KING'S EYE</span>
   <div className="cb-lang" role="group" aria-label="Language">{LANGS.map(l=><button key={l} type="button" lang={l} aria-pressed={lang===l} onClick={()=>setLang(l as Lang)}>{l.toUpperCase()}</button>)}</div></header>
  <main className="ae-wrap">
   <h1>{t('aye.title')}</h1><p className="cb-sub">{t('aye.sub')}</p>
   <form className="ae-form" onSubmit={e=>{e.preventDefault();ask(draft)}}>
    <input ref={box} className="ae-in" type="text" maxLength={500} value={draft} placeholder={t('aye.ph')} aria-label={t('aye.title')} onChange={e=>setDraft(e.target.value)} enterKeyHint="send"/>
    <button type="submit" className="cb-cta" disabled={busy||draft.trim().length<2}>{t('aye.go')}</button>
   </form>
   {hits.length>0&&<ul className="ae-hits" aria-label={t('aye.matches')}>{hits.map(h=><li key={h.q}><button type="button" onClick={()=>ask(h.q)}>{h.q}</button></li>)}</ul>}
   <section ref={out} className="ae-out" aria-live="polite" aria-busy={busy}>
    {busy&&<p className="cb-eye"><i aria-hidden/>{t('aye.reading')}</p>}
    {err==='auth'&&<div className="ae-card"><p className="cb-note" role="alert">{t('aye.auth')}</p><a className="cb-link" href="?view=ask">{t('aye.register')}</a></div>}
    {err==='bad'&&<p className="cb-note" role="alert">{t('aye.bad')}</p>}
    {err==='net'&&<p className="cb-note" role="alert">{t('aye.net')}</p>}
    {ans&&<article className="ae-card">
     <p className="ae-q">{asked}</p>
     <span className={`ae-badge ${KIND[ans.answer_type]}`}>{t('aye.type.'+ans.answer_type)}</span>
     <p className="ae-text">{ans.text_ar}</p>
     {!!ans.facts?.length&&<ul className="ae-facts">{ans.facts.map(f=><li key={f.region_code} className={f.stale?'stale':''}><b>{f.region_code}</b> · {t('aye.level',{n:f.level})} · {t('aye.v.'+f.verification)} · {f.stale?t('aye.stale'):t('aye.verified',{d:dt(f.verified_at)})}</li>)}</ul>}
     {ans.needs_human&&<p className="cb-note">{t('aye.human')}</p>}
     <p className="ae-next">{ans.next_step_ar}</p>
     <small className="ae-gen">{t('aye.generated',{d:dt(ans.generated_at)})}</small>
    </article>}
   </section>
   <nav className="ae-tabs" aria-label={t('aye.sections')}>{SECS.map((s,i)=><button key={s.id} type="button" aria-pressed={i===sec} onClick={()=>setSec(i)}>{s.title}</button>)}</nav>
   <ul className="ae-qs">{cur.qs.map(q=><li key={q}><button type="button" disabled={busy} onClick={()=>ask(q)}>{q}</button></li>)}</ul>
  </main>
 </div>;
}
