import type {Airport} from './types';
// المطارات اللي تظهر نقاطًا على الرادار. القائمة الكاملة (164 مطار من القاعدة) تظهر في القوائم المنسدلة فقط،
// وأي مطار يدخل في فرصة أو قوس يظهر على الرادار تلقائيًا حتى لو مش في هذه القائمة.
export const HUBS=new Set(['RUH','JED','MED','TUU','DMM','AHB','GIZ','YNB','DXB','AUH','DOH','CAI','AMM']);
export const radarAirports=(all:Airport[],extra:(string|undefined)[]=[]):Airport[]=>{
 const x=new Set(extra.filter(Boolean) as string[]);
 return all.filter(a=>HUBS.has(a.iata)||x.has(a.iata));
};
