import { createRoot } from 'react-dom/client';
import Marketplace, { Header, Footer } from '../components/marketplace';
import Admin from '../components/admin';
import ListingDetail from '../components/listing-detail';
import Help from '../app/help/page';
import BiddingHelp from '../app/help/bidding/page';
import TermsHelp from '../app/help/terms/page';
import PrivacyHelp from '../app/help/privacy-and-complaints/page';
import '../app/globals.css';

if (typeof window !== 'undefined') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const route = window.location.pathname.slice(base.length).replace(/\/$/, '') || '/';
  const hasLocalApi = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (!hasLocalApi) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith('/api/')) return Promise.resolve(new Response(JSON.stringify({error:'GitHub Pages is a read-only preview. Staff sign-in requires the server-backed admin app.'}), {status:503, headers:{'Content-Type':'application/json'}}));
      return originalFetch(input, init);
    };
  }

  const helpPages: Record<string, React.ReactNode> = {
    '/help': <Help />,
    '/help/bidding': <BiddingHelp />,
    '/help/terms': <TermsHelp />,
    '/help/privacy-and-complaints': <PrivacyHelp />,
  };
  const content = route === '/admin' ? <Admin connected={hasLocalApi}/> : helpPages[route] ?? (route === '/' || route === '/browse' ? <Marketplace initial={[]} demo={false} browse={route === '/browse'}/> : <><Header/><main className="help-layout"><article><h1>Page not found</h1><p>Public browsing is read-only. Secure account and admin access are kept behind a separate portal.</p></article></main><Footer/></>);
  createRoot(document.getElementById('root')!).render(content);
}

