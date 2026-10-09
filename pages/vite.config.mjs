import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig({
 root: root + 'pages', base: process.env.PAGES_BASE_PATH || '/market/',
 plugins: [
  {name:'pages-asset-paths', enforce:'pre', transform(code,id) {
   if (!id.startsWith(root) || id.includes('node_modules') || !/\.(tsx|ts)$/.test(id)) return;
   return code.replace(/(["'])\/(assets\/[^"']+|logo\.svg|favicon\.svg)\1/g, (_,quote,p) => quote + (process.env.PAGES_BASE_PATH || '/market/') + p + quote);
  }}, react()
 ],
 resolve:{alias:{'next/link':root+'pages/link.tsx','@':root}},
 publicDir:root+'public', build:{outDir:root+'out-pages',emptyOutDir:true},
});
