import type { ComponentProps } from 'react';
export default function Link({href, ...props}: ComponentProps<'a'>) {
  const target = typeof href === 'string' && href.startsWith('/') ? import.meta.env.BASE_URL.replace(/\/$/, '') + href : href;
  return <a {...props} href={target}/>;
}
