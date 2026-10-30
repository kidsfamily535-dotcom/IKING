import {useEffect,useState} from 'react';
import {HUBS,dist,type Hub} from './geo';
// قاعدة مطارات عالمية (OurAirports، بيانات عامة): الكبيرة والمتوسطة التي لها رمز IATA. تُحمَّل عند الحاجة فقط (public/world-airports.json).
// [iata, name, municipality, lat, lon, country, tier(1 كبير|2 متوسط), icao, منطقة زمنية IANA]
export type WA=[string,string,string,number,number,string,number,string,string];
let cache:WA[]|null=null,pending:Promise<WA[]>|null=null;
export const loadWorld=():Promise<WA[]>=>cache?Promise.resolve(cache):pending??(pending=fetch('/world-airports.json').then(r=>{if(!r.ok)throw new Error('world');return r.json()}).then((d:WA[])=>(cache=d)).catch(e=>{pending=null;throw e}));
export const useWorld=()=>{const [w,setW]=useState<WA[]|null>(cache);useEffect(()=>{if(!cache)loadWorld().then(setW).catch(()=>{})},[]);return w};
// أسماء المطارات خارج قائمتنا اليدوية تأتي بالإنجليزية حاليًا (ar=en)؛ تُراجَع وتُترجَم لاحقًا.
export const waHub=(a:WA):Hub=>{const n=a[2]||a[1];return{iata:a[0],ar:n,en:n,lat:a[3],lon:a[4],tz:a[8]||'UTC',pri:6}};
const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u064B-\u065F\u0670\u0300-\u036f]/g,'').replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim();
export function searchHubs(w:WA[]|null,q:string,max=8):Hub[]{
 const n=norm(q);if(n.length<2)return[];
 const out:Hub[]=[],seen=new Set<string>();
 const add=(h:Hub)=>{if(!seen.has(h.iata)&&out.length<max){seen.add(h.iata);out.push(h)}};
 for(const h of HUBS)if(h.iata.toLowerCase()===n||norm(h.ar).includes(n)||norm(h.en).includes(n))add(h);
 if(w){
  for(const a of w)if(a[0].toLowerCase()===n)add(waHub(a));
  const hit=w.filter(a=>norm(a[2]).includes(n)||norm(a[1]).includes(n)).sort((a,b)=>a[6]-b[6]);
  for(const a of hit)add(waHub(a));
 }
 return out;
}
// ما يظهر على الرادار: مطاراتنا اليدوية داخل المدى + عينة موزّعة جغرافيًا من المطارات الكبرى (والمتوسطة عند المدى القريب).
export function visibleHubs(w:WA[]|null,from:Hub,range:number,must:(Hub|null)[],cap=64):Hub[]{
 const chosen=new Map<string,Hub>();
 const put=(h:Hub)=>{if(!chosen.has(h.iata))chosen.set(h.iata,h)};
 put(from);for(const m of must)if(m)put(m);
 for(const h of HUBS)if(dist(from,h)<=range*1.001)put(h);
 if(!w)return[...chosen.values()];
 const maxTier=range<=3500?2:1;
 const cand:Hub[]=[];
 for(const a of w){if(a[6]>maxTier||chosen.has(a[0]))continue;const h=waHub(a);
  if(dist(from,h)>range*1.001)continue;
  if(HUBS.some(s=>dist(s,h)<25))continue;cand.push(h)}
 // الأقرب والأكبر أولًا، بشرط مسافة فاصلة بين النقاط حتى لا تتكدّس (الفاصل يتّسع مع المدى).
 const sep=Math.max(150,range/9);
 cand.sort((a,b)=>(a.pri-b.pri)||(dist(from,a)-dist(from,b)));
 const tierOf=new Map<string,number>(w.map(a=>[a[0],a[6]]));
 cand.sort((a,b)=>((tierOf.get(a.iata)??2)-(tierOf.get(b.iata)??2))||(dist(from,a)-dist(from,b)));
 for(const h of cand){if(chosen.size>=cap)break;
  let ok=true;for(const c of chosen.values())if(dist(c,h)<sep){ok=false;break}
  if(ok)put(h)}
 return[...chosen.values()];
}
