import {useEffect,useState} from 'react';
import {api} from './data/api';
import type {Airport,MemoryItem,ParsedRequest} from './data/types';
const EX=['أحتاج طائرة من الرياض إلى جدة بكرة الصبح، 5 أشخاص','أحتاج طائرة من دبي إلى الرياض اليوم، 4 ركاب'];
const ITEMS=['الطائرة','الطقس','المطار','النقل الأرضي','المسار'];
const LT=(s:string|number)=><span dir="ltr">{s}</span>;
const dur=(m:number)=>`${Math.floor(m/60)}س ${m%60}د`;
const bz=(t:number,a:number,b:number)=>(1-t)*(1-t)*a+2*(1-t)*t*((a+b)/2)+t*t*b;
export default function JourneyRoom({airports}:{airports:Airport[]}){
 const [txt,setTxt]=useState(''),[p,setP]=useState<ParsedRequest|null>(null),[th,setTh]=useState(false);
 const [mem,setMem]=useState<MemoryItem[]>([]),[ed,setEd]=useState<string|null>(null),[val,setVal]=useState('');
 const [prog,setProg]=useState(0),[play,setPlay]=useState(false),[spd,setSpd]=useState(1),[appr,setAppr]=useState(false),[rev,setRev]=useState(false);
 useEffect(()=>{api.listMemory().then(setMem)},[]);
 useEffect(()=>{if(!play)return;const i=setInterval(()=>setProg(x=>{const n=Math.min(1,x+.002*spd);if(n>=1)setPlay(false);return n}),200);return()=>clearInterval(i)},[play,spd]);
 const send=async(t:string)=>{setTxt(t);setP(null);setTh(true);setP(await api.parseRequest(t));setTh(false)};
 const nm=(c?:string)=>airports.find(a=>a.iata===c)?.nameAr??c;
 const total=95,left=Math.round(total*(1-prog)),dist=Math.round(850*(1-prog)),late=prog>.4;
 const x=bz(prog,80,520),y=bz(prog,170,110)-Math.sin(prog*Math.PI)*60;
 const tl=[['المغادرة من العميل','06:15'],['النقل الأرضي إلى المطار','06:30'],['الوصول إلى مبنى الطيران الخاص','07:00'],['الإقلاع','07:30'],['الهبوط','09:05'],['النقل إلى الوجهة','09:30']];
 return <>
  <section className="sec"><div className="mono">JOURNEY EYE</div><h2>رحلتك تحت المراقبة</h2>
   <div className="nt e"><b>ALL CLEAR</b> · لا شيء يحتاج انتباهك الآن</div>
   <div className="jc">{ITEMS.map(i=><span key={i}>{i} <i style={{color:'var(--ok)'}}>●</i></span>)}</div>
   <div className="cap" style={{textAlign:'start'}}>حالة العناصر محاكاة SIM</div></section>
  <section className="sec"><div className="mono">TELL THE EYE</div><h2>أخبر العين بما تحتاجه</h2>
   <div className="ask"><input aria-label="طلبك" placeholder="أخبر العين بما تحتاجه…" value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&txt.trim()&&send(txt)}/><button disabled={!txt.trim()||th} onClick={()=>send(txt)}>أرسل</button></div>
   <div className="act">{EX.map(e=><button className="g" key={e} onClick={()=>send(e)}>{e}</button>)}</div>
   {th&&<div className="mono">THE EYE IS THINKING<span className="badge b">SIM</span></div>}
   {p&&<><div className="mono" style={{margin:'14px 0 4px'}}>ما فهمته من طلبك</div>
    {[['من',nm(p.origin)],['إلى',nm(p.destination)],['الركاب',p.passengers],['التاريخ',p.when]].map(([k,v])=><div className="row" key={String(k)}><span>{k}</span><span style={{direction:'rtl'}}>{v??'غير محدد'}</span></div>)}
    {p.missing.length>0&&<div className="nt">ينقصني فقط: {p.missing.join('، ')}.</div>}
    {p.options.map(o=><div className="card" key={o.id}><h3>{o.title}</h3>
     <div className="row"><span>الفئة</span><span style={{direction:'rtl'}}>{o.category}</span></div>
     <div className="row"><span>المغادرة</span><span>{LT(o.departure)}</span></div>
     <div className="row"><span>المدة</span><span>{dur(o.durationMin)} <span className="badge b">ESTIMATED</span></span></div>
     <div className="row"><span>التوافر</span><span>غير معروف <span className="badge u">UNKNOWN</span></span></div>
     <div className="row"><span>السعر المرجعي</span><span>{LT(`$${o.priceLo.toLocaleString()}–${o.priceHi.toLocaleString()}`)} <span className="badge b">SIM</span></span></div>
     <small style={{color:'var(--dim)'}}>السعر مرجعي وليس عرضًا. التوافر يحتاج تأكيد المشغّل.</small>
     {o.usesMemory&&<div className="nt">بناءً على تفضيلاتك.</div>}</div>)}</>}
  </section>
  <section className="sec"><div className="mono">YOUR JOURNEY<span className="badge b">SIM</span></div><h2>{LT('RUH → JED')}</h2>
   <div className="radar"><svg viewBox="0 0 600 260"><rect width="600" height="260" fill="#08111f"/>{[1,2,3].map(i=><line key={i} x1="0" x2="600" y1={i*65} y2={i*65} stroke="#f4ecdc" strokeOpacity=".07"/>)}
    <path d="M80,170 Q300,-10 520,110" fill="none" stroke="#c9a961" strokeOpacity=".55"/><circle cx="80" cy="170" r="3" fill="#f4ecdc"/><circle cx="520" cy="110" r="3" fill="#f4ecdc"/>
    <text x="70" y="192" fill="#f4ecdc99" fontSize="10" fontFamily="JetBrains Mono">RUH</text><text x="510" y="132" fill="#f4ecdc99" fontSize="10" fontFamily="JetBrains Mono">JED</text>
    <circle cx={x} cy={y} r="5" fill="#c9a961"/></svg></div>
   <div className="parts" style={{gridTemplateColumns:'repeat(3,1fr)'}}><div><small>التقدّم</small><b>{Math.round(prog*100)}%</b></div><div><small>المتبقي كم</small><b>{dist}</b></div><div><small>الزمن المتبقي</small><b>{left}m</b></div></div>
   <div className="act"><button className="g" onClick={()=>setPlay(!play)}>{play?'إيقاف':'تشغيل'}</button>{[1,3,10].map(s=><button key={s} className={spd===s?'':'g'} onClick={()=>setSpd(s)}>{LT(`×${s}`)}</button>)}</div>
   {late&&<div className="nt"><span className="mono">THE EYE NOTICED<span className="badge b">SIM</span></span><p>الوصول ممكن يتأخر 18–25 دقيقة. العين راجعت النقل الأرضي.</p>
    {!appr&&!rev&&<><p>تعديل مقترح لموعد السائق (تقديري).</p><div className="act"><span className="mono">APPROVAL REQUIRED</span><button onClick={()=>setAppr(true)}>وافق</button><button className="g" onClick={()=>setRev(true)}>راجع</button></div></>}
    {appr&&<p>تمت الموافقة على التعديل (محاكاة). لم يتغير أي حجز حقيقي.</p>}{rev&&<p>تُرك الموعد كما هو لحين مراجعتك.</p>}</div>}
   <div className="mono" style={{margin:'20px 0 4px'}}>WEATHER<span className="badge b">SIM</span></div>
   <div className="row"><span>{LT('OERK')}</span><span>{LT('28010KT 9999 FEW040 31/09')}</span></div><div className="row"><span>{LT('OEJN')}</span><span>{LT('09008KT 8000 SCT030 33/22')}</span></div>
   <div className="mono" style={{margin:'20px 0 8px'}}>DOOR TO DOOR<span className="badge b">ESTIMATED</span></div>
   <ul className="tl" style={{listStyle:'none',padding:0,borderInlineStart:'1px solid var(--gold)',marginInlineStart:6}}>{tl.map(([a,b])=><li key={a} style={{padding:'2px 18px 10px'}}>{a} · {LT(b)}</li>)}</ul>
   <small style={{color:'var(--dim)'}}>كل الأوقات تقديرية ويؤكدها موظف بشري.</small></section>
  <section className="sec"><div className="mono">MEMORY</div><h2>العين بتفتكرك</h2>
   {mem.map(m=><div className="row" key={m.key}><span>{m.labelAr}</span><span style={{direction:'rtl'}}>{ed===m.key?<><input aria-label={m.labelAr} value={val} onChange={e=>setVal(e.target.value)} style={{background:'none',border:0,borderBottom:'1px solid var(--gold)',color:'var(--ink)',font:'inherit',width:130}}/> <button className="g" style={{padding:'2px 12px'}} onClick={async()=>{await api.saveMemory(m.key,val);setMem(await api.listMemory());setEd(null)}}>حفظ</button></>:<>{m.value} <button className="g" style={{padding:'0 10px'}} onClick={()=>{setEd(m.key);setVal(m.value)}}>تعديل</button></>}</span></div>)}
   <small style={{color:'var(--dim)'}}>تُحفظ فقط معلومات قلتها أنت أو من رحلاتك السابقة، وتقدر تعدّلها في أي وقت.</small></section></>;
}
