import type {ReactNode} from 'react';
import {useI18n} from './i18n';
import './brief.css';
// شريط العروض: بطاقات صغيرة متتابعة كشريط البورصة. لا ندرة مخترعة ولا سعر مشطوب ولا عدّاد مشاهدين.
// كل بطاقة تحمل علامة ثقة صادقة، وتفتح البريف الكامل. الحركة تتوقف باللمس أو التركيز، وتختفي مع تفضيل تقليل الحركة.
export type BriefCard={id:string;route:ReactNode;cabin:string;price:number;currency:string;status:string;until:string};
const T:Record<'ar'|'en',Record<string,string>>={
 ar:{pres:'◐ عرض راجعه فريقنا',wait:'◐ بانتظار تأكيد المشغّل',conf:'◆ مؤكد',closed:'◇ مغلق',till:'صالح حتى',aria:'عروضك'},
 en:{pres:'◐ Reviewed by our team',wait:'◐ Awaiting operator confirmation',conf:'◆ Confirmed',closed:'◇ Closed',till:'Valid until',aria:'Your offers'}};
const KIND:Record<string,'pres'|'wait'|'conf'|'closed'>={PRESENTED:'pres',ACCEPTED:'wait',AWAITING_BOOKING:'wait',CONFIRMED:'conf'};
const TONE={pres:'e',wait:'e',conf:'o',closed:'m'} as const;
export const briefKind=(s:string)=>KIND[s]??'closed';
export function briefLabel(s:string,lang:string){return (T[lang==='ar'?'ar':'en'])[briefKind(s)]}
export default function BriefTicker({cards,sel,onSel,loop,fmt}:{cards:BriefCard[];sel:number;onSel:(i:number)=>void;loop?:boolean;fmt:(iso:string)=>string}){
 const {lang}=useI18n();const L=T[lang==='ar'?'ar':'en'];
 const price=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
 const card=(c:BriefCard,i:number,dup:boolean)=>{const k=briefKind(c.status);
  return <button key={(dup?'d':'')+c.id} type="button" className={`bf-c${i===sel?' on':''}`} aria-pressed={i===sel} tabIndex={dup?-1:0} aria-hidden={dup||undefined} onClick={()=>onSel(i)}>
   <span className={`bf-st ${TONE[k]}`}>{L[k]}</span><span className="bf-rt">{c.route}</span><span className="bf-cb"><bdi>{c.cabin}</bdi></span>
   <span className="bf-pr" dir="ltr">{price(c.price)} <small>{c.currency}</small></span><span className="bf-tl">{L.till} {fmt(c.until)}</span></button>};
 return <div className={`bf-tick${loop?' loop':''}`} role="group" aria-label={L.aria}><div className="bf-track">{cards.map((c,i)=>card(c,i,false))}{loop&&cards.map((c,i)=>card(c,i,true))}</div></div>;
}
