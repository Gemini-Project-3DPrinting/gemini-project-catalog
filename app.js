'use strict';
const $ = (id) => document.getElementById(id);
let catalog, category = 'all', query = '', activeProduct, photoIndex = 0;
const dialog = $('details');
const localImage = (path) => {
  if (typeof path !== 'string' || !/^assets\/[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) return 'assets/placeholder.svg';
  return path;
};
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function image(path, alt) {
  const img = node('img'); img.src = localImage(path); img.alt = alt; img.loading = 'lazy';
  img.addEventListener('error', () => { img.src = 'assets/placeholder.svg'; }, { once: true });
  return img;
}
function contactURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '#contacts'; } catch { return '#contacts'; }
}
function categoryName(id) { return catalog.categories.find(c => c.id === id)?.name || id; }
function renderFilters() {
  $('filters').replaceChildren();
  [{ id: 'all', name: 'Все изделия' }, ...catalog.categories].forEach(c => {
    const button = node('button', '', c.name); button.type = 'button'; button.setAttribute('aria-pressed', String(c.id === category));
    button.onclick = () => { category = c.id; renderFilters(); render(); };
    $('filters').append(button);
  });
}
function render() {
  const products = catalog.products.filter(p => p.visible !== false && (category === 'all' || p.category === category) && `${p.name} ${p.description} ${categoryName(p.category)}`.toLocaleLowerCase('ru').includes(query));
  $('grid').replaceChildren(); $('count').textContent = `Изделий: ${products.length}`; $('empty').hidden = products.length !== 0;
  products.forEach(p => {
    const card = node('button', 'card'); card.type = 'button'; card.setAttribute('aria-label', `Подробнее: ${p.name}${p.demo ? ' — демонстрационный пример' : ''}`);
    const visual = node('div', 'card-visual'); visual.append(image(p.images[0], p.demo ? `Демонстрационная иллюстрация: ${p.name}` : p.name));
    if (p.demo) visual.append(node('span', 'demo-badge', 'ДЕМО'));
    if (p.images.length > 1) visual.append(node('span', 'photo-badge', `${p.images.length} фото`));
    const arrow = node('span', 'card-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true'); visual.append(arrow);
    card.append(visual, node('p', 'card-category', categoryName(p.category)), node('h3', '', p.name), node('p', 'card-meta', p.price || 'Цена по запросу'));
    card.onclick = () => openProduct(p); $('grid').append(card);
  });
}
function showPhoto(index) {
  photoIndex = (index + activeProduct.images.length) % activeProduct.images.length;
  const img = $('detail-image'); img.onerror = () => { img.onerror = null; img.src = 'assets/placeholder.svg'; };
  img.src = localImage(activeProduct.images[photoIndex]); img.alt = `${activeProduct.demo ? 'Демо-иллюстрация' : activeProduct.name}, ракурс ${photoIndex + 1}`;
  $('image-count').textContent = `${photoIndex + 1} / ${activeProduct.images.length}`;
  $('prev').hidden = $('next').hidden = activeProduct.images.length < 2;
  [...$('thumbnails').children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === photoIndex)));
}
function openProduct(p) {
  activeProduct = p;
  $('detail-title').textContent = p.name; $('detail-category').textContent = categoryName(p.category);
  $('detail-demo').hidden = !p.demo; $('detail-description').textContent = p.description;
  const source = $('detail-source');
  source.hidden = !/^https:\/\/t\.me\/geminiproject_3dprinting\/\d+$/.test(p.sourceUrl || '');
  if (!source.hidden) source.href = p.sourceUrl;
  $('detail-price').textContent = p.price || 'Цена по запросу'; $('detail-status').textContent = p.status || 'Детали уточняйте при обсуждении';
  $('copy-status').textContent = ''; $('detail-specs').replaceChildren();
  Object.entries(p.specs || {}).forEach(([key, value]) => { const row = node('div'); row.append(node('dt', '', key), node('dd', '', value)); $('detail-specs').append(row); });
  $('thumbnails').replaceChildren();
  p.images.forEach((path, i) => { const button = node('button'); button.type = 'button'; button.setAttribute('aria-label', `Показать ракурс ${i + 1}`); button.append(image(path, '')); button.onclick = () => showPhoto(i); $('thumbnails').append(button); });
  showPhoto(0); document.body.classList.add('modal-open'); dialog.showModal(); dialog.scrollTop = 0;
}
async function load() {
  $('error').hidden = true; $('empty').hidden = true; $('count').textContent = 'Загружаем каталог…';
  try {
    const response = await fetch('products.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.categories) || !Array.isArray(data.products)) throw new Error('Неверная структура products.json');
    const ids = new Set();
    data.products.forEach(p => {
      if (!p.id || ids.has(p.id) || typeof p.name !== 'string' || typeof p.description !== 'string' || !data.categories.some(c => c.id === p.category)) throw new Error('Проверьте названия, категории и уникальность id товаров');
      ids.add(p.id); if (!Array.isArray(p.images) || !p.images.length) p.images = ['assets/placeholder.svg'];
    });
    catalog = data;
    document.querySelectorAll('[data-contact]').forEach(a => { a.href = contactURL(data.contactUrl); a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    $('filters').hidden = false; renderFilters(); render();
    const id = new URLSearchParams(location.hash.slice(1)).get('product');
    const product = catalog.products.find(p => p.id === id && p.visible !== false); if (product) openProduct(product);
  } catch (error) {
    $('grid').replaceChildren(); $('filters').hidden = true; $('count').textContent = 'Каталог недоступен'; $('error').hidden = false;
    $('error-message').textContent = location.protocol === 'file:' ? 'Откройте сайт через локальный сервер: инструкция находится в README.md. При открытии двойным щелчком браузер блокирует products.json.' : 'Проверьте подключение к интернету и файл products.json. Затем попробуйте снова.';
    console.error('Catalog:', error);
  }
}
$('search').addEventListener('input', (e) => { query = e.target.value.trim().toLocaleLowerCase('ru'); if (catalog) render(); });
$('reset').onclick = () => { category = 'all'; query = ''; $('search').value = ''; renderFilters(); render(); };
$('retry').onclick = load;
$('close').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(photoIndex - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(photoIndex + 1); } });
$('prev').onclick = () => showPhoto(photoIndex - 1); $('next').onclick = () => showPhoto(photoIndex + 1);
let touchX = null;
$('detail-image').addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
$('detail-image').addEventListener('touchend', e => { if (touchX !== null) { const delta = touchX - e.changedTouches[0].clientX; if (Math.abs(delta) > 45) showPhoto(photoIndex + (delta > 0 ? 1 : -1)); } touchX = null; }, { passive: true });
$('copy').onclick = async () => {
  const url = new URL(location.href); url.hash = new URLSearchParams({ product: activeProduct.id }).toString();
  const text = `Здравствуйте! Интересует ${activeProduct.demo ? 'демонстрационный пример' : 'изделие'} «${activeProduct.name}». ${url.href}`;
  try { await navigator.clipboard.writeText(text); $('copy-status').textContent = 'Скопировано. Вставьте сообщение в MAX.'; }
  catch { $('copy-status').textContent = text; }
};
$('year').textContent = new Date().getFullYear();
load();
