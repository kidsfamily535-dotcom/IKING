import {useCallback,useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import {useT} from './copy';
import type {Run} from './ctx';
import {Chip,Empty,Fld} from './ui';
// تاب «المنظمة»: يعرض الوثائق المطلوبة لنوع المنظمة وحالتها، ويسمح برفع بيانات وثيقة (رقم مرجعي + رابط https).
// كل القرارات (من يُعتمد، من يستطيع النشر) تأتي من الدوال في القاعدة. هذه الواجهة لا تقرّر شيئًا.
type Doc={doc_type:string;state:string;valid_until:string|null;review_note:string|null};
type Org={state:string;name?:string;org_kind?:string;company_status?:string;verification?:string;meets_requirements?:boolean;can_publish_supply?:boolean;required_documents?:Doc[]};
const tone=(s:string):'ok'|'est'|'unk'|'bad'=>s==='APPROVED'?'ok':s==='MISSING'?'unk':s==='REJECTED'||s==='EXPIRED'?'bad':'est';
export default function OrgTab({run}:{run:Run}){
 const T=useT();const [o,setO]=useState<Org|null>(null),[open,setOpen]=useState<string|null>(null),[ref,setRef]=useState(''),[iss,setIss]=useState(''),[vu,setVu]=useState(''),[url,setUrl]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(()=>{sb.rpc('get_my_organization').then(r=>setO((r.data??{state:'NO_ORGANIZATION'}) as Org))},[]);useEffect(load,[load]);
 const close=()=>{setOpen(null);setRef('');setIss('');setVu('');setUrl('');setMsg('')};
 const submit=async()=>{if(!open)return;setBusy(true);setMsg('');
  const r=await sb.rpc('submit_my_document',{p_doc_type:open,p_reference:ref.trim()||null,p_issuer:iss.trim()||null,p_valid_until:vu||null,p_evidence_url:url.trim()||null});setBusy(false);
  if(r.error){await run(async()=>r as any);return}
  const e=(r.data as any)?.error;if(e){setMsg((T as any)['e_'+e]??T.err);return}
  close();load()};
 if(!o)return <section className="sk-pay"><p className="sk-quiet">…</p></section>;
 if(o.state!=='OK')return <Empty title={T.orgNoT} text={T.orgNoP}/>;
 const docs=o.required_documents??[];
 return <section className="sk-pay">
  <div className="sks plain"><h3>{o.name}</h3>
   <div className="sk-row"><Chip tone="unk">{(T as any)['k_'+o.org_kind]??o.org_kind}</Chip>
    <Chip tone={o.verification==='VERIFIED'?'ok':'est'}>{o.verification==='VERIFIED'?T.orgVer:T.orgUnver}</Chip>
    <Chip tone={o.can_publish_supply?'ok':'est'}>{o.can_publish_supply?T.orgCan:T.orgCannot}</Chip></div>
   <p className="sk-trust">{o.meets_requirements?T.orgMeets:T.orgNeeds}</p></div>
  <h3 className="sk-h3">{T.orgDocs}</h3><p className="sk-trust">{T.orgNote}</p>
  <ul className="sk-oflist">{docs.map(d=><li className="sk-of s3" key={d.doc_type}>
   <div className="sk-of-h"><span className="sk-of-r"><b>{(T as any)['d_'+d.doc_type]??d.doc_type}</b></span><span className="sk-of-n"/>
    <Chip tone={tone(d.state)}>{(T as any)['s_'+d.state]??d.state}</Chip></div>
   {d.valid_until&&<p className="sk-trust" dir="ltr">{T.orgUntil} {d.valid_until}</p>}
   {d.state==='REJECTED'&&d.review_note&&<p className="sk-err" role="alert">{d.review_note}</p>}
   <div className="sk-of-f">{open!==d.doc_type?(d.state==='APPROVED'?null:<button type="button" onClick={()=>{close();setOpen(d.doc_type)}}>{d.state==='MISSING'?T.orgSend:T.orgResend}</button>)
    :<div>
     <Fld l={T.orgRef} v={ref} on={setRef}/><Fld l={T.orgIss} v={iss} on={setIss}/>
     <Fld l={T.orgValid} v={vu} on={setVu} type="date"/><Fld l={T.orgUrl} v={url} on={setUrl} hint={T.orgUrlHint}/>
     {msg&&<div className="sk-err" role="alert">{msg}</div>}
     <div className="sk-row"><button type="button" disabled={busy||(ref.trim().length<2&&!url.startsWith('https://'))} onClick={submit}>{T.orgSubmit}</button><button type="button" className="g" onClick={close}>{T.cancel}</button></div></div>}</div></li>)}</ul></section>}
