import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
// تقرير الصيد اليومي للمشغّل: تجهيز مسودة → مراجعتك → اعتماد. لا يظهر للمشغّل قبل اعتمادك. بلا هوية عميل ولا درجات ولا هامش.
type It={route:string;when?:string;reason:string;confidence:string};
type Rp={item_idx:number;reply:string;note:string|null;at:string};
type Rep={id:string;status:string;report_date:string;items:It[];created_at:string;company:string;replies:Rp[]};
type Co={id:string;name:string};
const RL:Record<string,string>={INTERESTED:'مهتم',NOT_FIT:'مش مناسب',DETAILS:'عايز تفاصيل',HAVE_AIRCRAFT:'عنده طيارة متاحة'};
const CL:Record<string,string>={VERIFIED:'مؤكد',ESTIMATED:'تقديري',UNCONFIRMED:'غير مؤكد'};
const SL:Record<string,string>={DRAFT:'مسودة',APPROVED:'معتمد',WITHDRAWN:'مسحوب'};
const blank=():It=>({route:'',when:'',reason:'',confidence:'UNCONFIRMED'});
export default function Hunt({setErr}:{setErr:(s:string)=>void}){
 const [cos,setCos]=useState<Co[]>([]),[co,setCo]=useState(''),[items,setItems]=useState<It[]>([blank()]),[rows,setRows]=useState<Rep[]|null>(null),[b,setB]=useState(false);
 const load=useCallback(async()=>{const [a,c]=await Promise.all([sb.rpc('admin_hunt_list'),sb.from('operator_companies').select('id,name').eq('status','active').order('name')]);
  if(a.error){setErr('تعذّر قراءة تقارير الصيد. ده مش معناه إنها فاضية.');setRows([])}else setRows((a.data??[]) as Rep[]);
  if(!c.error){const d=(c.data??[]) as Co[];setCos(d);setCo(x=>x||d[0]?.id||'')}},[setErr]);
 useEffect(()=>{load()},[load]);
 const upd=(i:number,k:keyof It,v:string)=>setItems(items.map((x,j)=>j===i?{...x,[k]:v}:x));
 const ready=!!co&&items.every(x=>x.route.trim()&&x.reason.trim());
 const create=async()=>{setB(true);setErr('');const payload=items.map(x=>({route:x.route.trim(),when:x.when?.trim()||undefined,reason:x.reason.trim(),confidence:x.confidence}));
  const r=await sb.rpc('admin_hunt_create',{p_company:co,p_items:payload});setB(false);if(r.error){setErr('ما اتحفظش: '+r.error.message);return}setItems([blank()]);await load()};
 const review=async(id:string,a:'APPROVE'|'WITHDRAW')=>{setB(true);setErr('');const r=await sb.rpc('admin_hunt_review',{p_id:id,p_action:a});setB(false);if(r.error){setErr('ما اتنفّذش: '+r.error.message);return}await load()};
 return <div className="ad-hunt">
  <section className="ad-hform"><h2>مسودة جديدة</h2>
   <p className="sub">اكتب فرص حقيقية على خطوط المشغّل بس. ممنوع أي اسم عميل أو درجة أو هامش. اختار درجة التأكد بصدق.</p>
   <label>المشغّل</label><select value={co} onChange={e=>setCo(e.target.value)}>{cos.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
   {items.map((x,i)=><div className="ad-hitem" key={i}>
    <input placeholder="الخط (مثلًا القاهرة ← جدة)" value={x.route} maxLength={120} onChange={e=>upd(i,'route',e.target.value)}/>
    <input placeholder="الموعد (اختياري)" value={x.when} maxLength={120} onChange={e=>upd(i,'when',e.target.value)}/>
    <textarea placeholder="سبب الفرصة بجملة واضحة" rows={2} value={x.reason} maxLength={300} onChange={e=>upd(i,'reason',e.target.value)}/>
    <select value={x.confidence} onChange={e=>upd(i,'confidence',e.target.value)}>{Object.entries(CL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    {items.length>1&&<button type="button" className="q" onClick={()=>setItems(items.filter((_,j)=>j!==i))}>احذف</button>}</div>)}
   <div className="ad-hrow">{items.length<5&&<button type="button" className="q" onClick={()=>setItems([...items,blank()])}>+ فرصة</button>}
    <button type="button" className="p" disabled={b||!ready} onClick={create}>احفظ كمسودة</button></div></section>
  <section><h2>التقارير وردود المشغّلين</h2>
   {rows===null?<p className="sub">…</p>:rows.length===0?<p className="sub">مفيش تقارير لسه.</p>:rows.map(r=><article className="ad-hrep" key={r.id}>
    <header><b>{r.company}</b><span>{SL[r.status]??r.status} · {r.report_date}</span></header>
    {r.items.map((it,i)=>{const rp=r.replies.filter(x=>x.item_idx===i);return <div key={i} className="ad-hline"><p><b>{it.route}</b> · {CL[it.confidence]??it.confidence}{it.when?' · '+it.when:''}<br/>{it.reason}</p>
     {rp.map((x,j)=><p key={j} className="ad-hreply">رد المشغّل: <b>{RL[x.reply]??x.reply}</b>{x.note?' — '+x.note:''}</p>)}</div>})}
    <div className="ad-hrow">{r.status==='DRAFT'&&<button type="button" className="p" disabled={b} onClick={()=>review(r.id,'APPROVE')}>اعتمد وأظهره للمشغّل</button>}
     {r.status!=='WITHDRAWN'&&<button type="button" className="q" disabled={b} onClick={()=>review(r.id,'WITHDRAW')}>اسحبه</button>}</div></article>)}</section></div>}
