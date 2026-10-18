// يولّد public/missions.js (لصفحة «استكشف» الثابتة) من المصدر الوحيد src/cinema/missions.json
import {readFileSync,writeFileSync} from 'node:fs';
const src=new URL('../src/cinema/missions.json',import.meta.url),out=new URL('../public/missions.js',import.meta.url);
const {_note,...data}=JSON.parse(readFileSync(src,'utf8'));
writeFileSync(out,'/* مولَّد تلقائيًا من src/cinema/missions.json — لا تعدّله يدويًا */\nwindow.KE_MISSIONS='+JSON.stringify(data)+';\n');
console.log('missions.js synced');
