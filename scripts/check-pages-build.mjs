/** Fail CI if the GitHub Pages output points at the wrong base or missing assets. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = '/PhianoSheets/';
const html = readFileSync('dist/index.html', 'utf8');
assert.match(html, /<div id="root"><\/div>/, 'React mount element missing');
assert.doesNotMatch(html, /(?:src|href)="\/assets\//, 'Root-relative Vite assets would 404 on GitHub Pages');

const assets = [...html.matchAll(/(?:src|href)="(\/PhianoSheets\/assets\/[^"?#]+)"/g)]
  .map(match => match[1]);
assert.ok(assets.some(path => path.endsWith('.js')), 'Missing Pages-prefixed JavaScript bundle');
assert.ok(assets.some(path => path.endsWith('.css')), 'Missing Pages-prefixed stylesheet');
for (const asset of assets) {
  const localPath = join('dist', asset.slice(BASE.length));
  assert.ok(existsSync(localPath), `Built asset missing: ${localPath}`);
}
console.log(`Pages asset smoke test passed (${assets.length} referenced JS/CSS files, base ${BASE}).`);
