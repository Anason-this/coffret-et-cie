const grid = document.querySelector('#grid');
const search = document.querySelector('.search');
const query = new URLSearchParams(location.search).get('q') || '';
search.elements.q.value = query;

if (grid) {
  const form = document.querySelector('#filters');
  const sort = document.querySelector('#sort');
  const count = document.querySelector('#results-count');
  const empty = document.querySelector('#empty');
  const cards = Array.from(grid.querySelectorAll('[data-product]'));
  const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  function refresh() {
    const selected = new FormData(form);
    const colors = selected.getAll('color');
    const materials = selected.getAll('material');
    const terms = normalize(search.elements.q.value.trim()).split(/\s+/);
    const ordered = [...cards];
    if (sort.value === 'stock') ordered.sort((a, b) => Number(b.dataset.stock) - Number(a.dataset.stock));
    if (sort.value === 'name') ordered.sort((a, b) => a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent, 'fr'));
    let visible = 0;
    for (const card of ordered) {
      const matches = terms.every(term => normalize(card.dataset.search).includes(term))
        && (!colors.length || colors.includes(card.dataset.color))
        && (!materials.length || materials.includes(card.dataset.material))
        && (!selected.has('available') || Number(card.dataset.stock) > 0);
      card.hidden = !matches;
      if (matches) visible++;
    }
    if (ordered.some((card, index) => grid.children[index] !== card)) grid.append(...ordered);
    count.textContent = visible + (visible === 1 ? ' référence' : ' références');
    empty.hidden = visible !== 0;
  }

  if (location.pathname === '/') {
    search.addEventListener('submit', event => {
      event.preventDefault();
      const url = new URL(location.href);
      const value = search.elements.q.value.trim();
      if (value) url.searchParams.set('q', value);
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
      refresh();
    });
    search.elements.q.addEventListener('input', refresh);
  }
  form.addEventListener('change', refresh);
  form.addEventListener('reset', () => requestAnimationFrame(refresh));
  sort.addEventListener('change', refresh);
  refresh();
}
