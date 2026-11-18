export const familyNames = {
  hydratation: 'Gourdes & mugs',
  'carnets-et-coffrets': 'Carnets & coffrets',
  ecriture: 'Écriture',
  'high-tech': 'High-tech',
  sacs: 'Sacs & cabas',
  'porte-cles': 'Porte-clés',
  trophees: 'Trophées',
  'maison-loisirs-accessoires': 'Maison & loisirs',
};

const colorMap = {
  blanc: ['Blanc', '#fff'], noir: ['Noir', '#242220'], bleu: ['Bleu', '#326999'],
  'bleu-marine': ['Bleu marine', '#233351'], rouge: ['Rouge', '#ad3536'],
  vert: ['Vert', '#4a704d'], naturel: ['Naturel', '#d8c6a2'], gris: ['Gris', '#80817f'],
  marron: ['Marron', '#795643'], orange: ['Orange', '#e27e39'], jaune: ['Jaune', '#e2b836'],
  rose: ['Rose', '#daa0ac'], fuchsia: ['Fuchsia', '#bd488a'], violet: ['Violet', '#715089'],
  dore: ['Doré', '#af914c'], argent: ['Argent', '#b0b3b4'], beige: ['Beige', '#d7be9e'],
  transparent: ['Transparent', '#efefef'], multicolore: ['Multicolore', '#c89586'],
};

export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export const number = value => new Intl.NumberFormat('fr-MA').format(value);
export const colorName = key => colorMap[key]?.[0] ?? key.replaceAll('-', ' ');
export const productPath = p => '/produits/' + p.id + '/';
export const familyPath = id => '/collections/' + id + '/';
export const pageSize = 24;
const mad = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
export const unitPriceLabel = unitMinor => unitMinor === null ? 'Prix sur devis' : mad.format(unitMinor / 100) + ' TTC / pièce';

export function picture(p, lazy = true) {
  return `<img class="product-photo" src="${escape(p.photo)}" width="400" height="400" alt="${escape(p.name + ' · ' + p.type)}" referrerpolicy="no-referrer" decoding="async"${lazy ? ' loading="lazy"' : ''}>`;
}

export function swatches(p, detail = false) {
  if (!p.colors.length) return '';
  const shown = detail ? p.colors : p.colors.slice(0, 7);
  return `<ul class="swatches${detail ? ' swatches-detail' : ''}" aria-label="Coloris">${shown.map(key =>
    `<li title="${escape(colorName(key))}"><i class="dot" style="--swatch:${colorMap[key]?.[1] ?? '#ded4c5'}"></i><span class="${detail ? '' : 'sr-only'}">${escape(colorName(key))}</span></li>`).join('')}${p.colors.length > shown.length ? `<li>+${p.colors.length - shown.length}</li>` : ''}</ul>`;
}

export function stock(p) {
  const value = p.stock === null ? 'Non renseigné' : (p.approximate ? '+' : '') + number(p.stock);
  return `<dl class="stock"><div><dt>Stock indicatif</dt><dd>${value}</dd></div><div><dt>Arrivage annoncé</dt><dd>—</dd></div></dl>`;
}

export function card(p) {
  return `<article class="card" data-product><a href="${productPath(p)}" class="photo-link">${picture(p)}<span class="photo-arrow" aria-hidden="true">↗</span></a>
    <div class="card-body"><p class="ref">${escape(p.sku)} <span>·</span> ${escape(p.type)}</p>
    <h3><a href="${productPath(p)}">${escape(p.name)}</a></h3>
    <p class="quote-price">${escape(unitPriceLabel(p.unitPriceMinor))}</p>${swatches(p)}${stock(p)}</div></article>`;
}
