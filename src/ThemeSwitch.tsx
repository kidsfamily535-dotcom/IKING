import {useState} from 'react';
// مبدّل الثيم: صحراء زمردية (الافتراضي) / زمردي سيادي / برونزي صحراوي. يُحفظ الاختيار في المتصفح ويُطبَّق قبل الرسم (index.html).
const T=[{k:'ivory',c:'#c5a46d',label:'العاجي الملكي · Royal Ivory'},{k:'desert',c:'#1fcb8b',label:'الصحراء الزمردية · Emerald Desert'},{k:'emerald',c:'#28624c',label:'الزمردي السيادي · Emerald Sovereign'},{k:'bronze',c:'#a87549',label:'البرونزي الصحراوي · Desert Bronze'}];
export default function ThemeSwitch(){
 const [cur,setCur]=useState(()=>document.documentElement.dataset.theme||'ivory');
 const pick=(k:string)=>{document.documentElement.dataset.theme=k;try{localStorage.setItem('iking_theme',k)}catch{}setCur(k)};
 return <div className="th" role="group" aria-label="Theme">{T.map(x=><button key={x.k} type="button" aria-pressed={cur===x.k} aria-label={x.label} title={x.label} style={{['--sw' as any]:x.c}} onClick={()=>pick(x.k)}/>)}</div>;
}
