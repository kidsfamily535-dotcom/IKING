import {useMemo,useState} from 'react';
import {useI18n} from '../i18n';
import {copy} from './copy';
import {dist,flightMin,rangeFor,type Hub} from './geo';
import Radar from './Radar';
import type {Airport} from '../data/types';
// رادار «راقب رحلتك»: يرسم مطارات الرحلة الحقيقية ويقبل اللمس لاختيار المنطلق ثم الوجهة. مطار فيه تنبيه طقس يتلوّن بالتحذير.
const SHOW=new Set(['RUH','JED','MED','TUU','DMM','AHB','GIZ','YNB','DXB','AUH','DOH','CAI','AMM','KWI','BAH','MCT']);
const toHub=(a:Airport):Hub=>({iata:a.iata,ar:a.nameAr,en:a.nameEn,lat:a.lat,lon:a.lon,tz:'',pri:a.iata==='RUH'?1:a.iata==='JED'||a.iata==='DXB'?2:5});
export default function WRadar({ap,a,b,nm,warn=[],onPick}:{ap:Airport[];a?:Airport;b?:Airport;nm:(x:Airport)=>string;warn?:string[];onPick?:(iata:string)=>void}){
 const {lang}=useI18n(),c=copy(lang);
 const [hover,setHover]=useState<string|null>(null);
 const hubs=useMemo(()=>ap.filter(x=>SHOW.has(x.iata)||x.iata===a?.iata||x.iata===b?.iata).map(toHub),[ap,a,b]);
 const from=a?.iata??(hubs.find(h=>h.iata==='RUH')?.iata??hubs[0]?.iata);
 if(!from)return <div className="cr cr-skel" aria-hidden/>;
 const to=b&&b.iata!==from?b.iata:null,km=a&&b&&to?dist(a,b):null,m=km?flightMin(km):0;
 const name=(h:Hub)=>{const x=ap.find(z=>z.iata===h.iata);return x?nm(x):h.iata};
 const dur=m<60?`${m} ${c.units.m}`:`${Math.floor(m/60)} ${c.units.h} ${String(m%60).padStart(2,'0')} ${c.units.m}`;
 const hud=km&&a&&b?c.ask.read(nm(a),nm(b),(Math.round(km/10)*10).toLocaleString('en'),dur):!a?c.ask.tapFrom:c.ask.tapTo;
 return <Radar hubs={hubs} from={from} to={to} hover={hover} name={name} range={rangeFor(km)} blips={[]} scanning={false} plane={null} alt={null} warn={warn}
  hud={hud} aria={c.gl.radar} kmUnit={c.units.km} onHover={onPick?setHover:()=>{}} onPick={id=>onPick?.(id)} onBlip={()=>{}}/>;
}
