'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="page-wrap"><div className="empty-state"><h1>We couldn’t load this page.</h1><p style={{margin:'20px 0'}}>Check the service connection and try again. Your request has not been confirmed.</p><button className="btn primary" onClick={reset}>Try again</button><Link className="btn secondary" style={{marginLeft:12}} href="/">Marketplace</Link></div></main>}
