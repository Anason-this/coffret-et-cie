import { mkdir, writeFile, copyFile } from 'node:fs/promises';

const root = new URL('.', import.meta.url);
const output = new URL('dist/', root);
const origin = process.env.CATALOG_ORIGIN ?? 'https://coffret-et-cie-catalogue.sassy-leaf-4417.chatgpt.site';
const production = process.env.CATALOG_PUBLIC === '1';
if (production) throw new Error('Replace demonstration products and stock before enabling indexing.');

const families = {
  sacs: ['Sacs & cabas', 'Des sacs en toile à comparer pour vos salons, kits d’accueil et événements.'],
  boisson: ['Gourdes & mugs', 'Des formats nomades et des tasses à comparer selon les usages de votre équipe.'],
  bureau: ['Papeterie & écriture', 'Des carnets et instruments d’écriture pour les réunions, formations et kits d’accueil.'],
  coffrets: ['Coffrets cadeaux', 'Des idées de coffrets à adapter à votre occasion, à vos volumes et à votre budget.'],
};
const colors = { Naturel: '#cabb9d', Olive: '#2F3A2B', Terracotta: '#B5533C', Ivoire: '#eee4d2', Noir: '#242220' };
const products = [
  ['cabas-atlas', 'Cabas Atlas', 'CC-101', 'sacs', 'Coton', 'Naturel', 1240, 500, 'Cabas en toile de coton avec anses longues, adapté à la remise de documents lors d’un salon.'],
  ['gourde-cedre', 'Gourde Cèdre', 'CC-204', 'boisson', 'Inox', 'Olive', 860, null, 'Gourde de 500 ml en acier inoxydable avec bouchon vissé, pensée pour un kit d’accueil.'],
  ['carnet-argile', 'Carnet Argile', 'CC-312', 'bureau', 'Papier', 'Terracotta', 640, 300, 'Carnet A5 à couverture rigide et fermeture élastique, pour les réunions et ateliers.'],
  ['coffret-escale', 'Coffret Escale', 'CC-405', 'coffrets', 'Kraft', 'Naturel', 180, 120, 'Coffret en carton kraft avec un mug et un carnet, à envisager pour un cadeau de bienvenue.'],
  ['mug-dune', 'Mug Dune', 'CC-208', 'boisson', 'Céramique', 'Ivoire', 420, null, 'Mug en céramique à anse arrondie, adapté au bureau ou à un coffret d’équipe.'],
  ['stylo-ligne', 'Stylo Ligne', 'CC-316', 'bureau', 'Métal', 'Noir', 0, 600, 'Stylo à bille en métal à finition mate, à associer à un carnet pour un kit de formation.'],
].map(([id, name, sku, family, material, color, stock, incoming, description]) =>
  ({ id, name, sku, family, material, color, stock, incoming, description }));

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const number = value => value === null ? '—' : new Intl.NumberFormat('fr-MA').format(value);
const productPath = p => '/produits/' + p.id + '/';
const familyPath = id => '/collections/' + id + '/';
const links = Object.entries(families).map(([id, [name]]) => '<a href="' + familyPath(id) + '">' + name + '</a>').join('');
const picture = p => '<img class="product-photo" src="/img/' + p.id + '.jpg" width="512" height="512" alt="' + escape(p.name + ' · ' + p.color.toLowerCase()) + '">';
const stock = p => `<dl class="stock"><div><dt>Disponible</dt><dd>${number(p.stock)}</dd></div><div><dt>Arrivage annoncé</dt><dd>${number(p.incoming)}</dd></div></dl>`;
const card = p => `<article class="card" data-product data-search="${escape(p.name + ' ' + p.sku + ' ' + p.description)}" data-color="${p.color}" data-material="${p.material}" data-stock="${p.stock}">
  <a href="${productPath(p)}" class="photo-link">${picture(p)}<span class="photo-arrow" aria-hidden="true">↗</span></a>
  <div class="card-body"><p class="ref">${p.sku} <span>·</span> ${p.material}</p><h3><a href="${productPath(p)}">${p.name}</a></h3>
  <p class="swatch"><i style="--swatch:${colors[p.color]}"></i>${p.color}</p>${stock(p)}</div>
</article>`;

function layout({ title, description, path, body }) {
  return `<!doctype html><html lang="fr-MA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(title)} | Coffret &amp; Cie</title><meta name="description" content="${escape(description)}">
  <meta name="robots" content="noindex, follow">${origin ? '<link rel="canonical" href="' + escape(new URL(path, origin).href) + '">' : ''}
  <meta property="og:title" content="${escape(title)} | Coffret &amp; Cie"><meta property="og:description" content="${escape(description)}">
  <link rel="stylesheet" href="/style.css"><script src="/catalogue.js" defer></script></head>
  <body><a class="skip" href="#contenu">Aller au contenu</a>
  <header><div class="mast wrap"><a class="brand" href="/"><span class="mark" aria-hidden="true">✳</span><span>Coffret <i>&amp;</i> Cie<small>CADEAUX D’ENTREPRISE</small></span></a>
  <form class="search" action="/" role="search"><input name="q" type="search" aria-label="Rechercher dans le catalogue" placeholder="Rechercher un produit ou une référence"><button>Rechercher</button></form></div>
  <nav class="wrap nav" aria-label="Catégories"><a href="/">Catalogue</a>${links}</nav></header>
  <main id="contenu">${body}</main>
  <footer><div class="wrap footer"><a class="wordmark" href="/">Coffret &amp; Cie</a><p>Catalogue de démonstration · Maroc</p></div></footer></body></html>`;
}

function catalog(family) {
  const items = products.filter(p => !family || p.family === family);
  const title = family ? families[family][0] : 'Objets publicitaires au Maroc';
  const description = family ? families[family][1] : 'Explorez les coffrets cadeaux et objets publicitaires personnalisables de Coffret & Cie. Comparez les matières, les coloris et les références.';
  const filters = (field, label) => `<fieldset><legend>${label}</legend>${[...new Set(items.map(p => p[field]))].map(value => `<label><input type="checkbox" name="${field}" value="${value}">${field === 'color' ? '<i class="dot" style="--swatch:' + colors[value] + '"></i>' : ''}${value}</label>`).join('')}</fieldset>`;
  return layout({ title, description, path: family ? familyPath(family) : '/', body: `
    <section class="intro"><div class="wrap"><p class="eyebrow">CADEAUX D’ENTREPRISE · MAROC</p><h1>${title}</h1><p>${description}</p></div></section>
    <div class="wrap catalog"><aside aria-label="Filtres"><h2>Affiner</h2><nav class="family-links" aria-label="Familles de produits"><a href="/">Tous les produits</a>${links}</nav>
    <form id="filters">${filters('color', 'Couleur')}${filters('material', 'Matière')}<fieldset><legend>Disponibilité</legend><label><input type="checkbox" name="available"> En stock</label></fieldset><button type="reset" class="quiet">Réinitialiser</button></form></aside>
    <section class="results" aria-labelledby="result-title"><div class="toolbar"><div><h2 id="result-title">${family ? 'Les références' : 'Tous les produits'}</h2><p id="results-count" aria-live="polite">${items.length} références</p></div>
    <label for="sort">Trier par <select id="sort"><option value="default">Sélection</option><option value="stock">Stock décroissant</option><option value="name">Nom A–Z</option></select></label></div>
    <p class="demo">Catalogue de démonstration · modèles et quantités indicatifs.</p><div class="grid" id="grid">${items.map(card).join('')}</div>
    <p id="empty" hidden>Aucun produit ne correspond à ces critères.</p></section></div>` });
}

async function save(path, content) {
  const folder = new URL(path.replace(/^\//, ''), output);
  await mkdir(folder, { recursive: true });
  await writeFile(new URL('index.html', folder), content);
}

await mkdir(output, { recursive: true });
await save('/', catalog());
for (const family of Object.keys(families)) await save(familyPath(family), catalog(family));
for (const p of products) {
  await save(productPath(p), layout({ title: p.name + ' · ' + families[p.family][0], description: p.description, path: productPath(p), body: `
    <div class="wrap detail-wrap"><nav aria-label="Fil d’Ariane" class="crumb"><a href="/">Catalogue</a> / <a href="${familyPath(p.family)}">${families[p.family][0]}</a> / <span>${p.name}</span></nav>
    <article class="detail"><div>${picture(p)}</div><div class="detail-copy"><p class="eyebrow">${p.sku}</p><h1>${p.name}</h1><p>${p.description}</p>
    <dl class="specs"><div><dt>Matière</dt><dd>${p.material}</dd></div><div><dt>Coloris</dt><dd class="swatch"><i style="--swatch:${colors[p.color]}"></i>${p.color}</dd></div></dl>
    <h2>Disponibilité indicative</h2>${stock(p)}<p class="demo">Produit et chiffres de démonstration.</p>
    <a class="button" href="${familyPath(p.family)}">Voir la collection</a></div></article></div>` }));
}
for (const file of ['style.css', 'catalogue.js']) await copyFile(new URL(file, root), new URL(file, output));
await mkdir(new URL('img/', output), { recursive: true });
for (const p of products) await copyFile(new URL('img/' + p.id + '.jpg', root), new URL('img/' + p.id + '.jpg', output));
await writeFile(new URL('robots.txt', output), 'User-agent: *\nAllow: /\n');
console.log('Built ' + (products.length + Object.keys(families).length + 1) + ' demo pages.');
