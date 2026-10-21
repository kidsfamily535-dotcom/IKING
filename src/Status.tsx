import {useEffect,useState} from 'react';
import {sb} from './lib/supabase';
import {useI18n} from './i18n';
import Glyph from './Glyph';
import './status2.css';
// «حالتي»: مستوى الحالة 0–4 لكل دولة، يُقرأ من region_levels_current في القاعدة. لا نعلن «آمن» ولا «غير آمن»، ولا نتوقع المستقبل.
// ما انتهت صلاحيته يُعرض «غير محدّثة» ولا يُعرض كحقيقة. المستويات 3 و4 يرفعها المالك فقط (في القاعدة).
type Row={region_code:string;region_name:string;level:number;verification:string;source_note:string|null;verified_at:string|null;review_due_at:string|null;freshness:string};
type L='ar'|'en'|'ru'|'tr';
const C:Record<L,{nav:string;title:string;lead:string;lv:string[];say:string[];ver:Record<string,string>;stale:string;src:string;chk:string;nxt:string;load:string;err:string;none:string;foot:string}>={
 ar:{nav:'حالتي',title:'حالتك الآن',lead:'مستوى الحالة لكل دولة، بمصدره وتاريخ آخر تحقق.',lv:['مستقر','مراقبة','تأثر محدود','تأثر كبير','حرج'],
  say:['لا توجد قيود جديدة حسب المصادر الرسمية. سنُنبّهك عند أي تغيير.','هناك تحذير رسمي ساري. العمليات ما زالت تسير وفق المصدر. تابع رحلتك واحتفظ بخطة بديلة.','هناك إلغاءات وتأخيرات حسب المصدر. إن أردت، نرتّب لك خيارات ونرفع طلبك بعد موافقتك.','تأثرت العمليات الجوية بشكل كبير حسب المصدر. حالتك تُحوَّل إلى مشرف بشري لمتابعتها.','الوضع حرج. لا نقدّر لك الأمان من عندنا؛ تواصل مع الجهات الرسمية، ويتابعك مشرف بشري.'],
  ver:{CONFIRMED:'مؤكد · مصدر رسمي',LIKELY:'مرجّح · مصدران مستقلان',UNCONFIRMED:'غير مؤكد'},stale:'غير محدّثة، لا تعتمد عليها كحقيقة',src:'المصدر',chk:'آخر تحقق',nxt:'المراجعة القادمة',load:'نقرأ الحالة…',err:'تعذّر قراءة الحالة الآن. لا نعرف، فلا نخمّن.',none:'لا توجد حالة معتمدة بعد.',foot:'الحالة معلومات لا قرار. القرار دائمًا بيدك.'},
 en:{nav:'My status',title:'Your status now',lead:'Status level per country, with its source and last check.',lv:['Stable','Watching','Limited impact','Major impact','Critical'],
  say:['No new restrictions per official sources. We will alert you to any change.','An official warning is in force. Operations continue per the source. Follow your trip and keep a backup plan.','There are cancellations and delays per the source. If you wish, we arrange options and submit your request once you approve.','Air operations are heavily affected per the source. Your case goes to a human supervisor.','The situation is critical. We do not judge safety ourselves; contact the official authorities, and a human supervisor follows up.'],
  ver:{CONFIRMED:'Confirmed · official source',LIKELY:'Likely · two independent sources',UNCONFIRMED:'Unconfirmed'},stale:'Not current; do not rely on it as fact',src:'Source',chk:'Last checked',nxt:'Next review',load:'Reading status…',err:'Could not read the status now. We do not know, so we do not guess.',none:'No approved status yet.',foot:'Status is information, not a decision. The decision is always yours.'},
 ru:{nav:'Мой статус',title:'Ваш статус сейчас',lead:'Уровень статуса по странам, с источником и датой последней проверки.',lv:['Стабильно','Наблюдение','Ограниченное влияние','Сильное влияние','Критично'],
  say:['Новых ограничений по официальным источникам нет. Сообщим об изменениях.','Действует официальное предупреждение. Полёты идут по данным источника. Следите за поездкой и держите запасной план.','По источнику есть отмены и задержки. По желанию подберём варианты и передадим запрос после вашего согласия.','Авиасообщение сильно затронуто по данным источника. Ваш случай передаётся живому куратору.','Ситуация критическая. Безопасность мы сами не оцениваем; свяжитесь с официальными органами, куратор вас сопровождает.'],
  ver:{CONFIRMED:'Подтверждено · официальный источник',LIKELY:'Вероятно · два независимых источника',UNCONFIRMED:'Не подтверждено'},stale:'Не обновлено, не считайте это фактом',src:'Источник',chk:'Проверено',nxt:'Следующая проверка',load:'Читаем статус…',err:'Сейчас не удалось прочитать статус. Мы не знаем и не гадаем.',none:'Утверждённого статуса пока нет.',foot:'Статус — информация, а не решение. Решение всегда за вами.'},
 tr:{nav:'Durumum',title:'Şu anki durumunuz',lead:'Ülke bazında durum seviyesi; kaynağı ve son kontrol tarihiyle.',lv:['Sakin','İzleme','Sınırlı etki','Büyük etki','Kritik'],
  say:['Resmî kaynaklara göre yeni kısıtlama yok. Değişiklikte sizi uyarırız.','Yürürlükte resmî bir uyarı var. Operasyonlar kaynağa göre sürüyor. Yolculuğunuzu izleyin, yedek plan tutun.','Kaynağa göre iptal ve gecikmeler var. İsterseniz seçenekleri hazırlar, onayınızla talebi iletiriz.','Kaynağa göre hava operasyonları ciddi etkilendi. Durumunuz bir insan sorumluya aktarılır.','Durum kritik. Güvenliği kendimiz değerlendirmeyiz; resmî mercilere başvurun, bir insan sorumlu sizi takip eder.'],
  ver:{CONFIRMED:'Doğrulandı · resmî kaynak',LIKELY:'Muhtemel · iki bağımsız kaynak',UNCONFIRMED:'Doğrulanmadı'},stale:'Güncel değil; gerçek olarak almayın',src:'Kaynak',chk:'Son kontrol',nxt:'Sonraki inceleme',load:'Durum okunuyor…',err:'Durum şu an okunamadı. Bilmiyoruz, tahmin etmiyoruz.',none:'Henüz onaylı bir durum yok.',foot:'Durum bilgidir, karar değildir. Karar her zaman sizindir.'}};
const LOC={ar:'ar-EG',en:'en-GB',tr:'tr-TR',ru:'ru-RU'} as const;
export const statusNav=(l:string)=>(C[l as L]||C.en).nav;
export default function Status(){
 const {lang}=useI18n(),c=C[lang as L]||C.en,loc=LOC[lang as L]||'en-GB';
 const [rows,setRows]=useState<Row[]|null>(null),[bad,setBad]=useState(false);
 useEffect(()=>{let live=true;
  sb.from('region_levels_current').select('region_code,region_name,level,verification,source_note,verified_at,review_due_at,freshness').order('level',{ascending:false}).order('region_name').then(({data,error})=>{if(!live)return;if(error||!data){setBad(true);setRows([]);return}setRows(data as Row[])});
  return()=>{live=false}},[]);
 const f=(x:string|null)=>x?new Date(x).toLocaleString(loc,{dateStyle:'medium',timeStyle:'short'}):'—';
 return <><Glyph k="radar" s={56}/><h2 className="big">{c.title}</h2><p className="dim">{c.lead}</p>
  {rows===null&&<p className="dim sm">{c.load}</p>}
  {bad&&<div className="nt" role="alert">{c.err}</div>}
  {rows&&!bad&&rows.length===0&&<p className="dim sm">{c.none}</p>}
  <ul className="st-l">{(rows||[]).map(r=>{const lv=Math.max(0,Math.min(4,r.level)),old=r.freshness!=='CURRENT';
   return <li key={r.region_code} className={old?'old':''}><details><summary><span className="st-n">{r.region_name}</span><span className="st-seg" role="img" aria-label={`${lv}/4 · ${c.lv[lv]}`}>{[1,2,3,4].map(i=><i key={i} className={i<=lv?'o':''}/>)}</span><b>{lv} · {c.lv[lv]}</b>{old&&<span className="badge u">{c.stale}</span>}</summary>
    <p>{c.say[lv]}</p>
    <div className="row"><span>{c.src}</span><span>{r.source_note||'—'}</span></div>
    <div className="row"><span>{c.chk}</span><span>{f(r.verified_at)} · {c.ver[r.verification]||c.ver.UNCONFIRMED}</span></div>
    <div className="row"><span>{c.nxt}</span><span>{f(r.review_due_at)}</span></div></details></li>})}</ul>
  <p className="dim sm">{c.foot}</p></>;
}
