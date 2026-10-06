import {useI18n} from './i18n';
// مسار «من ← إلى» بالاتجاه الصحيح لكل لغة. كل اسم داخل <bdi> عشان المتصفح ما يدمج الاسمين العربيين
// والسهم في جملة واحدة معكوسة (قاعدة اتجاه النص): في العربية الانطلاق على اليمين والسهم يشاور لليسار.
export default function Route({from,to}:{from:string;to:string}){
 const {dir}=useI18n();
 return <span dir={dir}><bdi>{from}</bdi> <span aria-hidden="true">{dir==='rtl'?'←':'→'}</span> <bdi>{to}</bdi></span>;
}
