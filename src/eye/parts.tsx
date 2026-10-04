import type {ReactNode} from 'react';
import {useCopy} from './copy';
import type {Tone} from './day';
// العين الكبيرة: العنصر المميز الوحيد. لونها يتبع أخطر ما عندنا.
export function EyeMark({tone,label}:{tone:Tone;label?:boolean}){
 const cp=useCopy();
 return <div className={`ke-eye t-${tone}`} role="img" aria-label={cp('tone.'+(tone==='calm'?'calm':tone==='risk'?'risk':tone==='watch'?'watch':'opp'))}>
  <span className="ke-ring"/><span className="ke-ring r2"/><i/>{label&&<b>{cp('tone.'+tone)}</b>}</div>;
}
// ما ينقص العين من أمانة: كل معلومة تُعلَّم: بيانات حقيقية أو محاكاة.
export const Truth=({sim}:{sim:boolean})=>{const cp=useCopy();return <span className={`badge ${sim?'b':''}`}>{sim?cp('badge.sim'):cp('badge.live')}</span>};
export function Layer({title,status,desc,children}:{title:string;status:'live'|'sim'|'wait';desc:string;children?:ReactNode}){
 const cp=useCopy();
 return <details className="layer"><summary><span className="lt">{title}</span><span className={`chip s-${status}`}>{cp('s.'+status)}</span></summary>
  <p className="ld">{desc}</p>{children}</details>;
}
// كارت القصة: لاحظت ← لماذا يهم ← راجعت ← أوصي ← إنسان يوافق
export function StoryCard({tone,title,noticed,why,checked,rec,sim,action}:{tone:Tone;title:string;noticed:string;why:string;checked:string[];rec:string;sim?:boolean;action?:ReactNode}){
 const cp=useCopy();
 return <article className={`sc t-${tone}`}>
  <h3>{title}{sim&&<Truth sim/>}</h3>
  <dl>
   <dt>{cp('st.noticed')}</dt><dd>{noticed}</dd>
   <dt>{cp('st.why')}</dt><dd>{why}</dd>
   <dt>{cp('st.checked')}</dt><dd><ul className="ck2">{checked.map(c=><li key={c}>{c}</li>)}</ul></dd>
   <dt>{cp('st.rec')}</dt><dd>{rec}</dd>
  </dl>{action}</article>;
}
