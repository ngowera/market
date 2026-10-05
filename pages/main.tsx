import { createRoot } from 'react-dom/client';
import Marketplace, { Header, Footer } from '../components/marketplace';
import Admin from '../components/admin';
import ListingDetail from '../components/listing-detail';
import Help from '../app/help/page';
import { samples } from '../lib/catalog';
import '../app/globals.css';
const live = 'https://collateral-marketplace-recovery.parcelexpert2.chatgpt.site';
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const route = window.location.pathname.slice(base.length).replace(/\/$/, '') || '/';
// Pages has no server routes. Return a clear error for any attempted API request.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api/')) return Promise.resolve(new Response(JSON.stringify({error:'Open the full website to sign in or perform transactions.'}), {status:503, headers:{'Content-Type':'application/json'}}));
  return originalFetch(input, init);
};
const item = samples.find(x => route === '/listing/' + x.slug);
const content = route === '/admin' ? <Admin connected={false}/> : route === '/help' ? <Help/> : item ? <ListingDetail item={item} demo/> : route === '/' || route === '/browse' ? <Marketplace initial={samples} demo browse={route === '/browse'}/> : <><Header/><main className="help-layout"><article><h1>{route === '/account' ? 'Your account' : 'Page not found'}</h1><p>Sign in and manage transactions on the full website.</p><a className="btn primary" href={live + '/account'}>Open secure account</a></article></main><Footer/></>;
createRoot(document.getElementById('root')!).render(<><aside style={{padding:'12px 20px', background:'#fff3d4',color:'#453516',textAlign:'center',fontSize:14}}>GitHub Pages preview · sample listings and read-only admin. <a style={{textDecoration:'underline'}} href={live + (route === '/admin' ? '/admin' : '/')}>Open full website</a></aside>{content}</>);
