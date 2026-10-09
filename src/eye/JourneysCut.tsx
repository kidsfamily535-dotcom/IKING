import {useState} from 'react';
import './journeys.css';
// صفحة «رحلاتي» (?view=journeys): الرحلة القادمة بطلة، والعين تراقب. محاكاة كاملة بالعربية، لا بيانات حقيقية ولا إرسال.
type Tab='home'|'trips'|'mem'|'agent'|'plan';type P='calm'|'watch'|'act'|'res';
const STOPS:[string,string][]=[['المنزل','السيارة تصل 06:50'],['السيارة','في الطريق إلى المطار'],['المطار','FBO · وصول قبل الإقلاع بـ 30 دقيقة'],['الطائرة','الإقلاع 09:40'],['في الجو','القاهرة إلى باريس'],['الوصول','باريس لو بورجيه'],['السيارة في انتظارك','السائق يتابع موعد الهبوط']];
// الجاهزية = عدد البنود المؤكدة فعلًا من المجموع (ليست درجة غامضة)
const CHK:[string,string,boolean][]=[['الطائرة','أكّدها المشغّل',true],['الطقس','الظروف تبدو متوافقة، والقرار النهائي للمشغّل والطاقم',true],['الأرض','السائق مؤكد',true],['الـ FBO','مؤكد',true],['التصاريح','قيد التأكيد',false]];
const PC:Record<P,[string,string,string,string]>={calm:['var(--calm)','هادئة','العين ساهرة على رحلتك، ولا شيء يستوجب انتباهك الآن.','لا يلزمك أي إجراء.'],watch:['var(--watch)','تحت المراقبة','رصدت العين تغيّرًا في موعد الرحلة.','نعمل على إعداد أفضل بديل.'],act:['var(--act)','يتطلّب قرارك','رصدتُ أمرًا يستحق انتباهك.','أعددتُ خطة بديلة. هل تأذن بعرضها عليك؟'],res:['var(--res)','جرى التعامل معها','جرى التعامل معها.','لا يلزمك اتخاذ أي إجراء.']};
const EX:Record<string,string>={'الطائرة':'طائرة كبيرة المقصورة. أكّدها المشغّل (محاكاة).','المغادرة':'09:40، من صالة الـ FBO. يُرجى الحضور قبلها بنصف ساعة.','الوصول':'باريس لو بورجيه، قرابة 13:20 بالتوقيت المحلي (تقدير).','الأمتعة':'لم تُحدِّد حقائبك بعد. أخبرني بها لأضيفها.','FBO':'استقبال باسمك، والصالة على علم بتفضيلاتك.','السيارة':'سائق في انتظارك عند الوصول، يتابع موعد الهبوط.'};
const WI:[string,string][]=[['ماذا لو غادرنا قبل ساعة؟','يسبق موعدك بنحو ساعة، ويستلزم تأكيد المشغّل والـ FBO قبل اعتماده.'],['ماذا لو استخدمنا مطارًا آخر؟','ممكن، غير أن الوصول إلى السيارة أبعد. أراه أقلّ راحة، ولم أتبيّن التكلفة بعد.'],['ماذا لو اخترنا طائرة أخرى؟','تتبدّل الراحة والسعر، ولا أعرض الفرق قبل ردّ المشغّل.']];
const MEM:[string,string,string][]=[['Paris','2025 · صباحًا','#1b1814,#2a3550'],['Dubai','2025 · عصرًا','#1b1814,#3a3524'],['London','2024','#1b1814,#26394f'],['Geneva','2024','#1b1814,#1f3a40']];
const ASK=['هل الطقس مناسب غدًا؟','هل يمكننا الوصول إلى لندن أبكر؟','رتّب لي سيارة عند الوصول.'];
const NAV:[Tab,string][]=[['home','الرئيسية'],['trips','رحلاتي'],['mem','ذاكرتي'],['agent','الوكيل']];
const answer=(q:string)=>q.includes('الطقس')?'الظروف في باريس تبدو متوافقة مع موعدك (رصد حالي، حُدّث 14:32). القرار النهائي للمشغّل والطاقم.':q.includes('لندن')?'يمكنني البحث عن موعد أبكر، غير أن التوافر مجهول لديّ. سأستوضح الأمر من المشغّل وأوافيك به.':q.includes('سيارة')?'أعددتُ طلب السيارة عند الوصول في صورة مسودة، ويُقرّه فريقنا قبل إرساله.':'فهمتُ. سأتحقق من المصدر الملائم وأعود إليك، وإن لم أعلم فسأصارحك بذلك.';
const pct=()=>Math.round(CHK.filter(x=>x[2]).length/CHK.length*100);
function Ring({p}:{p:P}){const c=2*Math.PI*34;return <div className="ring" style={{['--pc' as string]:PC[p][0]}}><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="#f5f0e82e" strokeWidth="2"/><circle cx="40" cy="40" r="34" fill="none" stroke={PC[p][0]} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct()/100)}/></svg><div className="c"><i/></div></div>}
function Hero({p}:{p:P}){return <section className="scene" aria-label="رحلتك القادمة"><svg className="sky" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#f5f0e8" strokeOpacity=".1"><circle cx="400" cy="400" r="140"/><circle cx="400" cy="400" r="260"/><circle cx="400" cy="400" r="380"/></g><path d="M-20,340 Q260,120 560,200 T840,90" fill="none" stroke="#f5f0e8" strokeOpacity=".5" strokeDasharray="2 9"/></svg>
 <p className="jy-sub">رحلتك القادمة<span className="jy-simtag">محاكاة</span></p><div className="city"><span>CAIRO</span><i>→</i><span>PARIS</span></div><p className="when">18 أكتوبر · 09:40</p>
 <div className="jy-eye"><Ring p={p}/><div><p className="pulse" style={{['--pc' as string]:PC[p][0]}}>{PC[p][1]}</p><p className="say">{PC[p][2]}</p><p className="jy-sub">{PC[p][3]}</p></div></div></section>}
export default function JourneysCut(){
 const [tab,setTab]=useState<Tab>('home'),[t,setT]=useState(2),[p,setP]=useState<P>('calm'),[ex,setEx]=useState<string|null>(null),[wi,setWi]=useState<number|null>(null);
 const [chat,setChat]=useState<['u'|'e',string][]>([]),[plans,setPlans]=useState<string[]>([]),[q,setQ]=useState('');
 const go=(x:Tab)=>{setTab(x);if(x==='home'||x==='plan')setPlans([]);window.scrollTo({top:0})};
 const send=(v:string)=>{v=v.trim();if(!v)return;setChat(c=>[...c,['u',v],['e',answer(v)]]);setQ('')};
 const next:Record<P,[P,string]>={calm:['watch','محاكاة: تأخير في الموعد'],watch:['act','محاكاة: تأكّد التأخير'],act:['res','اعرض الخطة البديلة وأقرّها'],res:['calm','أعد المحاكاة']};
 const input=(ph:string,fn:()=>void)=><div className="jy-ask"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')fn()}} placeholder={ph} aria-label={ph}/><button className="jy-chip" onClick={fn}>أرسل</button></div>;
 const Q=['إلى أين وجهتك؟','متى؟','كم عدد المسافرين؟'];
 return <div className="jy" dir="rtl" lang="ar"><div className="app">
  <div className="nav"><span className="mark">THE KING’S EYE</span><nav aria-label="التنقل">{NAV.map(([k,l])=><button key={k} aria-current={tab===k?'page':undefined} onClick={()=>go(k)}>{l}</button>)}</nav></div>
  <main>
  {tab==='home'&&<><p className="jy-sub" style={{margin:'10px 0 18px'}}>مساء الخير، محمد</p><Hero p={p}/>
   <section className="jy-sec" id="my-trips"><h2>رحلاتي</h2><p className="jy-sub">رحلتك القادمة وذكرى رحلاتك السابقة. وكل رحلة تُفتح بوصفها ذكرى.</p><div className="chips"><button className="jy-chip" onClick={()=>go('trips')}>افتح رحلاتي</button></div><div className="mem">{MEM.map(m=><button key={m[0]} className="m" style={{background:`linear-gradient(170deg,${m[2]})`}} onClick={()=>go('trips')}><b>{m[0]}</b><span>{m[1]}</span></button>)}</div></section>
   <button className="cta f" onClick={()=>go('plan')}>خطط لرحلتك القادمة</button></>}
  {tab==='trips'&&<><div style={{marginTop:10}}><Hero p={p}/></div>
   <section className="jy-sec"><h2>مسار رحلتك</h2><p className="jy-sub">يتحرك مع الوقت. حرّك المؤشر لتتابع تقدّمه.</p><ol className="stops path">{STOPS.map((x,i)=><li key={x[0]} className={i<t?'d':i===t?'n':''}>{x[0]}<small>{x[1]}</small></li>)}</ol><input className="range" type="range" min={0} max={6} value={t} onChange={e=>setT(+e.target.value)} aria-label="الوقت في الرحلة"/></section>
   <section className="jy-sec doing"><h2>العين ساهرة الآن</h2><ul><li>ترصد الطقس في باريس</li><li>تتحقق من موعد الوصول</li><li>تراجع ترتيبات السيارة</li></ul><p className="jy-big">{PC[p][3]}</p>
    <p className="jy-sub" style={{marginTop:12}}>الجاهزية {pct()}%: {CHK.filter(x=>x[2]).length} من {CHK.length} بنود أكّدها أصحابها. {CHK.filter(x=>!x[2]).map(x=>x[0]+' '+x[1]).join('، ')}.</p>
    <div className="chips"><button className="jy-chip" onClick={()=>setP(next[p][0])}>{next[p][1]}</button></div></section>
   <section className="jy-sec"><h2>استكشف رحلتك</h2><div className="chips">{Object.keys(EX).map(x=><button key={x} className="jy-chip" aria-pressed={ex===x} onClick={()=>setEx(ex===x?null:x)}>{x}</button>)}</div><p className="jy-big" style={{minHeight:'2em'}}>{ex?EX[ex]:''}</p></section>
   <section className="jy-sec"><h2>ماذا لو؟</h2><div className="chips">{WI.map((x,i)=><button key={x[0]} className="jy-chip" aria-pressed={wi===i} onClick={()=>setWi(i)}>{x[0]}</button>)}</div><p className="jy-big" style={{minHeight:'2em'}}>{wi!==null?WI[wi][1]:''}</p></section></>}
  {tab==='mem'&&<><h1 style={{marginTop:14}}>ذاكرتي</h1><p className="jy-lead">ما قلتَه لي سابقًا. لا أضيف شيئًا لم تقله.</p><div className="jy-sec">{['أعرف أنك تفضّل المغادرة صباحًا.','أعرف أنك تفضّل مياهًا ساكنة ومقعدًا في مؤخرة المقصورة.','أعرف أنك لا تريد ورودًا في المقصورة.'].map(x=><p key={x} className="line">{x}</p>)}<p className="line">سأستخدمها تلقائيًا في رحلتك القادمة.<small>تعدّلها أو تحذفها متى شئت.</small></p></div></>}
  {tab==='agent'&&<><h1 style={{marginTop:14}}>اسأل العين</h1><div className="chat" aria-live="polite">{chat.length?chat.map((m,i)=><div key={i} className={`b ${m[0]}`}>{m[1]}</div>):<div className="b e">أتابع رحلتك عن كثب. ما الذي تودّ معرفته؟</div>}</div><div className="chips" style={{margin:'0 0 14px'}}>{ASK.map(x=><button key={x} className="jy-chip" onClick={()=>send(x)}>{x}</button>)}</div>{input('اكتب سؤالك',()=>send(q))}</>}
  {tab==='plan'&&<><h1 style={{marginTop:14}}>خطط لرحلتك القادمة</h1><div className="chat">{Q.slice(0,Math.min(plans.length+1,3)).map((x,i)=><div key={x}><div className="b e">{x}</div>{plans[i]&&<div className="b u" style={{marginTop:12}}>{plans[i]}</div>}</div>)}{plans.length>=3&&<div className="b e">فهمتُ: {plans.join('، ')}. سأستعرض العروض وأضع الخيارات بين يديك. ولا أؤكد توافرًا قبل ردّ المشغّل.</div>}</div>
   {plans.length<3&&input('اكتب ردك',()=>{const v=q.trim();if(v){setPlans(a=>[...a,v]);setQ('')}})}</>}
  </main>
  <p className="foot">محاكاة. لا بيانات حقيقية ولا إرسال. الأسماء والأرقام أمثلة توضيحية.</p>
 </div></div>;
}
