import {useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
// صور ومواصفات الطرازات من جدول aircraft_type_media (مصدرها Aviapages، قراءة عامة).
// الكابينة تعرض فئات (خفيفة، متوسطة...) لا طائرات بعينها، فكل فئة تأخذ طرازًا تمثيليًا يُسمّى تمثيليًا في الواجهة.
export interface Media{model:string;name:string;img:string|null;pax:number|null;rangeKm:number|null;len:number|null;wid:number|null;hei:number|null;bag:number|null}
export const REP:Record<string,string>={LIGHT:'PC-24',MID:'Citation Latitude',SUPER:'Challenger 350',LARGE:'Global 5000',ULR:'G650ER'};
const n=(v:unknown)=>v==null?null:Number(v);
let cache:Promise<Record<string,Media>>|null=null;
const load=()=>cache??=(async()=>{
 const {data,error}=await sb.from('aircraft_type_media').select('model,aviapages_name,image_url,pax_max,range_km,cabin_length_m,cabin_width_m,cabin_height_m,luggage_m3').in('model',Object.values(REP));
 if(error||!data)return {};
 return Object.fromEntries(data.map((r:any)=>[r.model,{model:r.model,name:r.aviapages_name??r.model,img:r.image_url,pax:r.pax_max,rangeKm:r.range_km,len:n(r.cabin_length_m),wid:n(r.cabin_width_m),hei:n(r.cabin_height_m),bag:n(r.luggage_m3)}]));
})().catch(()=>({}));
// يرجع ميديا الفئة، أو null أثناء التحميل أو عند الفشل. الواجهة تعمل كما هي بدونها.
export function useMedia(cat:string):Media|null{
 const [m,setM]=useState<Record<string,Media>>({});
 useEffect(()=>{let on=true;load().then(x=>on&&setM(x));return()=>{on=false}},[]);
 return m[REP[cat]]??null;
}
