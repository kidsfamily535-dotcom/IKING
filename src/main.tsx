import {createRoot} from 'react-dom/client';import './styles.css';import './eye/eye.css';import App from './App';import RoyalCut from './eye/RoyalCut';import JetexCut from './eye/JetexCut';import {I18nProvider} from './i18n';import CustomerApp from './customer/CustomerApp';
// ?house=royaljet أو ?house=jetex يفتح نسخة العميل. بدونها يفتح التطبيق الأصلي.
const H=new URLSearchParams(location.search).get('house');
createRoot(document.getElementById('root')!).render(<I18nProvider>{location.hash.startsWith('#my')?<CustomerApp/>:H==='royaljet'?<RoyalCut/>:H==='jetex'?<JetexCut/>:<App/>}</I18nProvider>);

addEventListener('hashchange',()=>location.reload());
