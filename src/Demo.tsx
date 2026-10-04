import {useEffect,useState} from 'react';
import HoldRing from './Hold';
import type {AgentState} from './data/types';
const S:{st:AgentState;t:string;gate?:boolean}[]=[
{st:'WATCHING',t:'العين تراقب حركة الطيران في الخليج'},
{st:'DISCOVERING',t:'ظهرت إشارة طلب ضعيفة (D): فعالية أعمال في الرياض'},
{st:'DISCOVERING',t:'المشغّل أضاف رحلة فاضية RUH → JED'},
{st:'VERIFYING',t:'الفريق أكّد التوافر مع المشغّل'},
{st:'THINKING',t:'العين حلّلت الفرصة وحسبت درجتها بأجزائها الأربعة'},
{st:'MATCHING',t:'عميل مطابق (LATENT) والبوابة سمحت'},
{st:'DECIDING',t:'الفرصة تنتظر موافقتك',gate:true},
{st:'MATCHING',t:'وصل طلب عميل: RUH → JED لـ5 أشخاص، فرتّبت العين 3 خيارات والتوافر غير معروف'},
{st:'MONITORING',t:'بدأت الرحلة (محاكاة)'},
{st:'ANTICIPATING',t:'الطقس تغيّر. العين توقعت تأخيرًا 18–25 دقيقة'},
{st:'DECIDING',t:'تعديل مقترح لموعد السائق ينتظر موافقتك',gate:true},
{st:'WATCHING',t:'العميل تلقّى الإشعار المهم فقط، وباقي الأحداث صامتة'}];
export default function DemoStory({onState}:{onState:(s:AgentState)=>void}){
 const [i,setI]=useState(-1);
 useEffect(()=>{if(i<0)return;if(i>=S.length){onState('WATCHING');return}onState(S[i].st);if(S[i].gate)return;const t=setTimeout(()=>setI(i+1),1700);return()=>clearTimeout(t)},[i]);
 const run=i>=0&&i<S.length,done=i>=S.length;
 return <section className="sec"><div className="mono">THE STORY<span className="badge b">SIM</span></div><h2>العرض الكامل</h2>
  <p className="lead" style={{margin:'0 0 14px'}}>قصة واحدة متصلة من المراقبة إلى الإشعار. كلها محاكاة ولا يحدث فيها أي إجراء حقيقي.</p>
  <button disabled={run} onClick={()=>setI(0)}>{done?'أعد العرض':'تشغيل العرض الكامل'}</button>
  <div className="fd" style={{marginTop:14}}>{S.slice(0,Math.min(i+1,S.length)).reverse().map((x,k,a)=>{const idx=a.length-1-k;return <div className="sg" key={idx}><span>{x.t}</span><span className="pr">{x.st}<span className="badge b">SIM</span></span>
   {x.gate&&i===idx&&<div className="act" style={{gridColumn:'1/-1'}}><HoldRing onDone={()=>setI(idx+1)}/><span className="mono">APPROVAL REQUIRED · HOLD</span></div>}</div>})}</div>
  {done&&<div className="nt e">انتهى العرض. لم يُنفَّذ أي إجراء حقيقي.</div>}</section>;
}
