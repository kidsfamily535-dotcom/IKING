import {useMemo,useState} from 'react';
import './cinema.css';import './request.css';import './discover.css';import './think.css';
import {useI18n} from '../i18n';
import LangSwitch from '../LangSwitch';
import TopBar from './TopBar';
// «شاهد كيف تفكر العين»: صفحة ترويجية واحدة لقدرات العين. محاكاة توضيحية بالكامل: لا بحث حقيقي ولا تحقق من مصدر ولا اتصال بمشغّل.
// بصمة المهمة هنا توجّه ترتيب الخيارات التوضيحية فقط. لا أسماء طائرات ولا أسعار ولا توفر.
type Lg='ar'|'en';
const AX=['time','privacy','comfort','baggage','flex','family','ground'] as const;
type Ax=typeof AX[number];
const MS=['business','family','event','urgent','delegation','multi','other'] as const;
type Ms=typeof MS[number];
const DEF:Record<Ms,Ax[]>={business:['time','flex'],family:['comfort','family'],event:['time','comfort'],urgent:['time','flex'],delegation:['privacy','ground'],multi:['flex','baggage'],other:[]};
// أربعة أنماط عامة من الخيارات (لا نماذج طائرات). الدرجات توضيحية.
const OPT:{k:string;s:Record<Ax,number>}[]=[
 {k:'a',s:{time:3,privacy:2,comfort:1,baggage:1,flex:2,family:1,ground:2}},
 {k:'b',s:{time:2,privacy:2,comfort:2,baggage:2,flex:2,family:2,ground:2}},
 {k:'c',s:{time:1,privacy:3,comfort:3,baggage:3,flex:1,family:3,ground:2}},
 {k:'d',s:{time:2,privacy:1,comfort:2,baggage:2,flex:3,family:1,ground:3}}];
const T:Record<Lg,any>={
 ar:{name:'عين الملك',sim:'محاكاة توضيحية — ليست بيانات تشغيلية حقيقية',
  h:'العين لا تبحث عن طائرة فحسب؛ بل تبحث عن الخيار الأنسب للمهمة.',s:'ذكاء الطيران الخاص، من اكتشاف الفرصة إلى مرافقة الرحلة.',
  loop:['راقب','افهم','تحقّق','اقترح','اعرض للموافقة','تابع','تعلّم'],
  ih:'داخل عقل العين',ihs:'انتقل بين المراحل لترى كيف تصل العين إلى توصيتها.',
  f:['ما الذي تحاول العين تحقيقه','ما المعلومات التي تحتاج إليها','النتيجة المتوقعة','ما الذي لم يُحسم','الخطوة التالية'],
  st:[
   ['افهم المهمة',['تفهم سبب الرحلة لا وجهتها فقط: ما الذي يجعلها مهمة لك.','كلامك أنت: نوع المهمة، الموعد، عدد المسافرين، وما لا يمكن التفريط فيه.','ملخص مهمة واضح تقرّه بنفسك.','ما لم تقله بعد؛ لا تفترضه العين.','الانتقال إلى البحث بعد أن تؤكد أنت فهمها.']],
   ['ابحث عن الخيارات',['ترشيح أنواع طائرات ومسارات تناسب المهمة، لا الأرخص ولا الأقرب فحسب.','المسار، والسعة، والأمتعة، وقيود التشغيل. ويتغير الترتيب بحسب بصمة مهمتك أدناه.','من ثلاثة إلى خمسة خيارات مع سبب ترشيح كل خيار.','التوفر الفعلي والسعر.','التحقق مما يمكن إثباته.']],
   ['تحقق من المعلومات',['التفريق بين المؤكد والتقدير والمجهول.','مصدر كل معلومة ووقت التحقق منها.','كل معلومة بحالتها: مؤكد، تقدير، محاكاة، أو مجهول.','ما لم يؤكده المشغّل يبقى غير مؤكد.','بناء التوصية على المثبت فقط.']],
   ['ابنِ التوصية',['توصية واحدة مفهومة مع بدائلها.','نتائج التحقق وأولوياتك.','توصية بأسبابها وبما تتنازل عنه.','القرار النهائي ليس للعين.','عرضها عليك.']],
   ['اعرض القرار للموافقة',['ألا يتحرك شيء بلا إذنك.','موافقتك الصريحة، ومراجعة إنسان من الفريق.','مسودة طلب جاهزة، لا تُرسَل قبل موافقتك.','تأكيد المشغّل للتوفر والسعر.','تبدأ المتابعة بعد موافقتك.']],
   ['تابع الرحلة',['البقاء منتبهة لما قد يتغير قبل الرحلة وأثناءها.','رحلة مؤكدة تُربط بمصادر الطقس والمطارات.','تنبيه فور أي تغيير يخصك، مع بديل مقترح بموافقتك.','لا مراقبة حقيقية قبل وجود رحلة مؤكدة.','تتعلم من النتيجة، ولا تحفظ إلا ما صرّحت به أنت.']]],
  ms:'بصمة المهمة',msq:'ما الذي يجعل هذه الرحلة مهمة بالنسبة إليك؟',
  mt:{business:'أعمال واجتماعات',family:'رحلة عائلية',event:'مناسبة خاصة',urgent:'رحلة عاجلة',delegation:'وفد أو مجموعة تنفيذية',multi:'رحلة متعددة الوجهات',other:'مهمة أخرى'},
  mg:{business:'رحلة عمل',family:'رحلة عائلية',event:'مناسبة خاصة',urgent:'رحلة عاجلة',delegation:'وفد تنفيذي',multi:'رحلة متعددة الوجهات',other:'مهمة تحددها أنت'},
  mf:{business:'ملاءمة الطائرة، والتوقيت، والقيود التشغيلية.',family:'راحة الركاب، وسعة الأمتعة، وسلاسة الوصول.',event:'الوصول قبل الموعد بهامش مريح.',urgent:'أسرع مسار ممكن، وبدائل جاهزة إن تغيّر شيء.',delegation:'الخصوصية، وتنسيق الاستقبال، وسعة المجموعة.',multi:'ترتيب المحطات، والمرونة بين الأقدام.',other:'أنت من يحدد ما يهم، والعين تبني عليه.'},
  pq:'ما أولوياتك؟ اختر حتى ثلاث.',
  ax:{time:'الوقت',privacy:'الخصوصية',comfort:'الراحة',baggage:'سعة الأمتعة',flex:'المرونة',family:'متطلبات العائلة',ground:'تنسيق الخدمات الأرضية'},
  goal:'الهدف',pri:'الأولوية',focus:'التركيز',none:'اختر أولوية لترى الترتيب يتغير.',
  rk:'ترتيب الخيارات التوضيحي',rkn:'أنماط عامة للخيارات، لا نماذج طائرات ولا أسعار ولا توفر.',
  on:{a:'خفيفة وسريعة',b:'متوسطة متوازنة',c:'واسعة الكابينة',d:'مرنة متعددة المحطات'},
  note:'هذه البصمة توجّه التوصيات في هذه التجربة فقط. واستخدامها في رحلات حقيقية يتطلب ربطها بمنظومة التحليل الفعلية.',
  end:'لقد رأيت ما تستطيعه العين. الآن، أخبرها بما تحتاج إليه.',cta:'ابدأ رحلتك'},
 en:{name:'The King’s Eye',sim:'Illustrative simulation — not real operational data',
  h:'The Eye does not just look for an aircraft; it looks for the option that best fits the mission.',s:'Private aviation intelligence, from spotting the opportunity to accompanying the journey.',
  loop:['Watch','Understand','Verify','Propose','Ask approval','Follow','Learn'],
  ih:'Inside the Eye',ihs:'Move between the stages to see how the Eye reaches its recommendation.',
  f:['What the Eye is trying to achieve','What it needs to know','Expected outcome','What is not yet settled','Next step'],
  st:[
   ['Understand the mission',['It understands why you travel, not only where: what makes this trip matter to you.','Your own words: type of mission, date, number of travellers, and what cannot be compromised.','A clear mission summary that you confirm yourself.','Whatever you have not said; the Eye does not assume it.','Moving on to the search once you confirm it understood.']],
   ['Search the options',['Shortlisting aircraft types and routes that fit the mission, not just the cheapest or the closest.','Route, capacity, baggage and operating limits. The ranking shifts with your mission signature below.','Three to five options, each with the reason it was picked.','Real availability and price.','Verifying what can be proven.']],
   ['Verify the information',['Telling confirmed from estimated from unknown.','The source of each fact and when it was checked.','Each fact with its status: confirmed, estimate, simulation or unknown.','Anything the operator has not confirmed stays unconfirmed.','Building the recommendation only on what is verified.']],
   ['Build the recommendation',['One understandable recommendation, with its alternatives.','The verification results and your priorities.','A recommendation with its reasons and what you trade off.','The final decision is not the Eye’s.','Presenting it to you.']],
   ['Put the decision to you',['Nothing moves without your permission.','Your explicit approval and a review by a person on the team.','A ready draft request, not sent before you approve.','The operator’s confirmation of availability and price.','Follow-up begins after you approve.']],
   ['Follow the journey',['Staying alert to what may change before and during the trip.','A confirmed trip tied to weather and airport sources.','An alert as soon as something that concerns you changes, with an alternative you approve.','No real monitoring until a confirmed trip exists.','Learning from the outcome, keeping only what you stated.']]],
  ms:'Mission signature',msq:'What makes this trip matter to you?',
  mt:{business:'Business and meetings',family:'Family trip',event:'Special occasion',urgent:'Urgent trip',delegation:'Delegation or executive group',multi:'Multi-destination trip',other:'Another mission'},
  mg:{business:'Business trip',family:'Family trip',event:'Special occasion',urgent:'Urgent trip',delegation:'Executive delegation',multi:'Multi-destination trip',other:'A mission you define'},
  mf:{business:'Aircraft fit, timing and operating limits.',family:'Passenger comfort, baggage capacity and a smooth arrival.',event:'Arriving ahead of the time with a comfortable margin.',urgent:'The fastest possible route, with alternatives ready.',delegation:'Privacy, reception coordination and group capacity.',multi:'Ordering the stops and flexibility between legs.',other:'You decide what matters, the Eye builds on it.'},
  pq:'What are your priorities? Pick up to three.',
  ax:{time:'Time',privacy:'Privacy',comfort:'Comfort',baggage:'Baggage capacity',flex:'Flexibility',family:'Family needs',ground:'Ground coordination'},
  goal:'Goal',pri:'Priority',focus:'Focus',none:'Pick a priority to see the ranking change.',
  rk:'Illustrative option ranking',rkn:'Generic option types: no aircraft models, prices or availability.',
  on:{a:'Light and fast',b:'Balanced mid-size',c:'Wide cabin',d:'Flexible multi-stop'},
  note:'This signature guides recommendations in this experience only. Using it on real trips requires connecting it to the real analysis system.',
  end:'You have seen what the Eye can do. Now tell it what you need.',cta:'Start your trip'}};
const P=(i:number,v:number,n=7):[number,number]=>{const a=-Math.PI/2+i/n*2*Math.PI,r=22+v*66;return[100+r*Math.cos(a),100+r*Math.sin(a)]};
export default function Think(){
 const {lang}=useI18n(),lg:Lg=lang==='ar'?'ar':'en',c=T[lg],ar=lang==='ar';
 const [i,setI]=useState(0),[m,setM]=useState<Ms>('business'),[pr,setPr]=useState<Ax[]>(DEF.business);
 const pick=(k:Ms)=>{setM(k);setPr(DEF[k])};
 const tog=(a:Ax)=>setPr(p=>p.includes(a)?p.filter(x=>x!==a):p.length>=3?p:[...p,a]);
 const rank=useMemo(()=>OPT.map((o,n)=>({...o,n,v:pr.reduce((t,a)=>t+o.s[a],0)})).sort((a,b)=>pr.length?b.v-a.v||a.n-b.n:a.n-b.n),[pr]);
 const mx=Math.max(1,pr.length*3);
 const pts=AX.map((a,n)=>P(n,pr.includes(a)?1:.12)),path='M'+pts.map(p=>p.map(x=>x.toFixed(1)).join(',')).join(' L')+' Z';
 const st=c.st[i];
 return <div className={`dc th cn${ar?' ar':''}`} dir={ar?'rtl':'ltr'} lang={lang}>
  <div className="rq-bg" aria-hidden="true"/><div className="cn-shade" aria-hidden="true"/><div className="cn-grain" aria-hidden="true"/>
  <LangSwitch/><TopBar active={1} name={c.name}/>
  <main className="dc-main">
   <section className="th-hero">
    <span className="th-badge">{c.sim}</span>
    <h1>{c.h}</h1><p className="dc-s">{c.s}</p>
    <ol className="th-loop" aria-label="loop">{c.loop.map((x:string)=><li key={x}>{x}</li>)}</ol>
   </section>
   <section className="th-in" aria-labelledby="th-ih">
    <h2 id="th-ih">{c.ih}</h2><p className="th-sub">{c.ihs}</p>
    <div className="th-rail" role="tablist" aria-label={c.ih}>{c.st.map((s:any,n:number)=><button key={n} type="button" role="tab" aria-selected={n===i} className={n===i?'on':n<i?'past':''} onClick={()=>setI(n)}><span>{String(n+1).padStart(2,'0')}</span><b>{s[0]}</b></button>)}</div>
    <div className="th-panel" role="tabpanel" key={i}>
     <h3><span>{String(i+1).padStart(2,'0')}</span>{st[0]}</h3>
     <dl>{c.f.map((q:string,n:number)=><div key={n}><dt>{q}</dt><dd>{st[1][n]}</dd></div>)}</dl>
    </div>
   </section>
   <section className="th-ms" aria-labelledby="th-ms">
    <h2 id="th-ms"><small>MISSION SIGNATURE</small>{c.ms}</h2>
    <p className="th-q">{c.msq}</p>
    <div className="th-chips" role="group" aria-label={c.msq}>{MS.map(k=><button key={k} type="button" aria-pressed={m===k} onClick={()=>pick(k)}>{c.mt[k]}</button>)}</div>
    <p className="th-q">{c.pq}</p>
    <div className="th-chips" role="group" aria-label={c.pq}>{AX.map(a=><button key={a} type="button" aria-pressed={pr.includes(a)} onClick={()=>tog(a)}>{c.ax[a]}</button>)}</div>
    <div className="th-sig">
     <div className="th-card">
      <svg viewBox="0 0 200 200" aria-hidden="true">
       {[.33,.66,1].map(r=><circle key={r} cx="100" cy="100" r={22+r*66} fill="none" stroke="currentColor" strokeOpacity=".14"/>)}
       {AX.map((a,n)=>{const e=P(n,1);return <line key={a} x1="100" y1="100" x2={e[0]} y2={e[1]} stroke="currentColor" strokeOpacity=".16"/>})}
       <path className="th-poly" d={path} />
       {AX.map((a,n)=>{const e=P(n,pr.includes(a)?1:.12);return <circle key={a} cx={e[0]} cy={e[1]} r={pr.includes(a)?3.2:1.6} className={pr.includes(a)?'on':''}/>})}
      </svg>
      <div className="th-cap"><small>MISSION SIGNATURE — {m.toUpperCase()}</small>
       <p><b>{c.goal}:</b> {c.mg[m]}</p>
       <p><b>{c.pri}:</b> {pr.length?pr.map(a=>c.ax[a]).join(ar?'، ':', '):'—'}</p>
       <p><b>{c.focus}:</b> {c.mf[m]}</p></div>
     </div>
     <div className="th-rank">
      <h3>{c.rk}</h3><p className="th-rn">{c.rkn}</p>
      <ol>{rank.map((o,n)=><li key={o.k} style={{['--o' as string]:n}}><span className="th-n">{n+1}</span><b>{c.on[o.k]}</b><i><u style={{width:`${pr.length?Math.round(o.v/mx*100):0}%`}}/></i></li>)}</ol>
      {!pr.length&&<p className="th-rn">{c.none}</p>}
     </div>
    </div>
    <p className="th-note">{c.note}</p>
   </section>
   <section className="th-end"><p>{c.end}</p><a className="cn-btn main" href="?view=cabin">{c.cta}</a></section>
  </main>
  <footer className="dc-foot"><span className="dc-dot"/>{c.sim}</footer>
 </div>;
}
