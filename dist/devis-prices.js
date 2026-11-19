(() => {
  'use strict';

  const key = 'coffret-cie-devis-v1';
  const draftKey = 'coffret-cie-reference-v1';
  const minimum = 50;
  const maximum = 1000000;
  const formatQuantity = new Intl.NumberFormat('fr-MA').format;
  const validQuantity = n => Number.isSafeInteger(n) && n >= minimum && n <= maximum;
  const unitPrice = item => Number.isSafeInteger(item.unitPriceMinor) && item.unitPriceMinor > 0
    ? item.unitPriceMinor : null;
  const formatMoney = new Intl.NumberFormat('fr-MA', {
    style: 'currency', currency: 'MAD', minimumFractionDigits: 2,
  }).format;
  const money = minor => formatMoney(minor / 100);
  const confirmation = 'Disponibilité, marquage, livraison et montant définitif à confirmer.';
  const storageError = 'Impossible d’enregistrer la sélection dans ce navigateur.';

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(item => item && typeof item.id === 'string' &&
        /^[a-z0-9-]+$/.test(item.id) && typeof item.name === 'string' && validQuantity(item.quantity))
        .map(({ id, name, quantity }) => ({ id, name, quantity }));
    } catch {
      return [];
    }
  }

  function updateBadge(items) {
    const badge = document.querySelector('[data-quote-count]');
    if (badge) {
      badge.textContent = formatQuantity(items.length);
      badge.hidden = items.length === 0;
    }
  }

  function save(items) {
    localStorage.setItem(key, JSON.stringify(items));
    localStorage.removeItem(draftKey);
    updateBadge(items);
  }

  const tray = document.querySelector('#quote-tray');
  const trayToggle = document.querySelector('#tray-toggle');
  const trayContent = document.querySelector('#tray-content');

  function expandTray(expanded) {
    if (!tray) return;
    trayToggle.setAttribute('aria-expanded', String(expanded));
    trayContent.hidden = !expanded;
  }

  function renderTray(items) {
    if (!tray) return;
    tray.hidden = items.length === 0;
    document.querySelector('#tray-count').textContent = formatQuantity(items.length);
    document.querySelector('#tray-total').textContent =
      formatQuantity(items.reduce((total, item) => total + item.quantity, 0)) + ' pièces';
    const trayLines = document.querySelector('#tray-lines');
    trayLines.replaceChildren();
    for (const item of items) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = '/produits/' + item.id + '/';
      link.textContent = item.name;
      const quantity = document.createElement('span');
      quantity.textContent = formatQuantity(item.quantity) + ' pièces';
      row.append(link, quantity);
      trayLines.append(row);
    }
  }

  if (trayToggle) trayToggle.addEventListener('click', () => expandTray(trayContent.hidden));
  const initialItems = read();
  updateBadge(initialItems);
  renderTray(initialItems);
  const add = document.querySelector('#quote-add');
  if (add) {
    const product = JSON.parse(add.dataset.item);
    const input = add.elements.quantity;
    const status = document.querySelector('#quote-add-status');
    add.addEventListener('submit', event => {
      event.preventDefault();
      const quantity = input.valueAsNumber;
      if (!validQuantity(quantity)) return;
      const items = read();
      const index = items.findIndex(item => item.id === product.id);
      const combined = (items[index]?.quantity ?? 0) + quantity;
      if (!validQuantity(combined)) {
        status.textContent = 'La quantité totale dépasse le maximum autorisé par produit.';
        return;
      }
      const line = { ...product, quantity: combined };
      if (index === -1) items.push(line);
      else items[index] = line;
      try {
        save(items);
        renderTray(items);
        expandTray(true);
        status.textContent = formatQuantity(combined) + ' pièces de ce produit dans votre devis.';
        document.querySelector('#open-quote').hidden = false;
      } catch {
        status.textContent = storageError;
      }
    });
  }

  const page = document.querySelector('#quote-page');
  if (!page) {
    window.addEventListener('storage', updateFromStorage);
    return;
  }

  const list = page.querySelector('#quote-lines');
  const message = page.querySelector('#quote-message');
  const status = page.querySelector('#quote-status');
  const summary = page.querySelector('#quote-summary');
  const create = page.querySelector('#quote-create');
  const quoteDocument = page.querySelector('#quote-document');
  const share = page.querySelector('#quote-share');
  const currentProducts = JSON.parse(page.querySelector('#quote-product-index').textContent);
  const readPriced = () => read().map(item => {
    const product = Object.hasOwn(currentProducts, item.id) ? currentProducts[item.id] : null;
    return { ...item, name: product?.name ?? item.name, unitPriceMinor: product?.unitPriceMinor ?? null };
  });
  const selectionsKey = items => JSON.stringify(items.map(({ id, quantity, unitPriceMinor }) => [id, quantity, unitPriceMinor]));
  const contactNote = page.querySelector('#quote-contact-note');
  const email = page.querySelector('#quote-email');
  const whatsapp = page.querySelector('#quote-whatsapp');
  const lineTemplate = document.createElement('template');
  lineTemplate.innerHTML = '<li class="quote-line"><div><a class="quote-line-name"></a></div>' +
    '<form class="quote-line-form"><label>Pièces <input name="quantity" type="number" inputmode="numeric" step="1" required></label>' +
    '<button type="submit" class="quote-secondary">Mettre à jour</button></form>' +
    '<div class="quote-line-value"><span></span><button type="button" class="quote-remove">Retirer</button></div></li>';

  function updateFromStorage(event) {
    if (event.key !== key && event.key !== draftKey && event.key !== null) return;
    const items = read();
    updateBadge(items);
    renderTray(items);
    if (page) render();
  }

  function readDraft(items) {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      return draft?.selection === selectionsKey(items)
        && /^NG-\d{4}(?:-[0-9A-F]{8}){3}$/.test(draft.reference)
        && Number.isFinite(Date.parse(draft.createdAt)) ? draft : null;
    } catch {
      return null;
    }
  }

  function newDraft(items) {
    const date = new Date();
    const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Africa/Casablanca' }).format(date);
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte =>
      byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { reference: 'NG-' + year + '-' + hex.match(/.{8}/g).join('-'),
      createdAt: date.toISOString(), selection: selectionsKey(items) };
  }

  function recipient() {
    return ['name', 'company', 'city'].map(field => create.elements.namedItem(field).value.trim()).filter(Boolean);
  }

  function renderDocument(draft, items, pieces, estimate, contacts) {
    page.querySelector('#document-ref').textContent = draft.reference;
    page.querySelector('#document-date').textContent = new Intl.DateTimeFormat('fr-MA', {
      dateStyle: 'short', timeZone: 'Africa/Casablanca',
    }).format(new Date(draft.createdAt));
    page.querySelector('#document-recipient').textContent = contacts.join(' · ') || 'Non renseigné';
    const tbody = page.querySelector('#document-lines');
    tbody.replaceChildren();
    for (const item of items) {
      const unit = unitPrice(item);
      const row = document.createElement('tr');
      for (const value of [item.name, formatQuantity(item.quantity),
        unit === null ? '—' : money(unit), unit === null ? 'Sur devis' : money(unit * item.quantity)]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      tbody.append(row);
    }
    page.querySelector('#document-quantity').textContent = formatQuantity(pieces);
    page.querySelector('#document-money').textContent = estimate;
  }

  function render() {
    const items = readPriced();
    summary.hidden = items.length === 0;
    page.querySelector('#quote-empty').hidden = items.length !== 0;
    list.replaceChildren();
    if (!items.length) return;
    let subtotal = 0;
    let unknown = 0;
    let pieces = 0;
    const details = [];

    for (const item of items) {
      const unit = unitPrice(item);
      const cost = unit === null ? 'Prix sur devis' : money(unit * item.quantity);
      if (unit === null) unknown++;
      else subtotal += unit * item.quantity;
      pieces += item.quantity;
      details.push('• ' + item.name + ' — ' + formatQuantity(item.quantity) + ' pièces'
        + (unit === null ? '' : ' × ' + money(unit) + ' = ' + cost));

      const row = lineTemplate.content.cloneNode(true);
      const link = row.querySelector('.quote-line-name');
      link.href = '/produits/' + item.id + '/';
      link.textContent = item.name;
      row.querySelector('.quote-line-value span').textContent = cost;
      const quantityForm = row.querySelector('form');
      quantityForm.dataset.id = item.id;
      const input = quantityForm.elements.quantity;
      input.min = minimum;
      input.max = maximum;
      input.value = item.quantity;
      input.setAttribute('aria-label', 'Quantité pour ' + item.name);
      const remove = row.querySelector('.quote-remove');
      remove.dataset.id = item.id;
      remove.setAttribute('aria-label', 'Retirer ' + item.name);
      list.append(row);
    }

    const quoted = subtotal ? money(subtotal) : '';
    const estimate = quoted ? quoted + (unknown ? ' (partiel)' : '') : 'Sur devis';
    page.querySelector('#quote-total').textContent = formatQuantity(pieces);
    page.querySelector('#quote-money').textContent = estimate;
    const draft = readDraft(items);
    quoteDocument.hidden = !draft;
    share.hidden = !draft;
    if (!draft) return;
    const contacts = recipient();
    renderDocument(draft, items, pieces, estimate, contacts);
    const totalLines = ['Total : ' + formatQuantity(pieces) + ' pièces'];
    if (quoted) totalLines.push('Estimation articles TTC : ' + estimate);
    message.value = ['Bonjour Coffret & Cie,', 'Demande de devis : ' + draft.reference,
      ...(contacts.length ? ['Destinataire : ' + contacts.join(' · ')] : []), 'Je souhaite recevoir un devis pour les produits suivants :',
      '', ...details, '', ...totalLines, confirmation, '', 'Merci !'].join('\n');
    const encoded = encodeURIComponent(message.value);
    email.href = 'mailto:' + page.dataset.email + '?subject=' +
      encodeURIComponent('Demande de devis — ' + draft.reference) + '&body=' + encoded;
    whatsapp.href = 'https://wa.me/' + page.dataset.whatsapp + '?text=' + encoded;
    email.hidden = !page.dataset.email || encoded.length > 3800;
    whatsapp.hidden = !page.dataset.whatsapp || encoded.length > 3800;
    contactNote.textContent = encoded.length > 3800
      ? 'Pour cette sélection longue, copiez le message avant de le coller dans votre application.'
      : 'Copiez le texte pour le partager dans l’application de votre choix.';
    contactNote.hidden = !email.hidden && !whatsapp.hidden;
  }

  function apply(items, success) {
    try {
      save(items);
      render();
      status.textContent = success;
    } catch {
      status.textContent = storageError;
    }
  }

  list.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const quantity = form.elements.quantity.valueAsNumber;
    if (!validQuantity(quantity)) return;
    apply(read().map(item => item.id === form.dataset.id ? { ...item, quantity } : item), 'Quantité mise à jour.');
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('.quote-remove');
    if (button) apply(read().filter(item => item.id !== button.dataset.id), 'Produit retiré.');
  });
  create.addEventListener('submit', event => {
    event.preventDefault();
    const items = readPriced();
    if (!items.length) return;
    try {
      if (!readDraft(items)) localStorage.setItem(draftKey, JSON.stringify(newDraft(items)));
      render();
      quoteDocument.scrollIntoView({ block: 'start' });
      status.textContent = 'Votre demande de devis est prête.';
    } catch {
      status.textContent = storageError;
    }
  });
  create.addEventListener('change', () => {
    if (quoteDocument.hidden) return;
    try {
      localStorage.removeItem(draftKey);
      render();
      status.textContent = 'Cliquez sur Créer mon devis pour appliquer les nouvelles coordonnées.';
    } catch {
      status.textContent = storageError;
    }
  });
  page.querySelector('#quote-print').addEventListener('click', () => window.print());
  page.querySelector('#quote-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Message copié.';
    } catch {
      message.focus();
      message.select();
      status.textContent = 'Le message est sélectionné. Copiez-le avec votre navigateur.';
    }
  });
  window.addEventListener('storage', updateFromStorage);
  window.addEventListener('pageshow', render);
  render();
})();
