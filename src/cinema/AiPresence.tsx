import {useEffect,useState} from 'react';
import type {Lang} from '../i18n';
// طبقة «الذكاء يعمل»: سطور تفكير هادئة تتبدّل + غبار بيانات ذهبي خفيف. زخرفية فقط (aria-hidden) ولا تدّعي توافرًا ولا أسعارًا.
const LINES:Record<Lang,string[]>={
 ar:['فهمت رحلتك','أراقب الطقس على المسار','أبحث في الخيارات المناسبة','أجهّز لك التفاصيل'],
 en:['Understanding your trip','Watching the weather on your route','Looking at suitable options','Preparing the details'],
 tr:['Yolculuğunuzu anlıyorum','Rotadaki havayı izliyorum','Uygun seçeneklere bakıyorum','Ayrıntıları hazırlıyorum'],
 ru:['Понимаю вашу поездку','Слежу за погодой на маршруте','Смотрю подходящие варианты','Готовлю детали']};
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export function AiThinking({lang}:{lang:Lang}){
 const L=LINES[lang]||LINES.en,[i,setI]=useState(0);
 useEffect(()=>{if(calm())return;const id=setInterval(()=>setI(n=>(n+1)%L.length),3200);return()=>clearInterval(id)},[L.length]);
 return <p className="ih-think-ln" aria-hidden="true"><i/><span key={i}>{L[i]}</span></p>;
}
export function Dust(){
 return <div className="ih-dust" aria-hidden="true">{Array.from({length:14},(_,k)=><i key={k} style={{left:`${(k*37+11)%100}%`,top:`${(k*53+7)%100}%`,animationDelay:`${(k%7)*1.3}s`,animationDuration:`${8+(k%5)*2}s`}}/>)}</div>;
}
