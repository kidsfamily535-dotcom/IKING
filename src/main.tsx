import {createRoot} from 'react-dom/client';import './styles.css';import './eye/eye.css';import App from './App';import RoyalCut from './eye/RoyalCut';import {I18nProvider} from './i18n';
// ?house=royaljet يفتح نسخة Royal Jet. بدونها يفتح التطبيق الأصلي.
const RJ=new URLSearchParams(location.search).get('house')==='royaljet';
createRoot(document.getElementById('root')!).render(<I18nProvider>{RJ?<RoyalCut/>:<App/>}</I18nProvider>);
