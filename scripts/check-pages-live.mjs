/** Lightweight public GitHub Pages HTTP smoke test after deployment. */
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const rawUrl = process.argv[2];
assert.ok(rawUrl, 'Pass the deployed GitHub Pages URL');
const pageUrl = new URL(rawUrl);
assert.equal(pageUrl.protocol, 'https:', 'GitHub Pages should be HTTPS');
assert.ok(pageUrl.pathname.startsWith('/PhianoSheets/'), `Unexpected Pages site path: ${pageUrl.pathname}`);

async function readWithRetry(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (!body) throw new Error('Empty response body');
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 10) await sleep(4000);
    }
  }
  throw new Error(`${label} did not become available: ${lastError?.message}`);
}

const html = await readWithRetry(pageUrl, 'Page HTML');
assert.match(html, /<div id="root"><\/div>/, 'React mount element missing from published HTML');
const assets = [...html.matchAll(/(?:src|href)="(\/PhianoSheets\/assets\/[^"?#]+)"/g)].map(match => match[1]);
assert.ok(assets.some(path => path.endsWith('.js')), 'Published HTML has no app JavaScript');
assert.ok(assets.some(path => path.endsWith('.css')), 'Published HTML has no stylesheet');
for (const asset of assets) {
  const uri = new URL(asset, pageUrl);
  await readWithRetry(uri, `Published asset ${asset}`);
}
console.log(`Published Pages HTTP smoke test passed: ${pageUrl} and ${assets.length} assets.`);
