import './status.css';
// أشكال حالات البيانات الأربع: مؤكد (معيّن ممتلئ)، تقدير (دائرة بعلامة)، محاكاة (معيّن مفرغ)، مجهول (دائرة بعلامة استفهام).
// الأيقونة تساعد على التمييز ولا تغني عن النص، فالنص يبقى ظاهرًا دائمًا.
export type ChipKind='confirmed'|'estimate'|'sim'|'unknown';
const ICON:Record<ChipKind,JSX.Element>={
 confirmed:<svg viewBox="0 0 16 16" aria-hidden><path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="currentColor"/></svg>,
 estimate:<svg viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="m5.2 8.2 2 2 3.6-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
 sim:<svg viewBox="0 0 16 16" aria-hidden><path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>,
 unknown:<svg viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M6.4 6.3a1.7 1.7 0 1 1 2.4 1.5c-.5.3-.8.6-.8 1.2M8 11.3v.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>};
export const chipKind=(s:string):ChipKind=>s==='CONFIRMED'||s==='LIVE'?'confirmed':s==='SIM'?'sim':s==='UNKNOWN'?'unknown':'estimate';
export default function StatusChip({kind,children}:{kind:ChipKind;children:React.ReactNode}){
 return <span className={`sc sc-${kind}`}>{ICON[kind]}<span>{children}</span></span>;
}
