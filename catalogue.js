import { card, number, pageSize } from './cards.mjs';

const grid = document.querySelector('#grid');
const search = document.querySelector('.search');
const query = new URLSearchParams(location.search).get('q') || '';
search.elements.q.value = query;

if (grid) {
  const family = document.querySelector('[data-catalog]').dataset.catalog;
  const form = document.querySelector('#filters');
  const sort = document.querySelector('#sort');
  const count = document.querySelector('#results-count');
  const empty = document.querySelector('#empty');
  const error = document.querySelector('#load-error');
  const pagination = document.querySelector('#pagination');
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  let catalog;
  let filtered = [];
  let currentPage = 1;

  function getCatalog() {
    catalog ??= fetch('/catalogue-data-full.json').then(response => {
      if (!response.ok) throw new Error('Catalogue indisponible');
      return response.json();
    }).catch(error => {
      catalog = undefined;
      throw error;
    });
    return catalog;
  }

  function render() {
    const start = (currentPage - 1) * pageSize;
    grid.innerHTML = filtered.slice(start, start + pageSize).map(card).join('');
    count.textContent = number(filtered.length) + (filtered.length === 1 ? ' référence' : ' références');
    empty.hidden = filtered.length !== 0;
    const total = Math.ceil(filtered.length / pageSize);
    pagination.hidden = total < 2;
    pagination.innerHTML = `<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Précédente</button>
      <span>Page ${currentPage} sur ${total}</span><button type="button" data-page="${currentPage + 1}" ${currentPage >= total ? 'disabled' : ''}>Suivante →</button>`;
  }

  async function refresh() {
    error.hidden = true;
    try {
      const all = await getCatalog();
      const selected = new FormData(form);
      const color = selected.get('color');
      const type = selected.get('type');
      const terms = normalize(search.elements.q.value.trim()).split(/\s+/).filter(Boolean);
      filtered = all.filter(p => {
        const searchable = normalize([p.name, p.sku, p.type, p.specification].join(' '));
        return (!family || p.family === family) && terms.every(term => searchable.includes(term))
          && (!color || p.colors.includes(color)) && (!type || p.type === type)
          && (!selected.has('available') || p.stock > 0);
      });
      if (sort.value === 'stock') filtered.sort((a, b) => (b.stock ?? -1) - (a.stock ?? -1));
      if (sort.value === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      currentPage = 1;
      render();
    } catch {
      error.hidden = false;
    }
  }

  pagination.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    currentPage = Number(button.dataset.page);
    render();
    document.querySelector('#result-title').focus();
  });
  if (!family) {
    let debounce;
    search.addEventListener('submit', event => {
      event.preventDefault();
      clearTimeout(debounce);
      const url = new URL('/', location.origin);
      const value = search.elements.q.value.trim();
      if (value) url.searchParams.set('q', value);
      history.replaceState(null, '', url);
      refresh();
    });
    search.elements.q.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 160);
    });
  }
  form.addEventListener('change', refresh);
  form.addEventListener('reset', () => requestAnimationFrame(refresh));
  sort.addEventListener('change', refresh);
  if (query) refresh();
}
