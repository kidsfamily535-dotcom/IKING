import {useI18n,type Lang} from './i18n';
const OPTS:{l:Lang;label:string}[]=[{l:'ar',label:'العربية'},{l:'en',label:'English'}];
export default function LangSwitch(){
 const {lang,setLang,t}=useI18n();
 return <div className="lang" role="group" aria-label={t('lang.label')}>{OPTS.map(o=><button key={o.l} type="button" className={lang===o.l?'on':''} aria-pressed={lang===o.l} lang={o.l} onClick={()=>setLang(o.l)}>{o.label}</button>)}</div>;
}
