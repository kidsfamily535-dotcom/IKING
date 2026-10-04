import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {ar} from './ar';import {en} from './en';
import type {Airport} from '../data/types';
export type Lang='ar'|'en';
const D:Record<Lang,Record<string,string>>={ar,en};
const KEY='iking_lang';
const valid=(v:unknown):v is Lang=>v==='ar'||v==='en';
const stored=():Lang|null=>{try{const v=localStorage.getItem(KEY);return valid(v)?v:null}catch{return null}};
let cur:Lang=stored()??'ar';
export const getLang=()=>cur;
export const hasStoredLang=()=>stored()!==null;
export const hasKey=(k:string)=>k in ar;
const fill=(s:string,v?:Record<string,string|number>)=>{if(v)for(const x in v)s=s.split(`{${x}}`).join(String(v[x]));return s};
// ترجمة بدون hook: تُستخدم في طبقة البيانات (mockApi/supabaseApi) وتقرأ اللغة الحالية
export const tr=(k:string,v?:Record<string,string|number>)=>fill(D[cur][k]??D.ar[k]??k,v);
export const trIn=(l:Lang,k:string,v?:Record<string,string|number>)=>fill(D[l][k]??D.ar[k]??k,v);
export const airportName=(a:Airport)=>cur==='ar'?a.nameAr:a.nameEn;
export const catL=(c:string)=>hasKey('cat.'+c)?tr('cat.'+c):c;
type Ctx={lang:Lang;dir:'rtl'|'ltr';setLang:(l:Lang,persist?:boolean)=>void;t:typeof tr};
const C=createContext<Ctx|null>(null);
export function I18nProvider({children}:{children:ReactNode}){
 const [lang,set]=useState<Lang>(cur);const dir:'rtl'|'ltr'=lang==='ar'?'rtl':'ltr';
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=dir},[lang,dir]);
 const setLang=useCallback((l:Lang,persist=true)=>{cur=l;if(persist){try{localStorage.setItem(KEY,l)}catch{/* التخزين غير متاح */}}set(l)},[]);
 const value=useMemo(()=>({lang,dir,setLang,t:tr}),[lang,dir,setLang]);
 return <C.Provider value={value}>{children}</C.Provider>;
}
export const useI18n=():Ctx=>{const c=useContext(C);if(!c)throw new Error('I18nProvider missing');return c};
