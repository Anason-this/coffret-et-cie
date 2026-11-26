import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('.', import.meta.url);
const output = new URL('dist/', root);

async function filesBelow(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else files.push(path);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const outputPath = fileURLToPath(output);
const files = await filesBelow(outputPath);
const htmlFiles = files.filter(file => file.endsWith('.html'));
assert(htmlFiles.length > 0, 'No HTML pages were generated');

const pages = [];
let productSchemaCount = 0;
let quoteOnlyProductCount = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const relativePath = relative(outputPath, file).split(sep).join('/');
  const path = relativePath === 'index.html' ? '/' : '/' + relativePath.replace(/index\.html$/, '');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  const robots = html.match(/<meta name="robots" content="([^"]+)">/)?.[1];
  assert(canonical, `Missing canonical URL in ${relativePath}`);
  assert(robots, `Missing robots meta tag in ${relativePath}`);

  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  if (path.startsWith('/produits/')) {
    assert(jsonLdBlocks.length === 1, `Expected one JSON-LD block in ${relativePath}`);
    const graph = jsonLdBlocks[0]['@graph'];
    assert(Array.isArray(graph), `Product page JSON-LD must use @graph in ${relativePath}`);
    assert(graph.some(item => item['@type'] === 'BreadcrumbList'),
      `Missing BreadcrumbList in ${relativePath}`);
    const product = graph.find(item => item['@type'] === 'Product');
    const visiblePrice = html.match(/id="quote-unit-price">([^<]+)</)?.[1];
    assert(visiblePrice, `Missing visible unit price in ${relativePath}`);
    if (visiblePrice === 'Prix sur devis') {
      quoteOnlyProductCount++;
      assert(!product, `Quote-only page must not publish incomplete Product schema in ${relativePath}`);
    } else {
      productSchemaCount++;
      assert(product, `Priced product is missing Product schema in ${relativePath}`);
      assert(product.url === canonical, `Product URL does not match canonical in ${relativePath}`);
      assert(product.offers?.['@type'] === 'Offer', `Product is missing Offer in ${relativePath}`);
      assert(product.offers.url === canonical, `Offer URL does not match canonical in ${relativePath}`);
      assert(product.offers.priceCurrency === 'MAD', `Offer currency must be MAD in ${relativePath}`);
      assert(/^\d+\.\d{2}$/.test(product.offers.price) && Number(product.offers.price) > 0,
        `Offer price is invalid in ${relativePath}`);
      const visibleMatch = visiblePrice.match(/^([\d.\s\u00a0\u202f]+),(\d{2})/);
      assert(visibleMatch, `Visible unit price format is invalid in ${relativePath}`);
      const visibleNumeric = Number(visibleMatch[1].replace(/\D/g, '') + '.' + visibleMatch[2]);
      assert(Number(product.offers.price) === visibleNumeric,
        `Offer price does not match the visible price in ${relativePath}`);
    }
  }
  pages.push({ path, canonical, robots });
}

const canonicalOrigins = new Set(pages.map(page => new URL(page.canonical).origin));
assert(canonicalOrigins.size === 1, 'Generated pages use more than one canonical origin');
const [origin] = canonicalOrigins;
assert(origin.startsWith('https://'), 'Canonical origin must use HTTPS');

const privatePages = pages.filter(page => page.robots.includes('noindex'));
assert(privatePages.length === 1 && privatePages[0].path === '/devis/',
  'Only /devis/ may be noindex');
const publicPages = pages.filter(page => !page.robots.includes('noindex'));
assert(publicPages.every(page => page.robots.includes('index, follow')),
  'Every public page must be indexable');

const sitemap = await readFile(new URL('sitemap.xml', output), 'utf8');
assert(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Invalid sitemap XML declaration');
assert(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'),
  'Invalid sitemap root element');
assert(sitemap.trimEnd().endsWith('</urlset>'), 'Sitemap is not closed');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]
  .replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'")
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
assert(sitemapUrls.length === publicPages.length,
  `Sitemap has ${sitemapUrls.length} URLs but ${publicPages.length} public pages exist`);
assert(new Set(sitemapUrls).size === sitemapUrls.length, 'Sitemap contains duplicate URLs');
assert(sitemapUrls.every(url => new URL(url).origin === origin), 'Sitemap contains a cross-origin URL');
const expectedUrls = new Set(publicPages.map(page => page.canonical));
assert(sitemapUrls.every(url => expectedUrls.has(url)), 'Sitemap contains an unexpected URL');
assert(publicPages.every(page => sitemapUrls.includes(page.canonical)), 'A public page is missing from the sitemap');

const robots = await readFile(new URL('robots.txt', output), 'utf8');
for (const token of ['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot',
  'Claude-User', 'ClaudeBot', 'PerplexityBot', 'Perplexity-User', 'Google-Agent', 'Google-Extended']) {
  assert(robots.includes(`User-agent: ${token}`), `robots.txt is missing ${token}`);
}
assert(robots.includes('Content-Signal: search=yes, ai-input=yes, ai-train=yes'),
  'robots.txt does not state the requested AI-use policy');
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt has the wrong sitemap URL');

const llms = await readFile(new URL('llms.txt', output), 'utf8');
assert(llms.includes(`${origin}/sitemap.xml`), 'llms.txt has the wrong sitemap URL');

console.log(`Validated ${htmlFiles.length} HTML pages, ${sitemapUrls.length} sitemap URLs, `
  + `${productSchemaCount} priced Product schemas, ${quoteOnlyProductCount} quote-only product pages, `
  + 'robots.txt, and llms.txt.');
