import {useRef,useState} from 'react';
export default function HoldRing({onDone}:{onDone:()=>void}){
 const [p,setP]=useState(0);const raf=useRef(0),t0=useRef(0),done=useRef(false);
 const start=()=>{if(raf.current||done.current)return;t0.current=performance.now();
  const tick=(t:number)=>{const v=Math.min(1,(t-t0.current)/1600);setP(v);if(v>=1){done.current=true;raf.current=0;onDone()}else raf.current=requestAnimationFrame(tick)};raf.current=requestAnimationFrame(tick)};
 const stop=()=>{cancelAnimationFrame(raf.current);raf.current=0;if(!done.current)setP(0)};
 const C=2*Math.PI*28,key=(e:React.KeyboardEvent)=>e.key==='Enter'||e.key===' ';
 return <button className="hold" aria-label="اضغط باستمرار للموافقة" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
  onKeyDown={e=>{if(key(e)&&!e.repeat){e.preventDefault();start()}}} onKeyUp={e=>{if(key(e))stop()}}>
  <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="#f4ecdc" strokeOpacity=".15"/><circle cx="32" cy="32" r="28" fill="none" stroke="#c9a961" strokeWidth="1.5" strokeDasharray={C} strokeDashoffset={C*(1-p)} transform="rotate(-90 32 32)"/></svg></button>;
}

