import { createRoot } from 'react-dom/client';
import Marketplace, { Header, Footer } from '../components/marketplace';
import Admin from '../components/admin';
import ListingDetail from '../components/listing-detail';
import Help from '../app/help/page';
import BiddingHelp from '../app/help/bidding/page';
import TermsHelp from '../app/help/terms/page';
import PrivacyHelp from '../app/help/privacy-and-complaints/page';
import { samples } from '../lib/catalog';
import '../app/globals.css';

if (typeof window !== 'undefined') {
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
  const helpPages: Record<string, React.ReactNode> = {
    '/help': <Help />,
    '/help/bidding': <BiddingHelp />,
    '/help/terms': <TermsHelp />,
    '/help/privacy-and-complaints': <PrivacyHelp />,
  };
  const content = route === '/admin' ? <Admin connected={false}/> : helpPages[route] ?? (item ? <ListingDetail item={item} demo/> : route === '/' || route === '/browse' ? <Marketplace initial={samples} demo browse={route === '/browse'}/> : <><Header/><main className="help-layout"><article><h1>Page not found</h1><p>Public browsing is read-only. Secure account and admin access are kept behind a separate portal.</p></article></main><Footer/></>);
  createRoot(document.getElementById('root')!).render(content);
}

