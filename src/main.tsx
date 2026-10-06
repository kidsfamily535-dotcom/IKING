import {createRoot} from 'react-dom/client';import './styles.css';import './eye/eye.css';import App from './App';import RoyalCut from './eye/RoyalCut';import JetexCut from './eye/JetexCut';import JourneysCut from './eye/JourneysCut';import OperatorLink from './OperatorLink';import OperatorDesk from './OperatorDesk';import {I18nProvider} from './i18n';
// ?house=royaljet أو ?house=jetex أو ?view=journeys يفتح نسخة منفصلة. بدونها يفتح التطبيق الأصلي.
const Q=new URLSearchParams(location.search),H=Q.get('house');
createRoot(document.getElementById('root')!).render(<I18nProvider>{H==='royaljet'?<RoyalCut/>:H==='jetex'?<JetexCut/>:Q.get('view')==='journeys'?<JourneysCut/>:Q.get('view')==='operator'?<OperatorLink/>:Q.get('view')==='desk'?<OperatorDesk/>:<App/>}</I18nProvider>);
