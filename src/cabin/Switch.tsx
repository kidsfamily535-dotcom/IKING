import './skin.css';
import {useEffect,useRef,useState,type ReactNode} from 'react';
// مفتاح الكابينة: زر على شكل مفتاح on/off. عند اللمس ينزلق الزر الذهبي إلى الطرف الآخر ثم ينفَّذ الفعل.
// يعمل بالكيبورد (Enter/Space) وكأي زر عادي، ويحترم «تقليل الحركة».
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export function Switch({label,sub,onActivate,primary,small,busy,disabled,className=''}:{label:ReactNode;sub?:ReactNode;onActivate:()=>void;primary?:boolean;small?:boolean;busy?:boolean;disabled?:boolean;className?:string}){
 const [on,setOn]=useState(false),t=useRef(0);
 useEffect(()=>()=>clearTimeout(t.current),[]);
 const fire=()=>{if(disabled||on)return;setOn(true);clearTimeout(t.current);
  t.current=window.setTimeout(()=>{onActivate();t.current=window.setTimeout(()=>setOn(false),700)},calm()?0:300)};
 return <button type="button" className={`sw${primary?' primary':''}${small?' small':''} ${className}`.trim()} data-on={on||!!busy} disabled={disabled} aria-busy={busy||undefined} onClick={fire}>
  <span className="sw-k" aria-hidden/><span className="sw-t"><b>{label}</b>{sub?<small>{sub}</small>:null}</span></button>;
}
// خانة الاختيار على شكل مفتاح on/off (يبقى input حقيقيًا لقارئات الشاشة)
export function Toggle({checked,onChange,children}:{checked:boolean;onChange:(v:boolean)=>void;children:ReactNode}){
 return <label className="tg"><input type="checkbox" role="switch" checked={checked} onChange={e=>onChange(e.target.checked)}/><i className="tg-k" aria-hidden/><span>{children}</span></label>;
}
