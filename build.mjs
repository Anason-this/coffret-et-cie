import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { card, colorName, escape, familyNames, familyPath, number, pageSize, picture, productHeading, productLabel, productPath, stock, swatches, unitPriceLabel } from './cards.mjs';
import { markedUpIdeloPrices, maximumQuantity, minimumQuantity } from './quote-pricing.mjs';
import { catalogSearchTerms, catalogTypeName, describeProduct } from './product-seo.mjs';

const root = new URL('.', import.meta.url);
const output = new URL('dist/', root);
const configuredOrigin = process.env.CATALOG_ORIGIN ?? 'https://coffret-et-cie-catalogue.sassy-leaf-4417.chatgpt.site';
const originUrl = new URL(configuredOrigin);
if (originUrl.protocol !== 'https:' || originUrl.username || originUrl.password
  || originUrl.search || originUrl.hash || originUrl.pathname !== '/') {
  throw new Error('CATALOG_ORIGIN must be an HTTPS origin without a path, query, credentials, or fragment');
}
const origin = originUrl.origin;
const snapshot = JSON.parse(await readFile(new URL('idelo-products.json', root), 'utf8'));
const products = snapshot.products;
const quoteConfig = JSON.parse(await readFile(new URL('quote-config.json', root), 'utf8'));
if (quoteConfig.email && !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(quoteConfig.email)) throw new Error('Invalid quote email');
if (quoteConfig.whatsapp && !/^\+?[1-9]\d{7,14}$/.test(quoteConfig.whatsapp)) throw new Error('Invalid international WhatsApp number');
if (!products.length || new Set(products.map(p => p.id)).size !== products.length
  || new Set(products.map(p => p.sku)).size !== products.length) throw new Error('Invalid catalog snapshot');
for (const p of products) {
  if (!/^[a-z0-9-]+$/.test(p.id) || !Object.hasOwn(familyNames, p.family)
    || !p.name || !p.sku || !p.photo.startsWith('https://idelo.me/assets/')) throw new Error('Invalid product: ' + p.id);
}
const priceSnapshot = JSON.parse(await readFile(new URL('idelo-prices.json', root), 'utf8'));
const quotePrices = markedUpIdeloPrices(priceSnapshot, products);
const seoById = new Map();
for (const product of products) {
  const seo = describeProduct(product);
  seoById.set(product.id, seo);
  product.catalogHeading = seo.catalogHeading;
  product.searchTerms = catalogSearchTerms(product.type);
  product.unitPriceMinor = quotePrices.get(product.sku);
}
const quoteIndexJson = JSON.stringify(Object.fromEntries(products.map(p => [
  p.id, { name: productLabel(p), unitPriceMinor: p.unitPriceMinor },
]))).replace(/</g, '\\u003c');

const featuredCollections = {
  ecriture: {
    title: 'Stylos publicitaires et articles d’écriture',
    menu: 'Stylos publicitaires',
    description: 'Comparez les stylos à bille, rollers et crayons à personnaliser avec votre logo. Consultez les coloris, les prix et le stock indicatif avant de demander un devis.'
  },
  hydratation: {
    title: 'Gourdes et mugs personnalisables',
    menu: 'Gourdes personnalisables',
    description: 'Choisissez des gourdes, mugs ou gobelets pour vos équipes et vos événements. Comparez les modèles selon la capacité, la matière et les coloris indiqués sur chaque fiche.'
  },
  sacs: {
    title: 'Sacs et tote bags personnalisables',
    menu: 'Sacs personnalisables',
    description: 'Retrouvez des tote bags, des sacs à dos et des porte-documents à personnaliser. Filtrez par type ou par couleur pour préparer un devis pour votre salon, votre équipe ou votre événement.'
  },
  'carnets-et-coffrets': {
    title: 'Coffrets cadeaux d’entreprise et carnets',
    menu: 'Coffrets & carnets',
    description: 'Comparez les coffrets d’écriture, les carnets avec stylo et les blocs-notes pour vos cadeaux d’entreprise. Ouvrez une fiche pour consulter la composition et les coloris indiqués.'
  },
};
const familyOrder = [...new Set([...Object.keys(featuredCollections), ...Object.keys(familyNames)])];
const headerFamilies = familyOrder.filter(id => id !== 'maison-loisirs-accessoires');
const collectionLinks = (families, currentPath) => families.map(id => {
  const href = familyPath(id);
  return `<a href="${href}"${currentPath === href ? ' aria-current="page"' : ''}>${escape(featuredCollections[id]?.menu ?? familyNames[id])}</a>`;
}).join('');
const date = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'long', timeZone: 'Africa/Casablanca' }).format(new Date(snapshot.importedAt));
const stockNote = 'Stock indicatif tiré du catalogue Idelo consulté le ' + date + '. Disponibilité à confirmer.';
const pagePath = (family, page) => (family ? familyPath(family) : '/') + (page === 1 ? '' : 'page/' + page + '/');
const phone = quoteConfig.whatsapp ? '+' + quoteConfig.whatsapp.replace(/^\+/, '') : '';
const phoneLabel = phone.replace(/^(\+212)(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
const emailHref = 'mailto:' + quoteConfig.email;
const whatsappHref = 'https://wa.me/' + phone.slice(1);
const pdfFileName = 'Goodisly-Novagift-2027-Catalogue-General.pdf';
const pdfHref = '/catalogues/' + pdfFileName;

const icons = {
  phone: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-1.8 2a14 14 0 0 1-7.2-7.2L9 8l-2-5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  quote: '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9Zm0 0v7h7M8 13h8m-8 4h6"/>',
};
const icon = name => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + icons[name] + '</svg>';
const headerContacts = [
  phone ? `<a href="tel:${escape(phone)}">${icon('phone')}<span>${escape(phoneLabel)}</span></a>` : '',
  quoteConfig.email ? `<a href="${escape(emailHref)}">${icon('mail')}<span>${escape(quoteConfig.email)}</span></a>` : '',
].join('');
const floatingContacts = [
  phone ? `<a class="contact-shortcut contact-whatsapp" href="${escape(whatsappHref)}" target="_blank" rel="noopener noreferrer" aria-label="Nous contacter sur WhatsApp" title="WhatsApp"><img src="/img/whatsapp-official.svg" width="27" height="27" alt=""></a>` : '',
  quoteConfig.email ? `<a class="contact-shortcut contact-mail" href="${escape(emailHref)}" aria-label="Nous écrire par e-mail" title="E-mail">${icon('mail')}</a>` : '',
].join('');
const footerContacts = [
  phone ? `<a href="tel:${escape(phone)}">${escape(phoneLabel)}</a>` : '',
  quoteConfig.email ? `<a href="${escape(emailHref)}">${escape(quoteConfig.email)}</a>` : '',
  phone ? `<a href="${escape(whatsappHref)}" target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp ↗</a>` : '',
].join('');
const siteFooter = `<footer class="site-footer"><div class="wrap footer">
    <div class="footer-brand"><a class="wordmark" href="/">Coffret &amp; Cie</a><p>Cadeaux d’entreprise et objets publicitaires au Maroc.</p></div>
    <nav class="footer-links" aria-labelledby="footer-help"><h2 id="footer-help">Aide et support</h2>
      <a href="/aide/">Questions fréquentes</a><a href="/devis/">Mon devis</a><a href="/catalogue-pdf/">Catalogue PDF</a>
    </nav>
    ${footerContacts ? `<section class="footer-links" id="contact" aria-labelledby="footer-contact"><h2 id="footer-contact">Nous contacter</h2>${footerContacts}</section>` : ''}
  </div></footer>`;

function layout({ title, description, path, body, catalogScript = false, structuredData, indexable = true }) {
  return `<!doctype html><html lang="fr-MA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(title)} | Coffret &amp; Cie</title><meta name="description" content="${escape(description)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
  <meta name="robots" content="${indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'}"><link rel="canonical" href="${escape(new URL(path, origin).href)}">
  <meta property="og:title" content="${escape(title)} | Coffret &amp; Cie"><meta property="og:description" content="${escape(description)}">
  <link rel="stylesheet" href="/catalogue-full-v3.css?v=${path === '/' ? 'compact-intro' : 'footer'}"><link rel="stylesheet" href="/devis-v2.css"><link rel="stylesheet" href="/header-contact-v2.css"><script src="/devis-prices.js?v=product-names" defer></script>
  ${catalogScript ? '<script src="/catalogue-browse.js?v=product-names" type="module"></script>' : ''}
  ${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>` : ''}</head>
  <body><a class="skip" href="#contenu">Aller au contenu</a>
  <header><div class="mast wrap"><a class="brand" href="/"><img class="mark" src="/favicon.svg" width="44" height="44" alt=""><span>Coffret <i>&amp;</i> Cie<small>CADEAUX D’ENTREPRISE</small></span></a>
  <form class="search" action="/" role="search"><input name="q" type="search" aria-label="Rechercher dans le catalogue" placeholder="Rechercher un produit"><button>Rechercher</button></form>
  <div class="mast-actions">
    ${headerContacts ? `<div class="header-contacts" aria-label="Coordonnées">${headerContacts}</div>` : ''}
    <a class="quote-nav" href="/devis/"${path === '/devis/' ? ' aria-current="page"' : ''}>${icon('quote')} Mon devis <span data-quote-count hidden>0</span></a>
  </div></div>
  <nav class="wrap nav" aria-label="Catégories et catalogue"><a href="/"${path === '/' ? ' aria-current="page"' : ''}>Catalogue</a>${collectionLinks(headerFamilies, path)}
    <a class="nav-pdf" href="/catalogue-pdf/"${path === '/catalogue-pdf/' ? ' aria-current="page"' : ''}>${icon('quote')} Catalogue PDF</a>
  </nav></header>
  <main id="contenu">${body}</main>
  <div class="contact-dock">
  ${path === '/devis/' ? '' : `<aside class="quote-tray" id="quote-tray" aria-label="Sélection pour le devis" hidden>
    <button class="tray-toggle" id="tray-toggle" type="button" aria-controls="tray-content" aria-expanded="false">
      <span>Mon devis <span class="tray-badge" id="tray-count"></span></span><span class="tray-chevron" aria-hidden="true">⌃</span>
    </button>
    <div id="tray-content" class="tray-content" hidden><ul id="tray-lines"></ul><div class="tray-footer"><strong id="tray-total"></strong><a class="button" href="/devis/">Voir mon devis →</a></div></div>
  </aside>`}
  ${floatingContacts ? `<nav class="floating-contacts" aria-label="Contact rapide">${floatingContacts}</nav>` : ''}
  </div>
  ${siteFooter}</body></html>`;
}

function catalogFilters(items) {
  const variantKeys = [...new Set(items.flatMap(p => p.colors))].sort((a, b) => colorName(a).localeCompare(colorName(b), 'fr'));
  const variantLabel = value => colorName(value).replace(/^./u, char => char.toLocaleUpperCase('fr'));
  const byType = Map.groupBy(items, p => p.type);
  const compareTypes = (a, b) => catalogTypeName(a).localeCompare(catalogTypeName(b), 'fr');
  const types = [...byType.keys()].sort(compareTypes);
  const popular = [...types].sort((a, b) => byType.get(b).length - byType.get(a).length || compareTypes(a, b)).slice(0, 5);
  const remaining = types.filter(type => !popular.includes(type));
  const options = (values, label = value => value) => values.map(value =>
    `<option value="${escape(value)}">${escape(label(value))}</option>`).join('');
  return {
    types: remaining.length ? `<optgroup label="Les plus courants">${options(popular, catalogTypeName)}</optgroup><optgroup label="Autres types">${options(remaining, catalogTypeName)}</optgroup>` : options(types, catalogTypeName),
    variants: options(variantKeys, variantLabel),
    shortcuts: types.length > 1 ? `<div class="type-shortcuts" aria-label="Types de produits courants" role="group" data-type-shortcuts hidden>
      ${popular.map(type => `<button type="button" data-type="${escape(type)}" aria-pressed="false">${escape(catalogTypeName(type))} <span>${number(byType.get(type).length)}</span></button>`).join('')}
    </div>` : '',
  };
}

function catalog(items, family, page, filters) {
  const path = pagePath(family, page);
  const isHome = path === '/';
  const title = family ? featuredCollections[family]?.title ?? familyNames[family] : 'Objets publicitaires au Maroc';
  const description = family ? featuredCollections[family]?.description
      ?? 'Parcourez la collection ' + title.toLowerCase() + ' et comparez les modèles et coloris.'
    : 'Explorez les coffrets cadeaux et objets publicitaires personnalisables de Coffret & Cie. Comparez les modèles et les coloris.';
  const total = Math.ceil(items.length / pageSize);
  const pageLinks = (page === 1 && total > 2) ? Array.from({ length: total - 1 }, (_, i) => {
    const target = i + 2;
    return `<a href="${pagePath(family, target)}" aria-label="Page ${target}">${target}</a>`;
  }).join('') : '';
  return layout({ title: title + (page > 1 ? ' · Page ' + page : ''), description, path, catalogScript: true, body: `
    <section class="intro${isHome ? ' intro--home' : ''}"><div class="wrap"><p class="eyebrow">CADEAUX D’ENTREPRISE · MAROC</p><h1>${escape(title)}</h1><p>${escape(description)}</p>
      ${isHome ? `<div class="intro-actions"><nav class="featured-collections" aria-label="Collections principales">${collectionLinks(Object.keys(featuredCollections))}</nav><a class="button catalogue-callout" href="/catalogue-pdf/">${icon('quote')} Voir le catalogue PDF</a></div>` : ''}
    </div></section>
    <div class="wrap catalog"><aside aria-label="Filtres"><h2>Affiner</h2><nav class="family-links" aria-label="Familles de produits"><a href="/">Tous les produits</a>${collectionLinks(familyOrder, path)}</nav>
    <form id="filters">
    <div class="filter-field"><label for="filter-type">Type de produit</label><select id="filter-type" name="type"><option value="">Tous les types</option>${filters.types}</select></div>
    <div class="filter-field"><label for="filter-variant">Coloris ou motif</label><select id="filter-variant" name="color"><option value="">Toutes les variantes</option>${filters.variants}</select></div>
    <fieldset><legend>Disponibilité</legend><label><input type="checkbox" name="available"> Stock total positif</label></fieldset><button type="reset" class="quiet">Réinitialiser</button></form></aside>
    <section class="results" aria-labelledby="result-title" data-catalog="${family ?? ''}"><div class="toolbar"><div><h2 id="result-title" tabindex="-1">${family ? 'Les produits' : 'Tous les produits'}</h2><p id="results-count" aria-live="polite">${number(items.length)} produits</p></div>
    <label for="sort">Trier par <select id="sort"><option value="default">Sélection</option><option value="stock">Stock décroissant</option><option value="name">Nom A–Z</option></select></label></div>
    ${filters.shortcuts}
    <p class="demo">Prix unitaires TTC, hors marquage et livraison. Minimum ${minimumQuantity} pièces par produit. ${stockNote}</p><div class="grid" id="grid">${items.slice((page - 1) * pageSize, page * pageSize).map(card).join('')}</div>
    <p id="empty" hidden>Aucun produit ne correspond à ces critères.</p><p id="load-error" role="status" hidden>La recherche est momentanément indisponible. Réessayez dans un instant.</p>
    <nav class="pagination" aria-label="Pages du catalogue" id="pagination">${page > 1 ? `<a href="${pagePath(family, page - 1)}">← Précédente</a>` : ''}<span>Page ${page} sur ${total}</span>${page < total ? `<a href="${pagePath(family, page + 1)}">Suivante →</a>` : ''}</nav>
    ${pageLinks ? `<details class="page-jump"><summary>Aller à une page du catalogue</summary><nav aria-label="Accès direct aux pages">${pageLinks}</nav></details>` : ''}
    </section></div>` });
}

const indexablePaths = new Set();
async function save(path, content, { indexable = true } = {}) {
  const folder = new URL(path.replace(/^\//, ''), output);
  await mkdir(folder, { recursive: true });
  await writeFile(new URL('index.html', folder), content);
  if (indexable) indexablePaths.add(path);
}

await mkdir(output, { recursive: true });
await copyFile(new URL('img/favicon.svg', root), new URL('favicon.svg', output));
const groups = [null, ...Object.keys(familyNames)];
for (const family of groups) {
  const items = family ? products.filter(p => p.family === family) : products;
  const total = Math.ceil(items.length / pageSize);
  const filters = catalogFilters(items);
  for (let page = 1; page <= total; page++) await save(pagePath(family, page), catalog(items, family, page, filters));
}

for (const p of products) {
  const seo = seoById.get(p.id);
  const initialLabel = unitPriceLabel(p.unitPriceMinor);
  const path = productPath(p);
  const label = productLabel(p);
  const breadcrumbs = [['Catalogue', '/'], [featuredCollections[p.family]?.menu ?? familyNames[p.family], familyPath(p.family)], [label, path]];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: breadcrumbs.map(([name, url], index) => ({
        '@type': 'ListItem', position: index + 1, name, item: new URL(url, origin).href
      })) },
      { '@type': 'Product', name: label, image: p.photo, description: seo.copy[0],
        category: catalogTypeName(p.type), url: new URL(path, origin).href },
    ],
  };
  await save(path, layout({ title: label, description: seo.meta, path, structuredData, body: `
    <div class="wrap detail-wrap"><nav aria-label="Fil d’Ariane" class="crumb"><a href="/">Catalogue</a> / <a href="${familyPath(p.family)}">${escape(breadcrumbs[1][0])}</a> / <span aria-current="page">${escape(label)}</span></nav>
    <article class="detail"><div>${picture(p, false)}</div><div class="detail-copy"><h1 class="product-heading">${productHeading(p)}</h1>
    <div class="product-price"><p class="quote-price" id="quote-unit-price">${escape(initialLabel)}</p>
      <p>${p.unitPriceMinor === null ? 'Demandez un devis dès ' + minimumQuantity + ' pièces.' : 'Dès ' + minimumQuantity + ' pièces · hors marquage et livraison'}</p>
    </div>
    <section class="product-description" aria-labelledby="product-description-title">
      <h2 id="product-description-title">${escape(seo.label.replace(/^./u, char => char.toLocaleUpperCase('fr')))} avec logo</h2>
      ${seo.copy.map(paragraph => '<p>' + escape(paragraph) + '</p>').join('')}
      ${seo.facts.length ? '<ul aria-label="Caractéristiques du catalogue">' + seo.facts.map(fact => '<li>' + escape(fact) + '</li>').join('') + '</ul>' : ''}
    </section>
    <h2>Variantes</h2>${swatches(p, true)}<h2>Disponibilité</h2>${stock(p, true)}<p class="demo">${stockNote}</p>
    <section class="quote-product" aria-labelledby="quote-product-title"><h2 id="quote-product-title">Votre quantité</h2>
      <form id="quote-add" data-item="${escape(JSON.stringify({ id: p.id, name: label }))}">
        <label for="quote-quantity">Pièces <small>(min. ${minimumQuantity})</small></label>
        <input id="quote-quantity" name="quantity" type="number" inputmode="numeric" required min="${minimumQuantity}" max="${maximumQuantity}" step="1" value="${minimumQuantity}">
        <button type="submit">Ajouter au devis</button>
      </form>
      <p id="quote-add-status" class="quote-status" role="status"></p><a id="open-quote" href="/devis/" hidden>Voir mon devis →</a>
    </section>
    <a class="collection-back" href="${familyPath(p.family)}">Voir la collection</a></div></article></div>` }));
}

await save('/aide/', layout({
  title: 'Aide et support',
  description: 'Retrouvez les réponses aux questions sur le devis, la personnalisation, les prix et le stock chez Coffret & Cie.',
  path: '/aide/',
  body: `<section class="wrap help-page"><h1>Aide et support</h1>
    <details><summary>Comment demander un devis ?</summary>
      <p>Ouvrez une fiche produit, choisissez la quantité, puis ajoutez l’article à votre sélection. Dans <a href="/devis/">Mon devis</a>, vous pouvez revoir les articles et les quantités avant de préparer votre demande par e-mail ou WhatsApp.</p>
    </details>
    <details><summary>Quelle est la quantité minimale ?</summary>
      <p>Le minimum est de ${minimumQuantity} pièces par produit.</p>
    </details>
    <details><summary>Que comprend le prix affiché ?</summary>
      <p>Le prix unitaire affiché est TTC, hors marquage et livraison. Les articles dont le prix figure sur devis sont chiffrés à la demande.</p>
    </details>
    <details><summary>Puis-je personnaliser un article avec mon logo ?</summary>
      <p>Indiquez le produit, le coloris, la quantité et le marquage souhaités. Vous pouvez nous transmettre votre logo avec votre demande pour confirmer les options de personnalisation.</p>
    </details>
    <details><summary>Le stock affiché correspond-il à mon coloris ?</summary>
      <p>Le stock affiché est indicatif et regroupe l’ensemble des variantes d’un produit. La disponibilité du coloris et de la quantité souhaités est à confirmer lors du devis.</p>
    </details>
    ${footerContacts ? '<p><a class="button" href="#contact">Nous contacter</a></p>' : ''}
  </section>`
}));

await save('/catalogue-pdf/', layout({
  title: 'Catalogue Novagift 2027', description: 'Consultez ou téléchargez le catalogue général Novagift 2027 au format PDF.', path: '/catalogue-pdf/',
  body: `<section class="wrap pdf-catalogue" aria-labelledby="pdf-catalogue-title">
    <img class="pdf-catalogue-cover" src="/img/catalogue-novagift-2027-cover.jpg" width="538" height="760" alt="Couverture du catalogue Novagift 2027">
    <div><p class="eyebrow">NOVAGIFT · COLLECTION 2027</p><h1 id="pdf-catalogue-title">Catalogue général 2027</h1>
      <p>Feuilletez le catalogue Novagift ou gardez une copie pour préparer votre sélection.</p>
      <p class="pdf-details">PDF · 152 pages · 19 Mo</p>
      <div class="pdf-actions">
        <a class="button" href="${pdfHref}" target="_blank" rel="noopener noreferrer">Voir le catalogue PDF</a>
        <a class="pdf-download" href="${pdfHref}" download>Télécharger le PDF</a>
      </div>
    </div>
  </section>`,
}));

await save('/devis/', layout({ title: 'Ma demande de devis', description: 'Préparez votre demande de devis Coffret & Cie et récapitulez les produits et quantités de votre sélection.', path: '/devis/', indexable: false, body: `
  <section class="intro"><div class="wrap"><p class="eyebrow">COFFRET &amp; CIE</p><h1>Ma demande de devis</h1><p>Vérifiez les produits et les quantités avant d’envoyer votre demande.</p></div></section>
  <div class="wrap quote-page" id="quote-page" data-email="${escape(quoteConfig.email)}" data-whatsapp="${escape(quoteConfig.whatsapp.replace(/^\+/, ''))}">
    <script id="quote-product-index" type="application/json">${quoteIndexJson}</script>
    <noscript><p>Activez JavaScript pour préparer votre sélection.</p></noscript>
    <p id="quote-empty" hidden>Votre sélection est vide. <a href="/">Parcourir le catalogue</a></p>
    <section id="quote-summary" hidden aria-labelledby="quote-summary-title">
      <h2 id="quote-summary-title">Votre sélection</h2><ul id="quote-lines" class="quote-lines"></ul>
      <p class="quote-total"><strong>Total des pièces</strong> <output id="quote-total"></output></p>
      <p class="quote-total"><strong>Estimation articles TTC</strong> <output id="quote-money"></output></p>
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
          <dl><div><dt>Date</dt><dd id="document-date"></dd></div><div><dt>N° de devis</dt><dd id="document-ref"></dd></div></dl>
          <div class="quote-document-party"><strong>Destinataire</strong><span id="document-recipient"></span></div>
        </div>
        <h2 id="quote-document-title">Demande de devis</h2>
        <table><thead><tr><th scope="col">Description</th><th scope="col">Quantité</th><th scope="col">Prix unitaire TTC</th><th scope="col">Montant TTC</th></tr></thead><tbody id="document-lines"></tbody></table>
        <dl class="quote-document-total"><div><dt>Total des pièces</dt><dd id="document-quantity"></dd></div><div><dt>Estimation articles TTC</dt><dd id="document-money"></dd></div></dl>
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
  </div>` }), { indexable: false });

for (const sheet of ['catalogue-full-v3.css', 'catalogue-full-v2.css', 'catalogue-full.css']) {
  await copyFile(new URL('style.css', root), new URL(sheet, output));
}
await mkdir(new URL('img/', output), { recursive: true });
for (const filename of ['novagift-logo.png', 'catalogue-novagift-2027-cover.jpg', 'whatsapp-official.svg']) {
  await copyFile(new URL('img/' + filename, root), new URL('img/' + filename, output));
}
await mkdir(new URL('catalogues/', output), { recursive: true });
await copyFile(new URL('catalogues/' + pdfFileName, root), new URL(pdfHref.slice(1), output));
await copyFile(new URL('devis.css', root), new URL('devis-v2.css', output));
await copyFile(new URL('header-contact.css', root), new URL('header-contact-v2.css', output));
const quoteScript = await readFile(new URL('devis.js', root), 'utf8');
await writeFile(new URL('devis-prices.js', output), quoteScript
  .replace('/* minimum */ 50', String(minimumQuantity))
  .replace('/* maximum */ 1000000', String(maximumQuantity)));
for (const file of ['cards-browse.js', 'cards-priced.js']) {
  await copyFile(new URL('cards.mjs', root), new URL(file, output));
}
const browserScript = await readFile(new URL('catalogue.js', root), 'utf8');
const browsableProducts = products.map(({ sku, ...product }) => product);
const browserCatalog = browserScript.replace('./cards.mjs', './cards-browse.js?v=product-names')
  .replace('/* built catalog */ []', () => JSON.stringify(browsableProducts));
for (const file of ['catalogue-browse.js', 'catalogue-priced.js']) {
  await writeFile(new URL(file, output), browserCatalog);
}
const xmlEscape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const sitemapUrls = [...indexablePaths]
  .map(path => new URL(path, origin).href)
  .sort((a, b) => a.localeCompare(b, 'en'));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(url => `  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n')}
</urlset>
`;
await writeFile(new URL('sitemap.xml', output), sitemap);

const contentSignal = 'Content-Signal: search=yes, ai-input=yes, ai-train=yes';
const robots = `User-agent: *
${contentSignal}
Allow: /

User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Agent
${contentSignal}
Allow: /

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
${contentSignal}
Allow: /

Sitemap: ${new URL('/sitemap.xml', origin).href}
`;
await writeFile(new URL('robots.txt', output), robots);

const llms = `# Coffret & Cie

> Catalogue marocain de cadeaux d'entreprise et d'objets publicitaires personnalisables.

## Pages principales

- [Catalogue](${new URL('/', origin).href}): parcourir tous les produits
- [Aide](${new URL('/aide/', origin).href}): devis, quantités, personnalisation, prix et stock
- [Catalogue PDF](${new URL('/catalogue-pdf/', origin).href}): consulter le catalogue général
- [Plan du site](${new URL('/sitemap.xml', origin).href}): liste des pages publiques indexables
`;
await writeFile(new URL('llms.txt', output), llms);

console.log('Built ' + products.length + ' product pages across ' + (groups.length - 1)
  + ' families with ' + sitemapUrls.length + ' indexable URLs.');
