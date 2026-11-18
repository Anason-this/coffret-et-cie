import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';

const exec = promisify(execFile);
const origin = 'https://idelo.me';
const output = new URL('idelo-products.json', import.meta.url);
const decode = value => (value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, key) => {
  if (key.startsWith('#')) return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)));
  return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[key] ?? entity;
});
const realText = html => decode(html?.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const attr = (html, name) => decode(html.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))?.[1]);

async function fetchPublic(path) {
  return (await exec('curl.exe', ['--fail', '--silent', '--show-error', '--compressed',
    '--retry', '2', '--retry-max-time', '25', '--max-time', '15', origin + path],
    { maxBuffer: 5 * 1024 * 1024 })).stdout;
}

const index = await fetchPublic('/sitemap.xml');
const maps = [...index.matchAll(/<loc>https:\/\/idelo\.me(\/sitemap-produits-\d+\.xml)<\/loc>/g)].map(match => match[1]);
if (!maps.length) throw new Error('No product sitemap found');
const pages = await fetchPublic('/sitemap-pages.xml');
const catalogPaths = ['/', ...[...pages.matchAll(/<loc>https:\/\/idelo\.me\/collections(\/page\/\d+\/)<\/loc>/g)].map(match => match[1])];
const expected = new Map();
for (const map of maps) {
  const xml = await fetchPublic(map);
  for (const [, slug] of xml.matchAll(/<loc>https:\/\/idelo\.me\/produits\/([a-z\d-]+)\/<\/loc>/g)) {
    if (expected.has(slug)) throw new Error('Duplicate product in sitemap: ' + slug);
    expected.set(slug, null);
  }
}
if (!expected.size) throw new Error('Empty product sitemap');

function readCards(html) {
  for (const [, opening, body] of html.matchAll(/<article\b([^>]*\bdata-product-card\b[^>]*)>([\s\S]*?)<\/article>/g)) {
    const slug = body.match(/href="(?:https:\/\/idelo\.me)?\/produits\/([a-z\d-]+)\/"/)?.[1];
    if (!expected.has(slug)) continue;
    const sku = realText(body.match(/<p class="card-ref">([\s\S]*?)<\/p>/)?.[1]);
    const name = attr(opening, 'data-name');
    const family = attr(opening, 'data-family');
    const type = attr(opening, 'data-type');
    const specification = realText(body.match(/<p class="card-specification">([\s\S]*?)<\/p>/)?.[1]);
    const imgTag = body.match(/<img\b[^>]*>/)?.[0];
    const image = imgTag && attr(imgTag, 'src');
    if (!sku || !name || !family || !image) continue;
    const photo = new URL(image, origin + '/collections/');
    if (photo.origin !== origin || !photo.pathname.startsWith('/assets/')) continue;
    const quantity = realText(body.match(/class="stock-indicator__value"[^>]*>\s*<strong>([\s\S]*?)<\/strong>/)?.[1]);
    const stock = /^\+?\d[\d ]*$/.test(quantity) ? Number(quantity.replace(/[+ ]/g, '')) : null;
    expected.set(slug, {
      id: slug, sku, name, family, type, specification, photo: photo.href,
      colors: attr(opening, 'data-variants').split(/\s+/).filter(Boolean),
      stock, approximate: quantity.startsWith('+'),
    });
  }
}

for (let offset = 0; offset < catalogPaths.length; offset += 3) {
  const batch = catalogPaths.slice(offset, offset + 3);
  const results = await Promise.allSettled(batch.map(path => fetchPublic('/collections' + path)));
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') readCards(results[i].value);
    else console.error('Unavailable collection page:', batch[i]);
  }
  if (offset % 24 === 0) console.log('Scanned', offset + batch.length, '/', catalogPaths.length);
}

const missing = [...expected].filter(([, value]) => !value).map(([slug]) => slug);
if (missing.length) {
  console.error('Missing products:', missing.join(', '));
  throw new Error(missing.length + ' sitemap products have no matching catalog card');
}
await writeFile(output, JSON.stringify({ source: origin, importedAt: new Date().toISOString(), products: [...expected.values()] }, null, 2) + '\n');
console.log('Matched every sitemap product:', expected.size);
