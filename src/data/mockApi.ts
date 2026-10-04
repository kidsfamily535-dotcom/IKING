import type {EyeApi} from './api';import type {Airport,Opportunity,Signal,EmptyLegInput,MarketLeg,MemoryItem,ParsedRequest,TripOption,DecisionPolicyRow} from './types';
import {tr,trIn} from '../i18n';
const A=(iata:string,nameAr:string,nameEn:string,country:string,lat:number,lon:number):Airport=>({iata,nameAr,nameEn,country,lat,lon});
const airports:Airport[]=[A('RUH','الرياض','Riyadh','SA',24.957,46.699),A('JED','جدة','Jeddah','SA',21.679,39.157),A('MED','المدينة','Madinah','SA',24.553,39.705),A('TUU','تبوك','Tabuk','SA',28.365,36.619),A('DMM','الدمام','Dammam','SA',26.471,49.798),A('AHB','أبها','Abha','SA',18.24,42.656),A('GIZ','جازان','Jazan','SA',16.901,42.586),A('YNB','ينبع','Yanbu','SA',24.144,38.063),A('DXB','دبي','Dubai','AE',25.253,55.366),A('AUH','أبوظبي','Abu Dhabi','AE',24.433,54.651),A('DOH','الدوحة','Doha','QA',25.273,51.608),A('CAI','القاهرة','Cairo','EG',30.122,31.406),A('AMM','عمّان','Amman','JO',31.722,35.993)];
// كل النصوص تُبنى وقت الطلب بلغة الواجهة الحالية، فتتغير عند إعادة الجلب بعد تبديل اللغة.
const buildSignals=():Signal[]=>[
{id:'s1',kind:'OPERATOR',title:tr('sig.1'),area:tr('area.ruh'),stage:'CONFIRMED',dataStatus:'CONFIRMED',confidence:'high',source:'OFFICIAL_OPERATOR',minutesAgo:12,priority:'APPROVAL_REQUIRED'},
{id:'s2',kind:'OPERATOR',title:tr('sig.2'),area:tr('area.dmm'),stage:'POTENTIAL',dataStatus:'UNKNOWN',confidence:'low',source:'INTERNAL_DATABASE',minutesAgo:41,priority:'INVESTIGATE'},
{id:'s3',kind:'AIRCRAFT_MOVEMENT',title:tr('sig.3'),area:tr('area.jedArea'),stage:'SIGHTED',dataStatus:'SIM',confidence:'medium',source:tr('src.adsbSim'),minutesAgo:6,priority:'WATCH'},
{id:'s4',kind:'AIRCRAFT_MOVEMENT',title:tr('sig.4'),area:tr('area.gulf'),stage:'POTENTIAL',dataStatus:'INFERRED',confidence:'medium',source:tr('src.system'),minutesAgo:19,priority:'WATCH'},
{id:'s5',kind:'DEMAND',title:tr('sig.5'),area:tr('area.ruh'),dataStatus:'SIM',confidence:'low',grade:'D',source:tr('src.public'),minutesAgo:95,priority:'WATCH'},
{id:'s6',kind:'WEATHER',title:tr('sig.6'),area:tr('area.ruhjed'),dataStatus:'SIM',confidence:'medium',source:tr('src.metarSim'),minutesAgo:8,priority:'SILENT'}];
const oppState:Record<string,{status:Opportunity['status'];note?:string}>={o1:{status:'ACTIVATION_PENDING'},o2:{status:'DETECTED'}};
const buildOpps=():Opportunity[]=>[
{id:'o1',origin:'RUH',destination:'JED',aircraftCategory:'MID',seats:7,trigger:'LAST_MINUTE',status:oppState.o1.status,availability:'CONFIRMED',source:'OFFICIAL_OPERATOR',verifiedMinAgo:12,expiresInMin:168,scoreParts:{freshness:28,sourceStrength:20,urgency:24,confidence:16},reasons:[tr('o1.r1'),tr('o1.r2'),tr('o1.r3')],matched:{segment:'LATENT',relevance:62,gate:'ALLOWED'},isDemo:true,note:oppState.o1.note??tr('opp.demoNote')},
{id:'o2',origin:'DMM',destination:'DXB',aircraftCategory:'LIGHT',seats:5,trigger:'AVAILABILITY',status:oppState.o2.status,availability:'PENDING_VERIFICATION',source:'INTERNAL_DATABASE',verifiedMinAgo:null,expiresInMin:600,scoreParts:{freshness:14,sourceStrength:8,urgency:6,confidence:6},reasons:[tr('o2.r1')],matched:{segment:'DORMANT',relevance:31,gate:'BLOCKED',gateReason:tr('o2.gate')},isDemo:true,note:oppState.o2.note??tr('opp.demoNote')}];
let mem:MemoryItem[]=[{key:'cabin',source:'CUSTOMER_PROVIDED',editable:true},{key:'period',source:'CUSTOMER_PROVIDED',editable:true},{key:'ground',source:'FROM_PAST_TRIPS',editable:true},{key:'notify',source:'CUSTOMER_PROVIDED',editable:true}];
const km=(a:Airport,b:Airport)=>{const r=Math.PI/180;return 6371*Math.acos(Math.min(1,Math.sin(a.lat*r)*Math.sin(b.lat*r)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.cos((a.lon-b.lon)*r)))};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const mockApi:EyeApi={
 async listAirports(){await wait(80);return airports},
 async listSignals(){await wait(120);return buildSignals()},
 async listOpportunities(){await wait(120);return buildOpps()},
 async approveOpportunity(id){await wait(300);const s=oppState[id];if(s&&s.status==='ACTIVATION_PENDING')oppState[id]={...s,status:'ACTIVATED'}},
 async rejectOpportunity(id,reason){if(!reason.trim())throw new Error('reason required');await wait(300);if(oppState[id])oppState[id]={status:'REJECTED',note:reason}},
 async listMarket(){await wait(100);const m:MarketLeg[]=[{aircraftCategory:'LARGE',origin:'JED',destination:'DXB',status:'in_flight',confidence:'MEDIUM',inferred:true},{aircraftCategory:'MID',origin:'CAI',destination:'RUH',status:'landed',confidence:'HIGH',inferred:true},{aircraftCategory:'LIGHT',origin:'DOH',destination:'DMM',status:'signal_lost',confidence:'MEDIUM',inferred:true}];return m},
 async analyzeEmptyLeg(i:EmptyLegInput,on:(s:string)=>void){
  if(i.origin===i.destination)throw new Error('same airport');
  for(let n=1;n<=8;n++){on(tr('an.'+n));await wait(450)}
  const seats=i.seats,id='e'+Date.now(),dst=i.destination==='ANY'?tr('an.dest.open'):i.destination;
  return{id,steps:[],confidence:(seats>=4?'medium':'low') as 'medium'|'low',score:{freshness:20,sourceStrength:8,urgency:12,confidence:seats>=4?10:6},
  recommendation:(seats>=4?'OUTREACH':'WATCH') as 'OUTREACH'|'WATCH',
  reasons:[tr('an.r1',{ac:i.aircraft,o:i.origin,n:seats}),tr('an.r2',{d:dst}),tr('an.r3'),tr('an.r4')],
  draft:tr('an.draft',{o:i.origin,d:i.destination==='ANY'?tr('an.flex'):i.destination,from:i.from,n:seats})}},
 async listMemory(){await wait(80);return mem.map(m=>({...m}))},
 async saveMemory(k,v){await wait(150);mem=mem.map(m=>m.key===k?{...m,value:v}:m)},
 // الفهم ثنائي اللغة: يقبل الطلب بالعربي أو بالإنجليزي
 async parseRequest(t){await wait(500);
  const by=(mk:(a:Airport)=>RegExp[])=>airports.find(a=>mk(a).some(r=>r.test(t)));
  const o=by(a=>[new RegExp('من\\s*'+esc(a.nameAr)),new RegExp('\\bfrom\\s+'+esc(a.nameEn)+'\\b','i')]);
  const d=by(a=>[new RegExp('(إلى|الى|لـ?)\\s*'+esc(a.nameAr)),new RegExp('\\bto\\s+'+esc(a.nameEn)+'\\b','i')]);
  const pm=t.match(/(\d+)\s*(أشخاص|اشخاص|شخص|ركاب|people|persons?|passengers?|pax|guests?)/i);
  const when=/بكرة|غدا|غدًا|tomorrow/i.test(t)?'tomorrow':/اليوم|today/i.test(t)?'today':undefined;
  const missing:string[]=[];if(!o)missing.push('origin');if(!d)missing.push('destination');if(!pm)missing.push('passengers');if(!when)missing.push('date');
  const pax=pm?Number(pm[1]):undefined;let options:TripOption[]=[];
  if(o&&d&&pax&&when){const dist=km(o,d),dur=Math.round(dist/780*60+20),mk=(id:string,category:string,departure:string,rate:number,ok:boolean):TripOption[]=>ok?[{id,title:tr('opt.'+id),category,departure,durationMin:dur,priceLo:Math.round(dist*rate*.85/100)*100,priceHi:Math.round(dist*rate*1.15/100)*100,usesMemory:category==='MID'}]:[];
   options=[...mk('a','MID','07:30',11,pax<=9),...mk('b','LARGE','09:00',16,true),...mk('c','LIGHT','10:30',7,pax<=5)]}
  const r:ParsedRequest={origin:o?.iata,destination:d?.iata,passengers:pax,when,missing,options};return r},
 async listPolicy(){const P=(decision:string,externalEffect=false,requiresHuman=false):DecisionPolicyRow=>({situation:decision,decision,externalEffect,requiresHuman,descriptionAr:trIn('ar','policy.'+decision)});
  return [P('SILENT'),P('MONITOR'),P('INVESTIGATE'),P('RECOMMEND'),P('ACT_INTERNAL'),P('ASK_APPROVAL',true,true),P('ESCALATE',true,true),P('VERIFY_CONTINUE')]},
 async runPass(on){for(const s of ['DISCOVERING','THINKING','MATCHING','MONITORING'] as const){on(s);await wait(700)}on('WATCHING');return tr('run.result')}};
