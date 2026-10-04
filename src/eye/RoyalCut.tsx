import {useEffect,useState} from 'react';
import './royal.css';
import HoldRing from '../Hold';
import {useI18n} from '../i18n';
import {useCopy} from './copy';
// نسخة Royal Jet (?house=royaljet): خيط رحلة واحد بدل الرادار. محاكاة كاملة، بلغة التجربة لا الإيراد.
// كل ما في القصة مثال توضيحي معلَّم SIM. التفضيلات فيها مما قاله الضيف نفسه فقط.
type S={n:string;t:string;l:string;g?:string[];r?:string};
type D={op:string;guest:string;head:[string,string];route:string;next:string;again:string;st:S[]};
const X:Record<string,D>={
en:{op:'Operator',guest:'Guest',head:["Tonight’s guest",'Your journey'],route:'Abu Dhabi to Paris',next:'Continue',again:'Begin again',st:[
{n:'Before',t:'A journey may be forming.',l:'This guest has flown Abu Dhabi to Paris about once a month. The next one is likely within two weeks.',r:'Quietly check which aircraft could work.'},
{n:'Preferences',t:'Nothing to ask twice.',l:'Everything the guest has told us before travels with them.',g:['Still water','Rear cabin seating','No flowers','Wi-Fi on board']},
{n:'Lounge',t:'The lounge already knows.',l:'The team receives the guest’s preferences before the car arrives.',g:['Driver confirmed','Welcome by name','A fast, private arrival']},
{n:'Cabin',t:'The cabin is set before boarding.',l:'The aircraft is prepared around what was asked for, not what is usual.',g:['Seat layout','Temperature','A meal from the guest’s own list']},
{n:'Flight',t:'I am watching, quietly.',l:'Weather over Paris is steady in the arrival window. Nothing needs attention.'},
{n:'Arrival',t:'The car and the flight agree.',l:'If the landing moves, the driver moves with it.'},
{n:'Beyond',t:'A taste of Paris, waiting.',l:'A small box from the city arrives before the flight, and one place the guest may not know.',r:'Prepare the suggestion for the team to approve.'}]},
ar:{op:'المشغّل',guest:'الضيف',head:['ضيف الليلة','رحلتك'],route:'أبوظبي إلى باريس',next:'تابع',again:'من البداية',st:[
{n:'قبل',t:'رحلة قد تتشكّل.',l:'هذا الضيف سافر من أبوظبي إلى باريس مرة كل شهر تقريبًا. والرحلة القادمة غالبًا خلال أسبوعين.',r:'افحص بهدوء أي طائرة تناسب.'},
{n:'التفضيلات',t:'لا شيء يُسأل مرتين.',l:'كل ما قاله الضيف سابقًا يسافر معه.',g:['ماء ساكن','مقعد في مؤخرة المقصورة','بلا ورد','إنترنت على متن الطائرة']},
{n:'الصالة',t:'الصالة تعرفه قبل أن يصل.',l:'يصل الفريقَ تفضيلاتُ الضيف قبل وصول السيارة.',g:['السائق مؤكد','استقبال بالاسم','وصول سريع وخاص']},
{n:'المقصورة',t:'المقصورة جاهزة قبل الصعود.',l:'تُجهَّز الطائرة على ما طلبه الضيف، لا على المعتاد.',g:['توزيع المقاعد','الحرارة','وجبة من قائمة الضيف نفسه']},
{n:'الرحلة',t:'أراقب بهدوء.',l:'الطقس فوق باريس مستقر في نافذة الوصول. لا شيء يحتاج انتباهك.'},
{n:'الوصول',t:'السيارة والرحلة على اتفاق.',l:'إن تغيّر موعد الهبوط يتحرك السائق معه.'},
{n:'بعد',t:'طعم باريس ينتظره.',l:'صندوق صغير من المدينة يصل قبل الرحلة، ومكان واحد قد لا يعرفه الضيف.',r:'جهّز الاقتراح ليوافق عليه الفريق.'}]}};
export default function RoyalCut(){
 const {lang,setLang}=useI18n();const cp=useCopy();const d=X[lang]??X.en;
 const [i,setI]=useState(0),[done,setDone]=useState<number[]>([]),[guest,setGuest]=useState(false);
 useEffect(()=>{const p=document.body.style.background;document.body.style.background='#ECEDEA';return()=>{document.body.style.background=p}},[]);
 const n=d.st.length,s=d.st[i],last=i===n-1,rec=!guest&&s.r,ok=done.includes(i);
 return <main className="rj">
  <header className="rj-bar"><span className="rj-mark">The King’s Eye</span>
   <div className="rj-tg" role="group">
    <button className={guest?'':'on'} onClick={()=>setGuest(false)}>{d.op}</button><button className={guest?'on':''} onClick={()=>setGuest(true)}>{d.guest}</button>
    <button className={lang==='ar'?'on':''} onClick={()=>setLang('ar')} lang="ar">العربية</button><button className={lang!=='ar'?'on':''} onClick={()=>setLang('en')}>English</button></div></header>
  <p className="rj-who">{d.head[guest?1:0]} · {d.route}<span className="rj-sim">{cp('badge.sim')}</span></p>
  <div className="rj-th" role="group" style={{['--p' as string]:i/(n-1)}}>
   <span className="rj-ln"/><span className="rj-fill"/>
   {d.st.map((x,k)=><button key={x.n} className={`rj-n${k<i?' past':''}${k===i?' on':''}`} style={{['--p' as string]:k/(n-1)}} onClick={()=>setI(k)} aria-current={k===i} aria-label={x.n}><i/><span>{x.n}</span></button>)}
   <span className="rj-eye" role="img" aria-label="The King’s Eye"><i/></span>
  </div>
  <article className="rj-st" key={i} aria-live="polite">
   <h1>{s.t}</h1><p className="l">{s.l}</p>
   {s.g&&<ul className="rj-g">{s.g.map(g=><li key={g}>{g}</li>)}</ul>}
   {rec&&<div className="rj-rec"><p>{s.r}</p>{ok?<p className="rj-ok" role="status">{cp('st.draft')}</p>:<div className="rj-act"><HoldRing onDone={()=>setDone(v=>[...v,i])}/><span>{cp('st.approve')}</span></div>}</div>}
   <div className="rj-nav"><button onClick={()=>setI(last?0:i+1)}>{last?d.again:d.next}</button></div>
  </article>
  <p className="rj-foot">{cp('day.sim')}</p>
 </main>;
}
