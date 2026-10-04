import {useEffect,useState} from 'react';
import HoldRing from './Hold';
import type {AgentState} from './data/types';
import {useI18n} from './i18n';
const S:{st:AgentState;k:string;gate?:boolean}[]=[
{st:'WATCHING',k:'demo.1'},{st:'DISCOVERING',k:'demo.2'},{st:'DISCOVERING',k:'demo.3'},{st:'VERIFYING',k:'demo.4'},{st:'THINKING',k:'demo.5'},{st:'MATCHING',k:'demo.6'},{st:'DECIDING',k:'demo.7',gate:true},{st:'MATCHING',k:'demo.8'},{st:'MONITORING',k:'demo.9'},{st:'ANTICIPATING',k:'demo.10'},{st:'DECIDING',k:'demo.11',gate:true},{st:'WATCHING',k:'demo.12'}];
export default function DemoStory({onState}:{onState:(s:AgentState)=>void}){
 const {t}=useI18n();const [i,setI]=useState(-1);
 useEffect(()=>{if(i<0)return;if(i>=S.length){onState('WATCHING');return}onState(S[i].st);if(S[i].gate)return;const t=setTimeout(()=>setI(i+1),1700);return()=>clearTimeout(t)},[i]);
 const run=i>=0&&i<S.length,done=i>=S.length;
 return <section className="sec"><div className="mono">THE STORY<span className="badge b">SIM</span></div><h2>{t('demo.title')}</h2>
  <p className="lead" style={{margin:'0 0 14px'}}>{t('demo.lead')}</p>
  <button disabled={run} onClick={()=>setI(0)}>{done?t('demo.rerun'):t('demo.run')}</button>
  <div className="fd" style={{marginTop:14}}>{S.slice(0,Math.min(i+1,S.length)).reverse().map((x,k,a)=>{const idx=a.length-1-k;return <div className="sg" key={idx}><span>{t(x.k)}</span><span className="pr">{x.st}<span className="badge b">SIM</span></span>
   {x.gate&&i===idx&&<div className="act" style={{gridColumn:'1/-1'}}><HoldRing onDone={()=>setI(idx+1)}/><span className="mono">APPROVAL REQUIRED · HOLD</span></div>}</div>})}</div>
  {done&&<div className="nt e">{t('demo.done')}</div>}</section>;
}
