import {useI18n} from '../i18n';
// شريط علوي واحد لكل شاشات العميل العامة: الشعار + 4 وجهات حقيقية فقط (لا أزرار تقود إلى فراغ).
const N:Record<string,[string,string,string,string]>={
 ar:['الرئيسية','اكتشف العين','راقب رحلتي','احجز رحلتك'],
 en:['Home','Discover the Eye','Watch my trip','Book a trip'],
 ru:['Главная','Откройте Око','Следить за поездкой','Заказать рейс'],
 tr:['Ana sayfa','Gözü keşfet','Yolculuğumu izle','Uçuş talep et']};
const H=['/','?view=discover','?view=watch','?view=cabin'];
const D=['M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z','M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z','M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7z','M3 13l18-8-6 16-3-7z'];
export default function TopBar({active,name}:{active:0|1|2|3;name:string}){
 const {lang}=useI18n(),n=N[lang]||N.en;
 return <header className="tb"><a className="tb-brand" href="/"><svg viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C9 2 31 2 38 12 31 22 9 22 2 12Z" fill="none" stroke="#d9bf86" strokeWidth="1.2"/><circle cx="20" cy="12" r="4.6" fill="#d9bf86"/><circle cx="20" cy="12" r="1.8" fill="#02040a"/></svg><span>{name}<small>PRIVATE AVIATION INTELLIGENCE</small></span></a>
  <nav className="tb-nav" aria-label="main">{n.map((l,i)=><a key={i} href={H[i]} aria-current={i===active?'page':undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d={D[i]}/></svg><span>{l}</span></a>)}</nav></header>;
}
