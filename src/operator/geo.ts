// هندسة الخريطة: مسقط بسيط حول المطارين، وقوس رحلة، وشبكة إحداثيات. لا بيانات خارجية.
export type Ap={code:string;ar:string|null;en:string|null;lat:number;lon:number};
export const W=800,H=440;
const nice=(x:number)=>{for(const s of [0.5,1,2,5,10,20,30])if(x<=s)return s;return 30};
export function frame(a:Ap,b:Ap|null){
 const cLat=b?(a.lat+b.lat)/2:a.lat,cLon=b?(a.lon+b.lon)/2:a.lon;
 const k=Math.cos(cLat*Math.PI/180)||1;
 const dLat=b?Math.abs(a.lat-b.lat):0,dLon=b?Math.abs(a.lon-b.lon)*k:0;
 const s=Math.min((W*0.6)/Math.max(dLon,0.25),(H*0.6)/Math.max(dLat,0.25),b?160:40);
 const P=(p:{lat:number;lon:number}):[number,number]=>[W/2+(p.lon-cLon)*k*s,H/2-(p.lat-cLat)*s];
 const halfLat=H/2/s,halfLon=W/2/(s*k);
 return {P,cLat,cLon,halfLat,halfLon,step:nice(halfLat*2/5)};
}
export function arcPath(p:[number,number],q:[number,number]){
 const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,dx=q[0]-p[0],dy=q[1]-p[1],d=Math.hypot(dx,dy)||1;
 let nx=-dy/d,ny=dx/d;if(ny>0){nx=-nx;ny=-ny}
 const lift=Math.min(d*0.32,130);
 return `M${p[0].toFixed(1)},${p[1].toFixed(1)} Q${(mx+nx*lift).toFixed(1)},${(my+ny*lift).toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`;
}
