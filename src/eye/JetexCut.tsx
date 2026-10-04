import {useEffect,useState} from 'react';
import './jetex.css';
import HoldRing from '../Hold';
import {useI18n} from '../i18n';
import {useCopy} from './copy';
// نسخة Jetex (?house=jetex): شاشة محطة واحدة في ليلة واحدة. البطل هو المحطة (FBO) لا الضيف ولا الخريطة.
// كل ما فيها مثال توضيحي معلَّم SIM. لا أرقام مخترعة، والعدّاد يبدأ من صفر.
type Sv='fuel'|'cater'|'ground'|'station'|'concierge';
type S={n:string;code:'DWC'|'LBG';t:string;l:string;g?:string[];r?:string;on:Sv[];f:Sv};
type D={sv:Record<Sv,string>;nm:Record<'DWC'|'LBG',string>;head:string;next:string;again:string;ck:string;cn:string;foot:string;st:S[]};
const X:Record<string,D>={
en:{sv:{fuel:'Fuel',cater:'Catering',ground:'Ground transport',station:'Station request',concierge:'Concierge'},nm:{DWC:'Dubai World Central',LBG:'Paris Le Bourget'},head:'One journey, station by station',next:'Continue',again:'Begin again',
ck:'Activated guests',cn:'Guests who came from an opportunity they were not searching for. The live version starts at zero. No invented number here.',foot:'An illustration for the Jetex house. Not official Jetex material.',st:[
{n:'Concierge',code:'DWC',t:'A guest books a hotel in Paris.',l:'The Eye notices and suggests a flight alongside it, without anyone asking for one.',r:'Prepare a quiet suggestion for the concierge to approve.',on:['concierge'],f:'concierge'},
{n:'Trip file',code:'DWC',t:'The file is ready before the guest arrives.',l:'Station request, catering, ground transfer and fuel are drafted from what the guest has already told us. The team only approves.',g:['Station request — draft','Catering — draft','Ground transfer — draft','Fuel order — draft'],r:'Approve the drafts.',on:['station','cater','ground','fuel'],f:'station'},
{n:'Disruption',code:'DWC',t:'A delay appears. A fallback is already there.',l:'Weather near the arrival airport moves the landing window. The Eye lines up a later slot, tells the driver and the catering team, and hands the decision to a person.',r:'Pass the decision to the duty manager.',on:['ground','station'],f:'ground'},
{n:'Landed',code:'LBG',t:'An aircraft has landed and will stay.',l:'Rather than leave the apron empty, the Eye quietly checks which guests have flown this route before and could use the return.',r:'Quietly check the return opportunity.',on:['station','fuel'],f:'station'},
{n:'Nearby event',code:'LBG',t:'An event is coming near the airport.',l:'The station prepares before the crowd: ground vehicles, catering and a clear arrival path.',r:'Prepare the plan for the team to approve.',on:['ground','cater','station'],f:'ground'}]},
ar:{sv:{fuel:'الوقود',cater:'التموين',ground:'النقل الأرضي',station:'طلب المحطة',concierge:'الكونسيرج'},nm:{DWC:'دبي ورلد سنترال',LBG:'باريس لو بورجيه'},head:'رحلة واحدة، محطة بعد محطة',next:'تابع',again:'من البداية',
ck:'العملاء المنشَّطون',cn:'عملاء جاؤوا من فرصة لم يكونوا يبحثون عنها. النسخة الحية تبدأ من صفر، ولا رقم مخترعًا هنا.',foot:'توضيح لبيت Jetex. وليس مادة رسمية من Jetex.',st:[
{n:'الكونسيرج',code:'DWC',t:'ضيف يحجز فندقًا في باريس.',l:'تلاحظ العين وتقترح رحلة بجانبه، دون أن يطلبها أحد.',r:'جهّز اقتراحًا هادئًا ليوافق عليه الكونسيرج.',on:['concierge'],f:'concierge'},
{n:'ملف الرحلة',code:'DWC',t:'الملف جاهز قبل وصول الضيف.',l:'طلب المحطة والتموين والنقل الأرضي والوقود تُكتب مسودات مما قاله الضيف سابقًا. الفريق يوافق فقط.',g:['طلب المحطة — مسودة','التموين — مسودة','النقل الأرضي — مسودة','طلب الوقود — مسودة'],r:'وافق على المسودات.',on:['station','cater','ground','fuel'],f:'station'},
{n:'خلل',code:'DWC',t:'ظهر تأخير. والبديل جاهز.',l:'يتغيّر الطقس قرب مطار الوصول فتتحرك نافذة الهبوط. تجهّز العين موعدًا لاحقًا، وتُعلم السائق وفريق التموين، وتترك القرار لإنسان.',r:'ارفع القرار إلى مدير المناوبة.',on:['ground','station'],f:'ground'},
{n:'هبوط',code:'LBG',t:'طائرة هبطت وستقف.',l:'بدل أن يبقى الرصيف فارغًا، تفحص العين بهدوء من سافر هذا المسار من قبل وقد يحتاج رحلة الرجوع.',r:'افحص فرصة الرجوع بهدوء.',on:['station','fuel'],f:'station'},
{n:'فعالية قريبة',code:'LBG',t:'فعالية قادمة قرب المطار.',l:'تتجهز المحطة قبل الزحمة: مركبات الأرض، والتموين، ومسار وصول واضح.',r:'جهّز الخطة ليوافق عليها الفريق.',on:['ground','cater','station'],f:'ground'}]},
ru:{sv:{fuel:'Топливо',cater:'Питание',ground:'Трансфер',station:'Запрос станции',concierge:'Консьерж'},nm:{DWC:'Дубай Уорлд Сентрал',LBG:'Париж Ле-Бурже'},head:'Один рейс, станция за станцией',next:'Далее',again:'Сначала',
ck:'Активированные гости',cn:'Гости, пришедшие из возможности, которую они не искали. Живая версия начинается с нуля. Выдуманных цифр здесь нет.',foot:'Иллюстрация для дома Jetex. Не официальный материал Jetex.',st:[
{n:'Консьерж',code:'DWC',t:'Гость бронирует отель в Париже.',l:'Око замечает это и предлагает перелёт, хотя никто о нём не просил.',r:'Подготовить тихое предложение для одобрения консьержем.',on:['concierge'],f:'concierge'},
{n:'Досье рейса',code:'DWC',t:'Досье готово до приезда гостя.',l:'Запрос станции, питание, трансфер и топливо составлены черновиками по тому, что гость говорил раньше. Команде остаётся только одобрить.',g:['Запрос станции — черновик','Питание — черновик','Трансфер — черновик','Заправка — черновик'],r:'Одобрить черновики.',on:['station','cater','ground','fuel'],f:'station'},
{n:'Сбой',code:'DWC',t:'Появилась задержка. Запасной вариант уже готов.',l:'Погода у аэропорта прилёта сдвигает окно посадки. Око подбирает более поздний слот, предупреждает водителя и кейтеринг и передаёт решение человеку.',r:'Передать решение дежурному менеджеру.',on:['ground','station'],f:'ground'},
{n:'Посадка',code:'LBG',t:'Самолёт приземлился и останется.',l:'Чтобы перрон не пустовал, Око тихо проверяет, кто уже летал этим маршрутом и может нуждаться в обратном рейсе.',r:'Тихо проверить возможность обратного рейса.',on:['station','fuel'],f:'station'},
{n:'Событие рядом',code:'LBG',t:'Рядом с аэропортом скоро мероприятие.',l:'Станция готовится до наплыва: наземная техника, питание и свободный подъезд.',r:'Подготовить план для одобрения командой.',on:['ground','cater','station'],f:'ground'}]}};
const POS:Record<Sv,[number,number]>={station:[200,50],concierge:[338,124],cater:[322,300],ground:[200,382],fuel:[62,232]};
const ORDER:Sv[]=['station','concierge','cater','ground','fuel'];
const SW:{l:'ar'|'en'|'ru';label:string}[]=[{l:'ar',label:'العربية'},{l:'en',label:'English'},{l:'ru',label:'Русский'}];
function Apron({d,s}:{d:D;s:S}){
 const [ex,ey]=POS[s.f];
 return <svg className="jx-ap" viewBox="0 0 400 430" role="img" aria-label={d.nm[s.code]}>
  <rect x="14" y="14" width="372" height="402" rx="26" className="jx-pad"/>
  <path d="M200,418 L200,96" className="jx-lead"/>
  <g transform="translate(200 214)" className="jx-jet"><path d="M0,-96C9,-96 11,-70 11,-50L11,70C11,84 6,96 0,104C-6,96 -11,84 -11,70L-11,-50C-11,-70 -9,-96 0,-96Z"/><path d="M-10,-14L-92,34L-92,44L-10,22Z"/><path d="M10,-14L92,34L92,44L10,22Z"/><path d="M-8,78L-36,100L-36,106L-6,96Z"/><path d="M8,78L36,100L36,106L6,96Z"/><rect x="-19" y="54" width="7" height="22" rx="3"/><rect x="12" y="54" width="7" height="22" rx="3"/></g>
  {ORDER.map(k=>{const [x,y]=POS[k],on=s.on.includes(k);return <g key={k} className={`jx-sv${on?' on':''}`} transform={`translate(${x} ${y})`}>
   <circle r="17" className="jx-halo"/><circle r="7" className="jx-dot"/>
   <text y="34" textAnchor="middle">{d.sv[k]}</text></g>})}
  <g className="jx-eye" style={{transform:`translate(${ex}px,${ey}px)`}} role="img" aria-label="The King’s Eye"><circle r="14"/><circle r="4"/></g>
 </svg>;
}
export default function JetexCut(){
 const {lang,setLang}=useI18n();const cp=useCopy();const d=X[lang]??X.en;
 const [i,setI]=useState(0),[done,setDone]=useState<number[]>([]);
 useEffect(()=>{const p=document.body.style.background;document.body.style.background='#F4F1E8';return()=>{document.body.style.background=p}},[]);
 const n=d.st.length,s=d.st[i],last=i===n-1,ok=done.includes(i),cur=lang==='ar'||lang==='ru'?lang:'en';
 return <main className="jx">
  <header className="jx-bar"><span className="jx-mark">The King’s Eye <i>· Jetex</i></span>
   <div className="jx-tg" role="group">{SW.map(o=><button key={o.l} className={cur===o.l?'on':''} aria-pressed={cur===o.l} lang={o.l} onClick={()=>setLang(o.l)}>{o.label}</button>)}</div></header>
  <p className="jx-who">{d.head}<span className="jx-sim">{cp('badge.sim')}</span></p>
  <nav className="jx-steps" aria-label={d.head}>{d.st.map((x,k)=><button key={x.n} className={`jx-s${k===i?' on':''}${k<i?' past':''}`} aria-current={k===i} onClick={()=>setI(k)}><b>{x.code}</b><span>{x.n}</span></button>)}</nav>
  <section className="jx-main" key={i}>
   <div className="jx-txt">
    <p className="jx-code" dir="ltr">{s.code}</p><p className="jx-nm">{d.nm[s.code]}</p>
    <h1>{s.t}</h1><p className="l">{s.l}</p>
    {s.g&&<ul className="jx-g">{s.g.map(g=><li key={g}>{g}</li>)}</ul>}
    {s.r&&<div className="jx-rec"><p>{s.r}</p>{ok?<p className="jx-ok" role="status">{cp('st.draft')}</p>:<div className="jx-act"><HoldRing onDone={()=>setDone(v=>[...v,i])}/><span>{cp('st.approve')}</span></div>}</div>}
    <div className="jx-nav"><button onClick={()=>setI(last?0:i+1)}>{last?d.again:d.next}</button></div>
   </div>
   <Apron d={d} s={s}/>
  </section>
  <aside className="jx-ctr"><div><b dir="ltr">0</b><span>{d.ck}</span></div><p>{d.cn}</p></aside>
  <p className="jx-foot">{cp('day.sim')} {d.foot}</p>
 </main>;
}
