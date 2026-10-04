import type {EyeApi} from './api';import type {Airport,Opportunity,Signal,EmptyLegInput,MarketLeg,MemoryItem,ParsedRequest,TripOption,DecisionPolicyRow} from './types';
const A=(iata:string,nameAr:string,nameEn:string,country:string,lat:number,lon:number):Airport=>({iata,nameAr,nameEn,country,lat,lon});
const airports:Airport[]=[A('RUH','الرياض','Riyadh','SA',24.957,46.699),A('JED','جدة','Jeddah','SA',21.679,39.157),A('MED','المدينة','Madinah','SA',24.553,39.705),A('TUU','تبوك','Tabuk','SA',28.365,36.619),A('DMM','الدمام','Dammam','SA',26.471,49.798),A('AHB','أبها','Abha','SA',18.24,42.656),A('GIZ','جازان','Jazan','SA',16.901,42.586),A('YNB','ينبع','Yanbu','SA',24.144,38.063),A('DXB','دبي','Dubai','AE',25.253,55.366),A('AUH','أبوظبي','Abu Dhabi','AE',24.433,54.651),A('DOH','الدوحة','Doha','QA',25.273,51.608),A('CAI','القاهرة','Cairo','EG',30.122,31.406),A('AMM','عمّان','Amman','JO',31.722,35.993)];
const signals:Signal[]=[
{id:'s1',kind:'OPERATOR',title:'رحلة فاضية RUH → JED أكّدها المشغّل',area:'الرياض',stage:'CONFIRMED',dataStatus:'CONFIRMED',confidence:'high',source:'OFFICIAL_OPERATOR',minutesAgo:12,priority:'APPROVAL_REQUIRED'},
{id:'s2',kind:'OPERATOR',title:'سعة مقترحة DMM → DXB في انتظار تحقق الفريق',area:'الدمام',stage:'POTENTIAL',dataStatus:'UNKNOWN',confidence:'low',source:'INTERNAL_DATABASE',minutesAgo:41,priority:'INVESTIGATE'},
{id:'s3',kind:'AIRCRAFT_MOVEMENT',title:'طائرة كبيرة المقصورة تتحرك غرب جدة',area:'منطقة جدة',stage:'SIGHTED',dataStatus:'SIM',confidence:'medium',source:'ADS-B (محاكاة)',minutesAgo:6,priority:'WATCH'},
{id:'s4',kind:'AIRCRAFT_MOVEMENT',title:'حركة محتملة نحو الرياض من الخليج',area:'الخليج',stage:'POTENTIAL',dataStatus:'INFERRED',confidence:'medium',source:'استنتاج النظام',minutesAgo:19,priority:'WATCH'},
{id:'s5',kind:'DEMAND',title:'فعالية أعمال في الرياض الأسبوع القادم',area:'الرياض',dataStatus:'SIM',confidence:'low',grade:'D',source:'مصدر عام',minutesAgo:95,priority:'WATCH'},
{id:'s6',kind:'WEATHER',title:'الطقس مقبول على مسار RUH → JED',area:'الرياض / جدة',dataStatus:'SIM',confidence:'medium',source:'METAR (محاكاة)',minutesAgo:8,priority:'SILENT'}];
let opps:Opportunity[]=[
{id:'o1',origin:'RUH',destination:'JED',aircraftCategory:'متوسطة المقصورة',seats:7,trigger:'LAST_MINUTE',status:'ACTIVATION_PENDING',availability:'CONFIRMED',source:'OFFICIAL_OPERATOR',verifiedMinAgo:12,expiresInMin:168,scoreParts:{freshness:28,sourceStrength:20,urgency:24,confidence:16},reasons:['المشغّل أكّد الرحلة قبل 12 دقيقة','موعد المغادرة خلال ساعتين تقريبًا (من بيانات حقيقية)','المسار مطلوب عادةً من عملاء الرياض'],matched:{segment:'LATENT',relevance:62,gate:'ALLOWED'},isDemo:true,note:'بيانات تجريبية'},
{id:'o2',origin:'DMM',destination:'DXB',aircraftCategory:'خفيفة',seats:5,trigger:'AVAILABILITY',status:'DETECTED',availability:'PENDING_VERIFICATION',source:'INTERNAL_DATABASE',verifiedMinAgo:null,expiresInMin:600,scoreParts:{freshness:14,sourceStrength:8,urgency:6,confidence:6},reasons:['سعة مسجّلة لكن لم يؤكدها المشغّل بعد'],matched:{segment:'DORMANT',relevance:31,gate:'BLOCKED',gateReason:'التوافر غير مؤكد، ولا يُعرض على أي عميل قبل التحقق'},isDemo:true,note:'بيانات تجريبية'}];
let mem:MemoryItem[]=[{key:'cabin',labelAr:'فئة الطائرة المفضلة',value:'متوسطة المقصورة',source:'CUSTOMER_PROVIDED',editable:true},{key:'period',labelAr:'فترة المغادرة المفضلة',value:'صباحًا',source:'CUSTOMER_PROVIDED',editable:true},{key:'ground',labelAr:'نقل أرضي',value:'مطلوب',source:'FROM_PAST_TRIPS',editable:true},{key:'notify',labelAr:'مستوى التنبيهات',value:'المهم فقط',source:'CUSTOMER_PROVIDED',editable:true}];
const km=(a:Airport,b:Airport)=>{const r=Math.PI/180;return 6371*Math.acos(Math.min(1,Math.sin(a.lat*r)*Math.sin(b.lat*r)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.cos((a.lon-b.lon)*r)))};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export const mockApi:EyeApi={
 async listAirports(){await wait(80);return airports},
 async listSignals(){await wait(120);return signals},
 async listOpportunities(){await wait(120);return opps.map(o=>({...o}))},
 async approveOpportunity(id){await wait(300);opps=opps.map(o=>o.id===id&&o.status==='ACTIVATION_PENDING'?{...o,status:'ACTIVATED'}:o)},
 async rejectOpportunity(id,reason){if(!reason.trim())throw new Error('reason required');await wait(300);opps=opps.map(o=>o.id===id?{...o,status:'REJECTED',note:reason}:o)},
 async listMarket(){await wait(100);const m:MarketLeg[]=[{aircraftCategory:'كبيرة المقصورة',origin:'JED',destination:'DXB',status:'in_flight',confidence:'MEDIUM',inferred:true},{aircraftCategory:'متوسطة المقصورة',origin:'CAI',destination:'RUH',status:'landed',confidence:'HIGH',inferred:true},{aircraftCategory:'خفيفة',origin:'DOH',destination:'DMM',status:'signal_lost',confidence:'MEDIUM',inferred:true}];return m},
 async analyzeEmptyLeg(i:EmptyLegInput,on:(s:string)=>void){
  if(i.origin===i.destination)throw new Error('same airport');
  for(const s of ['ملاءمة الطائرة','التموضع الحالي','المسار','الطلب المعروف','الفعاليات','الطقس','المطار','التوقيت']){on(s);await wait(450)}
  const seats=i.seats,id='e'+Date.now();
  return{id,steps:[],confidence:(seats>=4?'medium':'low') as 'medium'|'low',score:{freshness:20,sourceStrength:8,urgency:12,confidence:seats>=4?10:6},
  recommendation:(seats>=4?'OUTREACH':'WATCH') as 'OUTREACH'|'WATCH',
  reasons:[`الطائرة (${i.aircraft}) متمركزة حاليًا في ${i.origin} وتتسع ${seats} مقاعد`,`الوجهة ${i.destination==='ANY'?'مفتوحة':i.destination} ضمن نطاق الرصد`,'لا يوجد طلب مؤكد على هذا المسار حاليًا (محاكاة)','التوافر في انتظار تحقق الفريق ولم يؤكده مشغّل بعد'],
  draft:`فرصة رحلة فاضية من ${i.origin} إلى ${i.destination==='ANY'?'وجهة مرنة':i.destination} بدءًا من ${i.from}، حتى ${seats} مقاعد. التوافر قيد التحقق ويحتاج تأكيد المشغّل.`}},
 async listMemory(){await wait(80);return mem.map(m=>({...m}))},
 async saveMemory(k,v){await wait(150);mem=mem.map(m=>m.key===k?{...m,value:v}:m)},
 async parseRequest(t){await wait(500);
  const by=(re:(n:string)=>RegExp)=>airports.find(a=>re(a.nameAr).test(t));
  const o=by(n=>new RegExp('من\\s*'+n)),d=by(n=>new RegExp('(إلى|الى|لـ?)\\s*'+n));
  const pm=t.match(/(\d+)\s*(أشخاص|اشخاص|شخص|ركاب)/),wm=t.match(/بكرة|غدا|غدًا|اليوم/);
  const missing:string[]=[];if(!o)missing.push('مطار المغادرة');if(!d)missing.push('الوجهة');if(!pm)missing.push('عدد الركاب');if(!wm)missing.push('التاريخ');
  const pax=pm?Number(pm[1]):undefined;let options:TripOption[]=[];
  if(o&&d&&pax&&wm){const dist=km(o,d),dur=Math.round(dist/780*60+20),mk=(id:string,title:string,category:string,departure:string,rate:number,ok:boolean):TripOption[]=>ok?[{id,title,category,departure,durationMin:dur,priceLo:Math.round(dist*rate*.85/100)*100,priceHi:Math.round(dist*rate*1.15/100)*100,usesMemory:category==='متوسطة المقصورة'}]:[];
   options=[...mk('a','الوصول الأسرع','متوسطة المقصورة','07:30',11,pax<=9),...mk('b','الأكثر راحة','كبيرة المقصورة','09:00',16,true),...mk('c','الأوفر','خفيفة','10:30',7,pax<=5)]}
  return{origin:o?.iata,destination:d?.iata,passengers:pax,when:wm?.[0],missing,options}},
 async fleetReport(regs){await wait(300);return regs.map((r,i)=>({registration:r.toUpperCase(),found:i%2===0,icao_type:i%2===0?'GLEX':null,category:i%2===0?'Long Range':null,last_seen_at:null,minutes_since_seen:i%2===0?25:null,nearest_airport:i%2===0?'DXB':null,nearest_km:i%2===0?12:null,sightings_24h:i%2===0?40:0,legs_48h:i%2===0?2:0,last_leg:null}))},
 async parkedAircraft(){await wait(200);return [{icao24:'sim001',registration:'SIM-01',icao_type:'GLF5',category:'Ultra Long Range',airport:'DXB',landed_at:new Date(Date.now()-3*3600e3).toISOString(),parked_hours:3,confidence:'HIGH',related_demand_signals:1,open_explicit_requests:0}]},
 async demandCalendar(){await wait(200);return [{signal_id:'sim1',title:'فعالية تجريبية',grade:'D',source:'محاكاة',event_date:new Date(Date.now()+25*864e5).toISOString().slice(0,10),days_until:25,airports:['AUH'],airports_basis:'INFERRED_FROM_TITLE' as const,tracked_aircraft_near_24h:5}]},
 async listPolicy(){const P=(decision:string,descriptionAr:string,externalEffect=false,requiresHuman=false):DecisionPolicyRow=>({situation:decision,decision,externalEffect,requiresHuman,descriptionAr});
  return [P('SILENT','لا شيء يستحق الإزعاج'),P('MONITOR','تابع بصمت'),P('INVESTIGATE','افحص أكثر'),P('RECOMMEND','اقترح على الفريق'),P('ACT_INTERNAL','إجراء داخلي منخفض المخاطر'),P('ASK_APPROVAL','اطلب موافقة بشرية',true,true),P('ESCALATE','صعّد لإنسان',true,true),P('VERIFY_CONTINUE','تحقق ثم أكمل')]},
 async runPass(on){for(const s of ['DISCOVERING','THINKING','MATCHING','MONITORING'] as const){on(s);await wait(700)}on('WATCHING');return 'العين راجعت 6 إشارات: فرصة واحدة جاهزة لموافقتك، وأخرى تنتظر تحقق الفريق.'}};
