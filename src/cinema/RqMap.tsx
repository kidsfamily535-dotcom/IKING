import {useEffect,useRef} from 'react';
import type {Hub} from '../cabin/geo';
// خلفية صفحة الطلب: نفس خريطة الصفحة الرئيسية (ليلي كحلي + سواحل + شبكة)، ثابتة وهادئة، وترسم مسار الرحلة المختار بخط ذهبي منقّط.
const MY=(la:number)=>Math.log(Math.tan(Math.PI/4+Math.max(-80,Math.min(84,la))*Math.PI/360))*180/Math.PI;
let LAND:number[][]|null=null;
export default function RqMap({from,to}:{from:Hub;to:Hub|null}){
 const cv=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const el=cv.current;if(!el)return;const cx=el.getContext('2d');if(!cx)return;let live=true;
  const draw=()=>{if(!live)return;const D=Math.min(devicePixelRatio||1,2),W=innerWidth,H=innerHeight;el.width=W*D;el.height=H*D;cx.setTransform(D,0,0,D,0,0);
   const mid=to?{x:(from.lon+to.lon)/2,y:(from.lat+to.lat)/2}:{x:45,y:27};
   const span=to?Math.max(Math.abs(from.lon-to.lon)+14,(Math.abs(MY(from.lat)-MY(to.lat)))*1.6+10):0;
   const s=to?Math.min(Math.max(W/span,Math.max(W/105,H/62)),Math.max(W/105,H/62)*1.25):Math.max(W/105,H/62);
   const ox=to&&W>900?-W*.3:0;
   const P=(lo:number,la:number):number[]=>[W/2+ox+(lo-mid.x)*s,H/2-(MY(la)-MY(mid.y))*s];
   const g=cx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.7);g.addColorStop(0,'#0f2f57');g.addColorStop(1,'#0b213d');cx.fillStyle=g;cx.fillRect(0,0,W,H);
   cx.strokeStyle='rgba(120,160,200,.07)';cx.lineWidth=1;cx.beginPath();for(let lo=-180;lo<=180;lo+=15){const x=P(lo,0)[0];cx.moveTo(x,0);cx.lineTo(x,H)}for(let la=-60;la<=80;la+=10){const y=P(0,la)[1];cx.moveTo(0,y);cx.lineTo(W,y)}cx.stroke();
   if(LAND){cx.beginPath();for(const r of LAND){let mnx=1e9,mxx=-1e9,mny=1e9;for(let i=0;i<r.length;i+=2){if(r[i]<mnx)mnx=r[i];if(r[i]>mxx)mxx=r[i];if(r[i+1]<mny)mny=r[i+1]}if(mny<-60)continue;if(P(mxx,0)[0]<-50||P(mnx,0)[0]>W+50)continue;
    for(let i=0;i<r.length;i+=2){const p=P(r[i],r[i+1]);i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1])}cx.closePath()}
    cx.fillStyle='#0f2f57';cx.fill();cx.strokeStyle='rgba(140,180,220,.38)';cx.lineWidth=.8;cx.stroke()}
   const dot=(h:Hub,hot:boolean)=>{const p=P(h.lon,h.lat);cx.fillStyle=hot?'#daa654':'rgba(244,236,220,.6)';cx.beginPath();cx.arc(p[0],p[1],hot?4:2,0,6.283);cx.fill();if(hot){cx.font='11px JetBrains Mono, monospace';cx.fillText(h.iata,p[0]+7,p[1]-6)}};
   if(to){const a=P(from.lon,from.lat),b=P(to.lon,to.lat),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,k=L*.2;
    cx.strokeStyle='rgba(218,166,84,.55)';cx.lineWidth=1.4;cx.setLineDash([4,6]);cx.beginPath();cx.moveTo(a[0],a[1]);cx.quadraticCurveTo(mx+dy/L*k*Math.sign(dx||1),my-Math.abs(dx)/L*k-Math.abs(dy)/L*k*.3,b[0],b[1]);cx.stroke();cx.setLineDash([]);dot(to,true)}
   dot(from,true)};
  const go=()=>{if(LAND)draw();else fetch('/world-land.json').then(r=>r.json()).then((d:number[][])=>{LAND=d;draw()}).catch(draw)};
  go();addEventListener('resize',draw);return()=>{live=false;removeEventListener('resize',draw)}},[from,to]);
 return <canvas ref={cv} className="rq-map" aria-hidden="true"/>;
}
