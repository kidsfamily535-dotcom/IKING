import {createContext,useContext} from 'react';
import type {Ap} from './geo';
export type Run=(f:()=>PromiseLike<{error:{message:string}|null}>)=>Promise<boolean>;
export const AirCtx=createContext<Map<string,Ap>>(new Map());
export const useAir=()=>useContext(AirCtx);
export const apName=(m:Map<string,Ap>,code:string|null|undefined,lang:string)=>{if(!code)return '';const a=m.get(code);if(!a)return code;return (lang==='ar'?(a.ar??a.en):(a.en??a.ar))??code};
export const loc=(lang:string)=>lang==='ar'?'ar-u-nu-latn':'en-GB';
export const tm=(d:Date,lang:string)=>d.toLocaleTimeString(loc(lang),{hour:'2-digit',minute:'2-digit',hour12:false});
export const dt=(d:Date,lang:string)=>d.toLocaleDateString(loc(lang),{weekday:'short',day:'numeric',month:'short'});
