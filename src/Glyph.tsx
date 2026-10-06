// رموز العين: خطوط ذهبية وزرقاء ترسم نفسها عند الظهور ثم تتحرك حركة هادئة ذات معنى (مراقبة، مسح، انتظار).
const P='M44 24 36 21H24L14 8h-4l6 13H8l-3-4H2l2 7-2 7h3l3-4h6l-6 13h4l10-13h12z';
const d=(c='')=>({pathLength:1 as const,className:('d '+c).trim()});
export default function Glyph({k,s=44}:{k:string;s?:number}){
 const b=(c:React.ReactNode)=><svg className={`gl gl-${k}`} width={s} height={s} viewBox="0 0 48 48" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{c}</svg>;
 switch(k){
  case 'plane':return b(<><path className="b" d="M4 40Q24 4 44 18" strokeDasharray="2 4"/><path className="fly" d={P}/></>);
  case 'radar':return b(<><circle {...d()} cx="24" cy="24" r="20"/><circle {...d()} cx="24" cy="24" r="12" opacity=".6"/><path className="sweep" d="M24 24V4"/><circle className="blip" cx="33" cy="15" r="2" fill="currentColor"/></>);
  case 'clock':return b(<><circle {...d()} cx="24" cy="24" r="20"/><path className="hand h" d="M24 24V13"/><path className="hand m" d="M24 24V8"/><circle cx="24" cy="24" r="1.6" fill="currentColor"/></>);
  case 'wx':return b(<><g className="rays"><circle {...d()} cx="17" cy="17" r="6"/>{[0,45,90,135,180,225,270,315].map(a=><path key={a} {...d()} d="M17 6v3" transform={`rotate(${a} 17 17)`}/>)}</g><path className="b cloud" d="M16 40h20a7 7 0 0 0 0-14 10 10 0 0 0-19 2 6 6 0 0 0-1 12z"/></>);
  case 'air':return b(<><path {...d()} d="M4 36h40" opacity=".5"/><circle className="ring" cx="9" cy="36" r="3"/><circle className="ring r2" cx="39" cy="36" r="3"/><circle cx="9" cy="36" r="2" fill="currentColor"/><circle cx="39" cy="36" r="2" fill="currentColor"/><path className="b" d="M9 32Q24 6 39 32" strokeDasharray="1 4"/></>);
  case 'road':return b(<><path {...d()} d="M5 40Q24 6 43 40" opacity=".5"/><path className="dash b" d="M5 40Q24 6 43 40" strokeDasharray="3 5"/><circle className="car" r="2.6" fill="currentColor"/></>);
  case 'land':return b(<><path {...d()} d="M3 38h42"/><path className="b" d="M14 38h4M22 38h4M30 38h4"/><path className="land" d={P}/><ellipse className="ripple" cx="24" cy="38" rx="6" ry="2"/></>);
  case 'speed':return b(<><path {...d()} d="M7 36A19 19 0 0 1 41 36"/><path className="needle" d="M24 36V17"/><circle cx="24" cy="36" r="2" fill="currentColor"/><path className="b" d="M10 40h6M32 40h6" opacity=".6"/></>);
  case 'lock':return b(<><rect {...d()} x="12" y="22" width="24" height="17" rx="3"/><path {...d('b')} d="M17 22v-5a7 7 0 0 1 14 0v5"/><circle className="key" cx="24" cy="30" r="2.4" fill="currentColor"/></>);
  case 'seat':return b(<><path {...d()} d="M13 23v-9a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v9"/><path {...d('b')} d="M7 27a4 4 0 0 1 8 0v4h18v-4a4 4 0 0 1 8 0v11H7z"/><path className="breath" d="M18 17h12"/></>);
  case 'flex':return b(<><g className="sl"><path {...d()} d="M8 18h31m-6-6 6 6-6 6"/></g><g className="sl r"><path {...d('b')} d="M40 32H9m6-6-6 6 6 6"/></g></>);
  case 'star':return b(<><path className="spark" d="M24 5 28.5 19.5 43 24 28.5 28.5 24 43 19.5 28.5 5 24 19.5 19.5z"/></>);
  case 'lens':return b(<><g className="scanl"><circle {...d()} cx="21" cy="21" r="12"/><circle className="blip" cx="21" cy="21" r="2.4" fill="currentColor"/></g><path {...d('b')} d="M30 30 42 42"/></>);
  case 'scale':return b(<><path {...d()} d="M24 8v30M15 38h18"/><g className="beam"><path {...d('b')} d="M9 14h30"/><path {...d()} d="M9 14 4 26h10zM39 14l-5 12h10z"/></g></>);
  default:return null}}
