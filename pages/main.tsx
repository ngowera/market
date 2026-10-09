import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Link from 'next/link';
import Marketplace, { Header, Footer } from '../components/marketplace';
import Admin from '../components/admin';
import ListingDetail from '../components/listing-detail';
import Help from '../app/help/page';
import BiddingHelp from '../app/help/bidding/page';
import TermsHelp from '../app/help/terms/page';
import PrivacyHelp from '../app/help/privacy-and-complaints/page';
import type { Listing } from '../lib/catalog';
import '../app/globals.css';

function StaticListing({slug}: {slug:string}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [demo, setDemo] = useState(false);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/catalog', {cache:'no-store'})
      .then(async response => {
        if (!response.ok) throw new Error('Catalogue unavailable');
        const data: {listings?:Listing[];demo?:boolean} = await response.json();
        const item = data.listings?.find(candidate => candidate.slug === slug);
        if (!active) return;
        if (item) {
          setListing(item);
          setDemo(data.demo === true);
        } else {
          setMissing(true);
        }
      })
      .catch(() => {
        if (active) setMissing(true);
      });
    return () => { active = false; };
  }, [slug]);

  if (listing) return <ListingDetail item={listing} demo={demo}/>;
  return <><Header/><main className="help-layout"><article><h1>{missing ? 'Listing not found' : 'Loading listing…'}</h1><p>{missing ? 'This listing may have ended or is no longer available.' : 'Loading current listing details.'}</p><Link href="/browse">Browse assets</Link></article></main><Footer/></>;
}

if (typeof window !== 'undefined') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const route = window.location.pathname.slice(base.length).replace(/\/$/, '') || '/';
  const hasLocalApi = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

  if (!hasLocalApi) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith('/api/')) return originalFetch(input, init);
      if (!apiUrl || !supabaseKey)
        return new Response(JSON.stringify({ error: 'The Supabase API endpoint and publishable key are not configured for this deployment.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });

      const path = url.slice('/api/'.length);
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      headers.set('x-cmrp-api-client', 'edge');
      headers.set('apikey', supabaseKey);
      const accessToken = sessionStorage.getItem('cmrp_access_token');
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
      if (path === 'auth/refresh') {
        const refreshToken = sessionStorage.getItem('cmrp_refresh_token');
        if (refreshToken) headers.set('x-cmrp-refresh-token', refreshToken);
      }

      const response = await originalFetch(`${apiUrl}/${path}`, {
        ...init,
        headers,
        credentials: 'omit',
      });
      if (response.ok && ['auth/login', 'auth/mfa', 'auth/refresh'].includes(path)) {
        const tokens: { access_token?: string; refresh_token?: string } =
          await response.clone().json();
        if (tokens.access_token) sessionStorage.setItem('cmrp_access_token', tokens.access_token);
        if (tokens.refresh_token) sessionStorage.setItem('cmrp_refresh_token', tokens.refresh_token);
      }
      if (path === 'auth/logout' && response.ok) {
        sessionStorage.removeItem('cmrp_access_token');
        sessionStorage.removeItem('cmrp_refresh_token');
      }
      return response;
    };
  }

  const helpPages: Record<string, React.ReactNode> = {
    '/help': <Help />,
    '/help/bidding': <BiddingHelp />,
    '/help/terms': <TermsHelp />,
    '/help/privacy-and-complaints': <PrivacyHelp />,
  };
  const content = route.startsWith('/listing/')
    ? <StaticListing slug={decodeURIComponent(route.slice('/listing/'.length))}/>
    : route === '/admin'
      ? <Admin connected={hasLocalApi || (!!apiUrl && !!supabaseKey)}/>
      : helpPages[route] ?? (route === '/' || route === '/browse'
        ? <Marketplace initial={[]} demo={false} browse={route === '/browse'}/>
        : <><Header/><main className="help-layout"><article><h1>Page not found</h1><p>Public browsing is read-only. Secure account and admin access are kept behind a separate portal.</p></article></main><Footer/></>);
  createRoot(document.getElementById('root')!).render(content);
}

