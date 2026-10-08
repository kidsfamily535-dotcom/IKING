// هوية IKING: حرف I هو العين (مقلة ذهبية فيها طائرة). النص ثابت LTR في كل اللغات.
export function EyeMark({className=''}:{className?:string}){
 return <svg className={`ik-eye ${className}`} viewBox="0 0 120 70" aria-hidden focusable="false" overflow="visible">
  <path d="M4 35C26 2 94 2 116 35 94 68 26 68 4 35Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
  <circle cx="60" cy="35" r="18" fill="currentColor"/>
  <path transform="translate(60 35) scale(.56) translate(-60 -37)" d="M60 15c2 0 3 3 3 7v9l21 11v4l-21-5v10l7 5v3l-10-2-10 2v-3l7-5V41l-21 5v-4l21-11v-9c0-4 1-7 3-7Z" fill="var(--bg)"/>
 </svg>;
}
export default function Logo({size='md'}:{size?:'sm'|'md'|'xl'}){
 return <span className={`ik-logo ${size}`} dir="ltr" role="img" aria-label="IKING"><span className="ik-wm" aria-hidden><span className="ik-i"><EyeMark/>ı</span>king</span></span>;
}
