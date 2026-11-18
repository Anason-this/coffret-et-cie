import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { card, colorName, escape, familyNames, familyPath, number, pageSize, picture, productPath, stock, swatches } from './cards.mjs';
import { markedUpPrices, maximumQuantity, minimumQuantity } from './quote-pricing.mjs';

const root = new URL('.', import.meta.url);
const output = new URL('dist/', root);
const origin = process.env.CATALOG_ORIGIN ?? 'https://coffret-et-cie-catalogue.sassy-leaf-4417.chatgpt.site';
const snapshot = JSON.parse(await readFile(new URL('idelo-products.json', root), 'utf8'));
const products = snapshot.products;
const quoteConfig = JSON.parse(await readFile(new URL('quote-config.json', root), 'utf8'));
if (quoteConfig.email && !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(quoteConfig.email)) throw new Error('Invalid quote email');
if (quoteConfig.whatsapp && !/^\+?[1-9]\d{7,14}$/.test(quoteConfig.whatsapp)) throw new Error('Invalid international WhatsApp number');
const quotePrices = markedUpPrices(quoteConfig.makitoPricesByCatalogSku, products);
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
  <link rel="stylesheet" href="/catalogue-full-v2.css"><link rel="stylesheet" href="/devis-v2.css"><script src="/devis-v2.js" defer></script>
  ${catalogScript ? '<script src="/catalogue-indexed.js" type="module"></script>' : ''}</head>
  <body><a class="skip" href="#contenu">Aller au contenu</a>
  <header><div class="mast wrap"><a class="brand" href="/"><span class="mark" aria-hidden="true">✳</span><span>Coffret <i>&amp;</i> Cie<small>CADEAUX D’ENTREPRISE</small></span></a>
  <form class="search" action="/" role="search"><input name="q" type="search" aria-label="Rechercher dans le catalogue" placeholder="Rechercher un produit ou une référence"><button>Rechercher</button></form><a class="quote-nav" href="/devis/">Mon devis <span data-quote-count hidden>0</span></a></div>
  <nav class="wrap nav" aria-label="Catégories"><a href="/">Catalogue</a>${links}</nav></header>
  <main id="contenu">${body}</main>
  ${path === '/devis/' ? '' : `<aside class="quote-tray" id="quote-tray" aria-label="Sélection pour le devis" hidden>
    <button class="tray-toggle" id="tray-toggle" type="button" aria-controls="tray-content" aria-expanded="false">
      <span>Mon devis <span class="tray-badge" id="tray-count"></span></span><span class="tray-chevron" aria-hidden="true">⌃</span>
    </button>
    <div id="tray-content" class="tray-content" hidden><ul id="tray-lines"></ul><div class="tray-footer"><strong id="tray-total"></strong><a class="button" href="/devis/">Voir mon devis →</a></div></div>
  </aside>`}
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
  const prices = quotePrices.get(p.sku) ?? null;
  const initialUnit = prices?.tiers.find(tier => tier.through === null || minimumQuantity <= tier.through)?.unitMinor;
  const initialLabel = initialUnit === undefined ? 'Prix sur devis' :
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: prices.currency }).format(initialUnit / 100) + ' / pièce';
  await save(productPath(p), layout({ title: p.name + ' · ' + p.type, description, path: productPath(p), body: `
    <div class="wrap detail-wrap"><nav aria-label="Fil d’Ariane" class="crumb"><a href="/">Catalogue</a> / <a href="${familyPath(p.family)}">${escape(familyNames[p.family])}</a> / <span>${escape(p.name)}</span></nav>
    <article class="detail"><div>${picture(p, false)}</div><div class="detail-copy"><p class="eyebrow">${escape(p.sku)}</p><h1>${escape(p.name)}</h1><p>${escape(description)}</p>
    <h2>Coloris</h2>${swatches(p, true)}<h2>Disponibilité indicative</h2>${stock(p)}<p class="demo">${stockNote}</p>
    <section class="quote-product" aria-labelledby="quote-product-title"><h2 id="quote-product-title">Votre quantité</h2>
      <p class="quote-price" id="quote-unit-price">${escape(initialLabel)}</p>
      <form id="quote-add" data-item="${escape(JSON.stringify({ id: p.id, sku: p.sku, name: p.name, prices }))}">
        <label for="quote-quantity">Pièces <small>(min. ${minimumQuantity})</small></label>
        <input id="quote-quantity" name="quantity" type="number" inputmode="numeric" required min="${minimumQuantity}" max="${maximumQuantity}" step="1" value="${minimumQuantity}">
        <button type="submit">Ajouter au devis</button>
      </form>
      <p id="quote-add-status" class="quote-status" role="status"></p><a id="open-quote" href="/devis/" hidden>Voir mon devis →</a>
    </section>
    <a class="collection-back" href="${familyPath(p.family)}">Voir la collection</a></div></article></div>` }));
}

await save('/devis/', layout({ title: 'Ma demande de devis', description: 'Préparez votre demande de devis Coffret & Cie et récapitulez les références et quantités de votre sélection.', path: '/devis/', body: `
  <section class="intro"><div class="wrap"><p class="eyebrow">COFFRET &amp; CIE</p><h1>Ma demande de devis</h1><p>Vérifiez les références et les quantités avant d’envoyer votre demande.</p></div></section>
  <div class="wrap quote-page" id="quote-page" data-email="${escape(quoteConfig.email)}" data-whatsapp="${escape(quoteConfig.whatsapp.replace(/^\+/, ''))}">
    <noscript><p>Activez JavaScript pour préparer votre sélection.</p></noscript>
    <p id="quote-empty" hidden>Votre sélection est vide. <a href="/">Parcourir le catalogue</a></p>
    <section id="quote-summary" hidden aria-labelledby="quote-summary-title">
      <h2 id="quote-summary-title">Votre sélection</h2><ul id="quote-lines" class="quote-lines"></ul>
      <p class="quote-total"><strong>Total des pièces</strong> <output id="quote-total"></output></p>
      <p class="quote-total"><strong>Estimation articles</strong> <output id="quote-money"></output></p>
      <form id="quote-create" class="quote-create">
        <h2>Destinataire <small>(facultatif)</small></h2>
        <div class="quote-fields">
          <label>Votre nom <input name="name" autocomplete="name" maxlength="100"></label>
          <label>Entreprise <input name="company" autocomplete="organization" maxlength="100"></label>
          <label>Ville <input name="city" autocomplete="address-level2" maxlength="100"></label>
        </div>
        <button type="submit">Créer mon devis</button>
      </form>
      <article class="quote-document" id="quote-document" aria-labelledby="quote-document-title" hidden>
        <img class="quote-logo" src="/img/novagift-logo.png" width="176" height="133" alt="Novagift">
        <div class="quote-document-party"><strong>Novagift SARL</strong><span>${escape(quoteConfig.email)}</span></div>
        <div class="quote-document-meta">
          <dl><div><dt>Date</dt><dd id="document-date"></dd></div><div><dt>Référence</dt><dd id="document-ref"></dd></div></dl>
          <div class="quote-document-party"><strong>Destinataire</strong><span id="document-recipient"></span></div>
        </div>
        <h2 id="quote-document-title">Demande de devis</h2>
        <table><thead><tr><th scope="col">Description</th><th scope="col">Quantité</th><th scope="col">Prix unitaire</th><th scope="col">Montant</th></tr></thead><tbody id="document-lines"></tbody></table>
        <dl class="quote-document-total"><div><dt>Total des pièces</dt><dd id="document-quantity"></dd></div><div><dt>Estimation articles</dt><dd id="document-money"></dd></div></dl>
        <p class="demo">Disponibilité, marquage, livraison et montant définitif à confirmer.</p>
      </article>
      <div id="quote-share" hidden>
      <div class="quote-actions">
        <button type="button" id="quote-print">Imprimer / PDF</button>
        <button type="button" class="quote-secondary" id="quote-copy">Copier le message</button>
        <a class="button quote-secondary" id="quote-email" hidden>Envoyer par e-mail</a>
        <a class="button quote-secondary" id="quote-whatsapp" target="_blank" rel="noopener noreferrer" hidden>Envoyer sur WhatsApp</a>
      </div>
      <p id="quote-contact-note" class="demo" hidden></p>
      <label for="quote-message" class="quote-message-label">Message prêt à envoyer</label>
      <textarea id="quote-message" rows="8" readonly></textarea>
      </div>
    </section>
    <p id="quote-status" class="quote-status" role="status"></p>
  </div>` }));

for (const sheet of ['catalogue-full-v2.css', 'catalogue-full.css']) {
  await copyFile(new URL('style.css', root), new URL(sheet, output));
}
await mkdir(new URL('img/', output), { recursive: true });
await copyFile(new URL('img/novagift-logo.png', root), new URL('img/novagift-logo.png', output));
await copyFile(new URL('devis.css', root), new URL('devis-v2.css', output));
const quoteScript = await readFile(new URL('devis.js', root), 'utf8');
await writeFile(new URL('devis-v2.js', output), quoteScript
  .replace('/* minimum */ 50', String(minimumQuantity))
  .replace('/* maximum */ 1000000', String(maximumQuantity)));
await copyFile(new URL('cards.mjs', root), new URL('cards-full.js', output));
const browserScript = await readFile(new URL('catalogue.js', root), 'utf8');
await writeFile(new URL('catalogue-indexed.js', output), browserScript
  .replace('./cards.mjs', './cards-full.js').replace('/* built catalog */ []', () => JSON.stringify(products)));
await writeFile(new URL('robots.txt', output), 'User-agent: *\nAllow: /\n');
console.log('Built ' + products.length + ' product pages across ' + (groups.length - 1) + ' families.');
