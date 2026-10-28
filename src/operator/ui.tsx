import type {ReactNode} from 'react';
export function Fld({l,v,on,type='text',area,hint}:{l:string;v:string;on:(s:string)=>void;type?:string;area?:boolean;hint?:string}){
 return <label className="skf"><span>{l}</span>{area?<textarea value={v} onChange={e=>on(e.target.value)} rows={2}/>:<input type={type} value={v} onChange={e=>on(e.target.value)}/>}{hint&&<small>{hint}</small>}</label>}
// شارات الحالة بأربع نبرات من لوحة الهوية: مؤكد، تقديري، مجهول، وسلبي. الشكل يحمل المعنى وليس اللون وحده.
export function Chip({tone,children}:{tone:'ok'|'est'|'unk'|'bad';children:ReactNode}){return <span className={`skc ${tone}`}><i aria-hidden="true"/>{children}</span>}
export function Sheet({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 return <div className="sks" role="dialog" aria-label={title}><div className="sks-bar"><h3>{title}</h3><button type="button" className="g" onClick={onClose} aria-label="×">×</button></div>{children}</div>}
export const Empty=({title,text,cta,on}:{title:string;text:string;cta?:string;on?:()=>void})=>
 <div className="ske"><div className="ske-r" aria-hidden="true"><i/><i/><i/><b/></div><h3>{title}</h3><p>{text}</p>{cta&&on&&<button type="button" onClick={on}>{cta}</button>}</div>;
