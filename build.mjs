import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { card, colorName, escape, familyNames, familyPath, number, pageSize, picture, productPath, stock, swatches } from './cards.mjs';

const root = new URL('.', import.meta.url);
const output = new URL('dist/', root);
const origin = process.env.CATALOG_ORIGIN ?? 'https://coffret-et-cie-catalogue.sassy-leaf-4417.chatgpt.site';
const snapshot = JSON.parse(await readFile(new URL('idelo-products.json', root), 'utf8'));
const products = snapshot.products;
if (!products.length || new Set(products.map(p => p.id)).size !== products.length) throw new Error('Invalid catalog snapshot');
for (const p of products) {
  if (!/^[a-z0-9-]+$/.test(p.id) || !Object.hasOwn(familyNames, p.family)
    || !p.name || !p.sku || !p.photo.startsWith('https://idelo.me/assets/')) throw new Error('Invalid product: ' + p.id);
}

const links = Object.entries(familyNames).map(([id, name]) => '<a href="' + familyPath(id) + '">' + escape(name) + '</a>').join('');
const date = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'long', timeZone: 'Africa/Casablanca' }).format(new Date(snapshot.importedAt));
const stockNote = 'Stock indicatif tiré du catalogue Idelo consulté le ' + date + '. Disponibilité à confirmer.';
const pagePath = (family, page) => (family ? familyPath(family) : '/') + (page === 1 ? '' : 'page/' + page + '/');

function layout({ title, description, path, body, catalogScript = false }) {
  return `<!doctype html><html lang="fr-MA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(title)} | Coffret &amp; Cie</title><meta name="description" content="${escape(description)}">
  <meta name="robots" content="noindex, follow"><link rel="canonical" href="${escape(new URL(path, origin).href)}">
  <meta property="og:title" content="${escape(title)} | Coffret &amp; Cie"><meta property="og:description" content="${escape(description)}">
  <link rel="stylesheet" href="/catalogue-full.css">${catalogScript ? '<script src="/catalogue-indexed.js" type="module"></script>' : ''}</head>
  <body><a class="skip" href="#contenu">Aller au contenu</a>
  <header><div class="mast wrap"><a class="brand" href="/"><span class="mark" aria-hidden="true">✳</span><span>Coffret <i>&amp;</i> Cie<small>CADEAUX D’ENTREPRISE</small></span></a>
  <form class="search" action="/" role="search"><input name="q" type="search" aria-label="Rechercher dans le catalogue" placeholder="Rechercher un produit ou une référence"><button>Rechercher</button></form></div>
  <nav class="wrap nav" aria-label="Catégories"><a href="/">Catalogue</a>${links}</nav></header>
  <main id="contenu">${body}</main>
  <footer><div class="wrap footer"><a class="wordmark" href="/">Coffret &amp; Cie</a><p>Catalogue · Maroc</p></div></footer></body></html>`;
}

function catalog(items, family, page) {
  const title = family ? familyNames[family] : 'Objets publicitaires au Maroc';
  const description = family ? 'Parcourez la collection ' + title.toLowerCase() + ' et comparez les modèles, références et coloris.'
    : 'Explorez les coffrets cadeaux et objets publicitaires personnalisables de Coffret & Cie. Comparez les modèles, les coloris et les références.';
  const total = Math.ceil(items.length / pageSize);
  const colorKeys = [...new Set(items.flatMap(p => p.colors))].sort((a, b) => colorName(a).localeCompare(colorName(b), 'fr'));
  const typeKeys = [...new Set(items.map(p => p.type))].sort((a, b) => a.localeCompare(b, 'fr'));
  const options = (values, label = value => value) => values.map(value => '<option value="' + escape(value) + '">' + escape(label(value)) + '</option>').join('');
  return layout({ title: title + (page > 1 ? ' · Page ' + page : ''), description, path: pagePath(family, page), catalogScript: true, body: `
    <section class="intro"><div class="wrap"><p class="eyebrow">CADEAUX D’ENTREPRISE · MAROC</p><h1>${escape(title)}</h1><p>${escape(description)}</p></div></section>
    <div class="wrap catalog"><aside aria-label="Filtres"><h2>Affiner</h2><nav class="family-links" aria-label="Familles de produits"><a href="/">Tous les produits</a>${links}</nav>
    <form id="filters"><fieldset><legend>Couleur</legend><select name="color" aria-label="Filtrer par couleur"><option value="">Toutes</option>${options(colorKeys, colorName)}</select></fieldset>
    <fieldset><legend>Type de produit</legend><select name="type" aria-label="Filtrer par type"><option value="">Tous</option>${options(typeKeys)}</select></fieldset>
    <fieldset><legend>Disponibilité</legend><label><input type="checkbox" name="available"> Stock positif</label></fieldset><button type="reset" class="quiet">Réinitialiser</button></form></aside>
    <section class="results" aria-labelledby="result-title" data-catalog="${family ?? ''}"><div class="toolbar"><div><h2 id="result-title" tabindex="-1">${family ? 'Les références' : 'Tous les produits'}</h2><p id="results-count" aria-live="polite">${number(items.length)} références</p></div>
    <label for="sort">Trier par <select id="sort"><option value="default">Sélection</option><option value="stock">Stock décroissant</option><option value="name">Nom A–Z</option></select></label></div>
    <p class="demo">${stockNote}</p><div class="grid" id="grid">${items.slice((page - 1) * pageSize, page * pageSize).map(card).join('')}</div>
    <p id="empty" hidden>Aucun produit ne correspond à ces critères.</p><p id="load-error" role="status" hidden>La recherche est momentanément indisponible. Réessayez dans un instant.</p>
    <nav class="pagination" aria-label="Pages du catalogue" id="pagination">${page > 1 ? `<a href="${pagePath(family, page - 1)}">← Précédente</a>` : ''}<span>Page ${page} sur ${total}</span>${page < total ? `<a href="${pagePath(family, page + 1)}">Suivante →</a>` : ''}</nav>
    </section></div>` });
}

async function save(path, content) {
  const folder = new URL(path.replace(/^\//, ''), output);
  await mkdir(folder, { recursive: true });
  await writeFile(new URL('index.html', folder), content);
}

await mkdir(output, { recursive: true });
const groups = [null, ...Object.keys(familyNames)];
for (const family of groups) {
  const items = family ? products.filter(p => p.family === family) : products;
  const total = Math.ceil(items.length / pageSize);
  for (let page = 1; page <= total; page++) await save(pagePath(family, page), catalog(items, family, page));
}

for (const p of products) {
  const description = p.specification || p.type;
  await save(productPath(p), layout({ title: p.name + ' · ' + p.type, description, path: productPath(p), body: `
    <div class="wrap detail-wrap"><nav aria-label="Fil d’Ariane" class="crumb"><a href="/">Catalogue</a> / <a href="${familyPath(p.family)}">${escape(familyNames[p.family])}</a> / <span>${escape(p.name)}</span></nav>
    <article class="detail"><div>${picture(p, false)}</div><div class="detail-copy"><p class="eyebrow">${escape(p.sku)}</p><h1>${escape(p.name)}</h1><p>${escape(description)}</p>
    <h2>Coloris</h2>${swatches(p, true)}<h2>Disponibilité indicative</h2>${stock(p)}<p class="demo">${stockNote}</p>
    <a class="button" href="${familyPath(p.family)}">Voir la collection</a></div></article></div>` }));
}

await copyFile(new URL('style.css', root), new URL('catalogue-full.css', output));
await copyFile(new URL('cards.mjs', root), new URL('cards-full.js', output));
const browserScript = await readFile(new URL('catalogue.js', root), 'utf8');
await writeFile(new URL('catalogue-indexed.js', output), browserScript
  .replace('./cards.mjs', './cards-full.js').replace('/* built catalog */ []', () => JSON.stringify(products)));
await writeFile(new URL('robots.txt', output), 'User-agent: *\nAllow: /\n');
console.log('Built ' + products.length + ' product pages across ' + (groups.length - 1) + ' families.');
