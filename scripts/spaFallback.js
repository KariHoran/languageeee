/**
 * After expo export: copy index.html → 404.html so deep links
 * (/u/*, /c/*, /d/*) still boot the SPA on static hosts.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
const notFound = path.join(dist, '404.html');

if (!fs.existsSync(index)) {
  console.error('[spaFallback] dist/index.html missing');
  process.exit(1);
}

fs.copyFileSync(index, notFound);
console.log('[spaFallback] wrote dist/404.html');
