import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const exec = promisify(execFile);
const origin = 'https://idelo.me';
const output = new URL('idelo-products.json', import.meta.url);
const pricesOnly = process.argv.includes('--prices-only');
const existingCatalog = pricesOnly ? JSON.parse(await readFile(output, 'utf8')).products : [];
const publicPrices = new Map();
const decode = value => (value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, key) => {
  if (key.startsWith('#')) return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)));
  return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[key] ?? entity;
});
const realText = html => decode(html?.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const attr = (html, name) => decode(html.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))?.[1]);

function minorUnits(value) {
  const match = value.replace(/\s/g, '').match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

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
    if (pricesOnly) {
      const priceLabel = realText(body.match(/<p class="card-price">([\s\S]*?)<\/p>/)?.[1]);
      const minimumLabel = realText(body.match(/<p class="card-minimum">([\s\S]*?)<\/p>/)?.[1]);
      const shown = priceLabel.match(/^([\d ,.]+) DH TTC\s*\/\s*pièce$/i);
      const minimum = minimumLabel.match(/^Dès (\d+) pièces · sans marquage$/i);
      const unitMinor = minorUnits(attr(opening, 'data-price'));
      if (sku && shown && minimum && unitMinor !== null && unitMinor === minorUnits(shown[1])) {
        const price = { sku, unitMinor, minimum: Number(minimum[1]) };
        const previous = publicPrices.get(slug);
        if (previous && (previous.sku !== sku || previous.unitMinor !== unitMinor || previous.minimum !== price.minimum)) {
          throw new Error('Conflicting Idelo prices for ' + slug);
        }
        publicPrices.set(slug, price);
      }
      continue;
    }
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

if (pricesOnly) {
  const missing = existingCatalog.filter(p => publicPrices.get(p.id)?.sku !== p.sku);
  for (const product of missing) {
    if (!expected.has(product.id)) throw new Error('Product is no longer in Idelo’s sitemap: ' + product.id);
    const html = await fetchPublic('/produits/' + product.id + '/');
    const detail = html.match(/<article\b[^>]*\bdata-product\s+data-ref="[^"]+"[^>]*>/)?.[0];
    const shown = realText(html.match(/<strong id="unit-price">([\s\S]*?)<\/strong>/)?.[1]);
    const match = shown.match(/^([\d ,.]+)\s*(?:DH|MAD)(?:\s+TTC)?$/i);
    const minimum = Number(detail && attr(detail, 'data-minimum'));
    if (!detail || attr(detail, 'data-ref') !== product.sku || !Number.isSafeInteger(minimum) || minimum < 1) {
      throw new Error('Could not verify the source product reference for ' + product.id);
    }
    if (/^Prix sur devis$/i.test(shown) && attr(detail, 'data-tiers') === '[]') {
      publicPrices.set(product.id, { sku: product.sku, unitMinor: null, minimum });
      console.log('Confirmed no public price for', product.id);
    } else {
      const unitMinor = match && minorUnits(match[1]);
      const tier = JSON.parse(attr(detail, 'data-tiers')).find(t => t.min === minimum);
      if (!unitMinor || !tier || minorUnits(String(tier.dh)) !== unitMinor
        || !/prix de référence sans marquage/i.test(html)) throw new Error('Could not verify a unit price for ' + product.id);
      publicPrices.set(product.id, { sku: product.sku, unitMinor, minimum });
    }
  }
  const priceFile = new URL('idelo-prices.json', import.meta.url);
  const pricesBySku = Object.fromEntries(existingCatalog.map(p => {
    const price = publicPrices.get(p.id);
    return [p.sku, { unitMinor: price.unitMinor, minimum: price.minimum }];
  }));
  await writeFile(priceFile, JSON.stringify({
    source: origin + '/collections/', currency: 'MAD', basis: 'TTC sans marquage',
    checkedAt: new Date().toISOString(), pricesBySku,
  }, null, 2) + '\n');
  const priced = Object.values(pricesBySku).filter(price => price.unitMinor !== null).length;
  console.log('Checked all ' + existingCatalog.length + ' catalog references: ' + priced + ' TTC prices, '
    + (existingCatalog.length - priced) + ' quote-only.');
  process.exit(0);
}

const missing = [...expected].filter(([, value]) => !value).map(([slug]) => slug);
if (missing.length) {
  console.error('Missing products:', missing.join(', '));
  throw new Error(missing.length + ' sitemap products have no matching catalog card');
}
await writeFile(output, JSON.stringify({ source: origin, importedAt: new Date().toISOString(), products: [...expected.values()] }, null, 2) + '\n');
console.log('Matched every sitemap product:', expected.size);
