import {useState} from 'react';import './kx.css';
// نموذج التطبيق: ست شاشات بنفس لغة العين. البيانات هنا توضيحية وموسومة، وغير مربوطة بالقاعدة بعد.
const N=['اليوم','قل رحلتك','ردّ العين','الموافقة','رحلتي','شاشة القفل'];
const Crown=()=><svg className="kx-crown" viewBox="0 0 28 20" aria-hidden><path d="M2 18 0 5l7 6 7-10 7 10 7-6-2 13z"/></svg>;
const Jet=()=><svg viewBox="0 0 120 40" aria-hidden><path d="M2 20 14 17 40 16 70 3h8L66 16h28l12-7h6l-6 11 6 11h-6L94 24H66l12 13h-8L40 24 14 23z"/></svg>;
const B=({k,children}:{k:'o'|'e'|'m'|'u';children:string})=><span className={`kx-bd ${k}`}>{children}</span>;
export default function AppShell(){
 const [i,setI]=useState(0);const [txt,setTxt]=useState('أربعة أشخاص من جدة إلى الرياض الخميس، اجتماع العاشرة صباحًا، ونعود في اليوم نفسه.');
 const Go=({to,cls='kx-gold',children}:{to:number;cls?:string;children:string})=><button type="button" className={cls} onClick={()=>setI(to)}>{children}</button>;
 return <div className="kx" dir="rtl" lang="ar">
  <p className="kx-note">نموذج التطبيق. الأسماء والأوقات والأرقام أمثلة توضيحية وغير مربوطة بالقاعدة بعد. <a href="?view=ask">الطلب الحقيقي</a></p>
  <div className="kx-chips" role="tablist">{N.map((n,k)=><button key={n} type="button" aria-current={k===i} onClick={()=>setI(k)}>{n}</button>)}</div>
  <div className="kx-phone">
   {i===0&&<section className="kx-s"><div className="kx-brand"><Crown/>iKing</div><h1>مساء الخير، عبدالله</h1><p className="kx-mu">كل شيء هادئ. رحلتك يوم الخميس تحت المراقبة.</p>
    <div className="kx-card"><B k="m">◇ محاكاة</B><p>اقتراح ينتظر ردّك<span className="kx-dot"/></p><p className="kx-mu">هل نقدّم موعد التحرك ساعة بسبب غبار متوقع في الرياض؟</p><Go to={3}>راجع الاقتراح</Go></div>
    <Go to={1} cls="kx-ghost">قل لي رحلتك</Go></section>}
   {i===1&&<section className="kx-s"><h2>قل لي رحلتك</h2><p className="kx-mu">اكتبها أو قُلها بصوتك.</p>
    <textarea aria-label="رحلتك" value={txt} onChange={e=>setTxt(e.target.value)}/>
    <button type="button" className="kx-mic" aria-label="تسجيل صوتي"><svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 19 12z"/></svg></button>
    <Go to={2}>أرسل للعين</Go><p className="kx-mu kx-sm">لا حاجة لحساب لتطلب. بإرسالك توافق على سياسة الخصوصية.</p></section>}
   {i===2&&<section className="kx-s"><h2>ردّ العين</h2>
    <div className="kx-step"><b>رأيتُ</b><B k="m">◇ محاكاة</B><p>طقس جدة والرياض مناسب للطيران يوم الخميس.</p></div>
    <div className="kx-step"><b>أستنتج</b><B k="e">◐ تقدير</B><p>التجارية نحو ٥ ساعات من الباب إلى الباب، والخاصة نحو ٣. وقد تكفيك التجارية إن كان الاجتماع مرنًا.</p></div>
    <div className="kx-step"><b>لا أعرف بعد</b><B k="u">؟ مجهول</B><p>لا أعرف إن كانت هناك طائرة متاحة. هل العودة مرنة؟</p></div>
    <div className="kx-step"><b>هل أرتّب؟</b><p>هل أسأل ثلاثة مشغّلين دون ذكر اسمك؟ لن يصلك شيء قبل موافقتك.</p><Go to={3}>نعم، اسأل المشغّلين</Go></div></section>}
   {i===3&&<section className="kx-s"><h2>موافقتك مطلوبة</h2><p className="kx-mu">لن يحدث شيء قبل لمستك.</p><div className="kx-jet"><Jet/></div>
    <div className="kx-card"><B k="o">◆ مؤكد من المشغّل</B><p className="kx-big">جدة ← الرياض · الخميس</p><p className="kx-mu">تغادر ٦:٣٠ صباحًا وتصل ٧:٤٠. مقاعد لأربعة. العرض صالح حتى الغد ٦ مساءً ثم نعيد التأكد.</p></div>
    <div className="kx-row3"><Go to={4}>نعم</Go><Go to={0} cls="kx-ghost">لا</Go><Go to={1} cls="kx-ghost">عدّل</Go></div></section>}
   {i===4&&<section className="kx-s"><h2>رحلتي</h2><p className="kx-mu">جدة ← الرياض · الخميس</p>
    <div className="kx-tl"><div><B k="o">◆ مؤكد من المشغّل</B><p>الطائرة والموعد</p></div><div><B k="m">◇ محاكاة</B><p>الطقس: غبار خفيف في الرياض صباحًا</p></div><div><B k="e">◐ تقدير</B><p>التوصيل من المطار إلى الفندق نحو ٣٥ دقيقة</p></div></div>
    <div className="kx-card"><p>هل نرتب سيارة تنتظرك عند الوصول؟</p><div className="kx-row3 two"><Go to={5}>نعم</Go><button type="button" className="kx-ghost">لاحقًا</button></div></div></section>}
   {i===5&&<section className="kx-s kx-lock"><div className="kx-clock">٦:٠٢</div><p className="kx-mu">الخميس</p>
    <div className="kx-nt"><small>iKing · الآن</small><p>غبار متوقع في الرياض صباحًا. هل نقدّم التحرك ساعة؟</p></div>
    <div className="kx-nt"><small>iKing · قبل ساعتين</small><p>مشغّل أكّد طائرتك. اضغط للمراجعة والموافقة.</p></div><Go to={0} cls="kx-ghost">ارجع للبداية</Go></section>}
  </div></div>;
}
