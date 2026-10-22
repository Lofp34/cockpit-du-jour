const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const KEY = 'cockpit-du-jour.v1';
const STATUS = { active: 'En cours', waiting: 'En attente', done: 'Terminé' };
const CATEGORIES = ['Commercial', 'Formation', 'Application', 'Méthode & outils', 'Suivi & accompagnement', 'Administration', 'Personnel', 'Autre'];
function categoryOptions(current = '') { return `${current && !CATEGORIES.includes(current) ? `<option value="${e(current)}" disabled>${e(current)} (ancienne catégorie)</option>` : ''}<option value="">Choisir une catégorie</option>${CATEGORIES.map(c => `<option value="${e(c)}" ${c === current ? 'selected' : ''}>${e(c)}</option>`).join('')}`; }
const PRIORITY = { normal: 'Normale', high: 'Haute', low: 'Basse' };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const day = (d = new Date()) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const dateLabel = value => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const seed = () => ({ version: 1, updatedAt: now(), projects: [
  ['Vaisala', 'Commercial', 'Préparer l’entretien avec Mathieu.', 'Préciser les objectifs de l’entretien'],
  ['Training Creator Compagnons du Devoir', 'Formation', 'Préparer les formations pour les jeunes Compagnons du Devoir.', 'Définir la prochaine séquence à préparer'],
  ['Training commercial vocal', 'Application', 'Faire évoluer l’application d’entraînement commercial vocal.', 'Choisir la prochaine amélioration à tester'],
  ['Skills BMAD', 'Méthode & outils', 'Suivre le skill BMAD générique et sa déclinaison pour l’application.', 'Faire le point sur les deux skills'],
  ['Formation Septéo', 'Formation', 'Construire et suivre le programme de formation Septéo.', 'Vérifier le programme et les supports'],
  ['Suivi Septéo Avocats', 'Suivi & accompagnement', 'Organiser le suivi de formation avec la manager.', 'Préparer le point de suivi des apprenants']
].map(([title, category, description, next]) => ({ id: uid(), title, category, description, next, status: 'active', priority: 'normal', due: '', notes: '', conversationUrl: '', steps: [], createdAt: now(), updatedAt: now() })), journal: [], drafts: {} });
function validDate(s) { return typeof s === 'string' && Number.isFinite(Date.parse(s)); }
function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.projects) || !Array.isArray(data.journal) || data.projects.length > 1000 || data.journal.length > 20000) throw Error('Format de sauvegarde non reconnu.');
  const ids = new Set();
  const string = (s, max = 100000) => { if (typeof s !== 'string' || s.length > max) throw Error('Un champ est invalide ou trop long.'); return s; };
  const id = s => { string(s, 100); if (!s || ids.has(s)) throw Error('Identifiant manquant ou dupliqué.'); ids.add(s); return s; };
  const projects = data.projects.map(p => {
    if (!p || !p.title?.trim() || !Object.hasOwn(STATUS, p.status) || !Object.hasOwn(PRIORITY, p.priority) || !Array.isArray(p.steps) || p.steps.length > 5000 || !validDate(p.createdAt) || !validDate(p.updatedAt)) throw Error('Une carte est invalide.');
    const due = string(p.due, 10);
    if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !validDate(due) || new Date(due).toISOString().slice(0, 10) !== due)) throw Error('Échéance invalide.');
    return { id: id(p.id), title: string(p.title, 160), category: string(p.category, 60), description: string(p.description, 10000), next: string(p.next, 500), conversationUrl: string(p.conversationUrl ?? '', 2048), notes: string(p.notes), status: p.status, priority: p.priority, due, createdAt: p.createdAt, updatedAt: p.updatedAt, steps: p.steps.map(s => { if (!s || typeof s.done !== 'boolean') throw Error('Étape invalide.'); return { id: id(s.id), text: string(s.text, 500), done: s.done }; }) };
  });
  const journal = data.journal.map(j => { if (!j || !validDate(j.createdAt) || (j.projectId !== null && typeof j.projectId !== 'string')) throw Error('Entrée de journal invalide.'); return { id: id(j.id), projectId: j.projectId, projectTitle: string(j.projectTitle, 160), text: string(j.text, 20000), createdAt: j.createdAt, updatedAt: validDate(j.updatedAt) ? j.updatedAt : j.createdAt }; });
  const drafts = {}; if (data.drafts && typeof data.drafts === 'object') for (const [key, value] of Object.entries(data.drafts)) { if (key === 'global' || projects.some(p => p.id === key)) drafts[key] = string(value, 20000); }
  return { version: 1, projects, journal, drafts, updatedAt: validDate(data.updatedAt) ? data.updatedAt : now() };
}
let state, lastRaw = null, blocked = false, selectedId = null, filter = 'all', view = 'projects';
function storageError(message) { $('#storage-error').textContent = message; $('#storage-error').hidden = false; $('#storage-state').textContent = 'Sauvegarde à vérifier'; }
try { lastRaw = localStorage.getItem(KEY); state = lastRaw ? validate(JSON.parse(lastRaw)) : seed(); }
catch { state = seed(); blocked = true; storageError('Les données locales ne peuvent pas être lues. Elles n’ont pas été écrasées. Restaurez une sauvegarde JSON valide pour reprendre, ou exportez vos modifications avant de fermer cette page.'); }
function save(force = false) {
  if (blocked && !force) return false;
  try {
    if (!force && localStorage.getItem(KEY) !== lastRaw) { blocked = true; storageError('Un autre onglet a modifié les données. Exportez vos changements si nécessaire, puis rechargez cette page avant de continuer.'); return false; }
    state.updatedAt = now(); const raw = JSON.stringify(state); localStorage.setItem(KEY, raw); lastRaw = raw; blocked = false; $('#storage-error').hidden = true; $('#storage-state').textContent = '✓ Enregistré dans ce navigateur'; return true;
  } catch { storageError('L’enregistrement local a échoué (stockage plein ou indisponible). Exportez vos données maintenant pour les conserver.'); return false; }
}
if (!lastRaw && !blocked) save();
window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { blocked = true; storageError('Les données ont changé dans un autre onglet. Exportez vos changements si nécessaire, puis rechargez cette page.'); } });
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 3800); }
const selected = () => state.projects.find(p => p.id === selectedId);
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function render() {
  const query = normalize($('#search').value.trim());
  const projects = state.projects.filter(p => (filter === 'all' || p.status === filter) && normalize(`${p.title} ${p.category} ${p.description} ${p.notes} ${p.next}`).includes(query));
  $('#nav-count').textContent = state.projects.length;
  const grid = $('#project-grid');
  // Reuse existing panels: typing never replaces a textarea, its focus or selection.
  const existing = new Map($$('.project-card', grid).map(card => [card.dataset.id, card]));
  const cards = projects.map(p => {
    const card = existing.get(p.id) || createCard(p);
    existing.delete(p.id); return card;
  });
  for (const card of existing.values()) card.remove();
  layoutCards(cards);
  $('#empty-projects').hidden = projects.length !== 0;
  $('#board-layout').textContent = `${projects.length} projet${projects.length > 1 ? 's' : ''} ouvert${projects.length > 1 ? 's' : ''} · ${projects.filter(p => p.status === 'done').length} terminé${projects.filter(p => p.status === 'done').length > 1 ? 's' : ''}`;
  const oldProject = $('#journal-project').value;
  $('#journal-project').innerHTML = '<option value="">Journal général</option>' + state.projects.map(p => `<option value="${e(p.id)}">${e(p.title)}</option>`).join('');
  if (state.projects.some(p => p.id === oldProject)) $('#journal-project').value = oldProject;
  renderJournal($('#journal-list'), state.journal);
}
function options(values, value) { return Object.entries(values).map(([key, text]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${text}</option>`).join(''); }
function createCard(p) {
  const card = document.createElement('article'); card.className = 'project-card'; card.dataset.id = p.id; card.setAttribute('aria-label', p.title);
  card.innerHTML = `<header class="pane-header"><div class="pane-heading"><button class="drag-handle" aria-label="Déplacer ${e(p.title)}" aria-haspopup="dialog" title="Glisser pour déplacer · Cliquer pour choisir une position · Alt + flèches">⠿</button><h2><button class="card-open" aria-label="${e(p.title)}" data-rename="${e(p.id)}" title="Modifier le titre">${e(p.title)}</button><input class="title-editor" aria-label="Titre du projet" maxlength="160" autocomplete="off" hidden></h2><button class="expand-button" data-open="${e(p.id)}" aria-label="Agrandir ${e(p.title)}">↗</button></div><div class="pane-meta"><select data-field="category" aria-label="Catégorie">${categoryOptions(p.category)}</select><select data-field="status" aria-label="Statut">${options(STATUS, p.status)}</select></div></header><div class="pane-content"><div class="pane-scroll"><div class="pane-columns"><div class="writing-column"><label class="next-label">Prochaine action<textarea data-field="next" rows="2" maxlength="500" placeholder="La prochaine action concrète…">${e(p.next)}</textarea></label><section class="notes-section"><label>Notes persistantes<textarea data-field="notes" rows="5" maxlength="100000" placeholder="Où en êtes-vous ? Décisions, contexte, points à reprendre…">${e(p.notes)}</textarea></label></section><section class="pane-journal"><h3>Journal du projet</h3><div class="pane-entries"></div><form data-form="journal" class="inline-form"><textarea name="journal" rows="2" aria-label="Nouvelle entrée au journal" maxlength="20000" placeholder="Une avancée à consigner…" required>${e(state.drafts[p.id] || '')}</textarea><button type="submit" aria-label="Ajouter au journal">＋</button></form></section></div><div class="tracking-column"><section class="conversation-section"><label>Agent ou conversation<input type="url" data-field="conversationUrl" maxlength="2048" placeholder="Coller le lien https://…" autocomplete="off" spellcheck="false"></label><a class="conversation-link" target="_blank" rel="noopener noreferrer" hidden>Ouvrir la conversation ↗</a><small class="link-error" hidden>Utilisez une adresse complète commençant par https:// ou http://.</small></section><section class="steps-section"><div class="section-label"><h3>Étapes</h3><span class="pane-step-count"></span></div><ul class="pane-steps"></ul><form data-form="step" class="inline-form"><input name="step" aria-label="Nouvelle étape" maxlength="500" placeholder="Ajouter une étape…" required><button type="submit" aria-label="Ajouter l’étape">＋</button></form></section></div></div><div class="pane-more"><label>Objectif<textarea data-field="description" rows="2" maxlength="10000">${e(p.description)}</textarea></label><div class="pane-planning"><label>Priorité<select data-field="priority">${options(PRIORITY, p.priority)}</select></label><label>Échéance<input type="date" data-field="due" value="${e(p.due)}"></label></div></div></div><div class="done-overlay" hidden><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="m23 40 12 12 23-25"/></svg><strong>C’est fait.</strong><span>Projet terminé</span><div><button data-action="resume">Reprendre</button><button data-open="${e(p.id)}">Consulter la fiche</button></div></div></div>`;
  $('[data-field="category"]', card).value = p.category;
  updateCardDetails(card, p); return card;
}
function safeConversationUrl(value) {
  try { const url = new URL(value.trim()); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
function updateConversationLink(card, p) {
  const url = safeConversationUrl(p.conversationUrl || ''), link = $('.conversation-link', card);
  link.hidden = !url;
  if (url) link.href = url; else link.removeAttribute('href');
  const invalid = !!p.conversationUrl?.trim() && !url;
  $('.link-error', card).hidden = !invalid;
  $('[data-field="conversationUrl"]', card).setAttribute('aria-invalid', String(invalid));
}
function stepControls(step, index, total) {
  return `<span class="step-order"><button type="button" data-move-step="${e(step.id)}" data-direction="-1" aria-label="Monter l’étape ${e(step.text)}" title="Monter l’étape" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move-step="${e(step.id)}" data-direction="1" aria-label="Descendre l’étape ${e(step.text)}" title="Descendre l’étape" ${index === total - 1 ? 'disabled' : ''}>↓</button></span>`;
}
function moveStep(project, button, root) {
  const id = button.dataset.moveStep, direction = Number(button.dataset.direction);
  const index = project.steps.findIndex(step => step.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= project.steps.length) return;
  const list = $('.pane-steps, #steps', root), scrollTop = list.scrollTop;
  project.steps.splice(target, 0, project.steps.splice(index, 1)[0]);
  project.updatedAt = now(); const saved = save();
  if (root.matches('.project-card')) updateCardDetails(root, project); else renderDetails();
  list.scrollTop = scrollTop;
  const buttons = $$('[data-move-step]', root).filter(b => b.dataset.moveStep === id && !b.disabled);
  (buttons.find(b => Number(b.dataset.direction) === direction) || buttons[0])?.focus({ preventScroll: true });
  toast(saved ? `Étape déplacée en position ${target + 1} sur ${project.steps.length}.` : 'Étape déplacée ; exportez vos données pour la conserver.');
}
function updateCardDetails(card, p) {
  updateConversationLink(card, p);
  syncCardTitle(card, p);
  for (const field of fields) { const input = $(`[data-field="${field}"]`, card); if (input && document.activeElement !== input) { if (field === 'category') input.innerHTML = categoryOptions(p.category); input.value = p[field]; } }
  card.classList.toggle('is-done', p.status === 'done');
  $('.done-overlay', card).hidden = p.status !== 'done'; $('.pane-scroll', card).inert = p.status === 'done';
  $('.pane-step-count', card).textContent = `${p.steps.filter(s => s.done).length}/${p.steps.length}`;
  $('.pane-steps', card).innerHTML = p.steps.length ? p.steps.map((s, index) => `<li><label><input type="checkbox" data-pane-step="${e(s.id)}" ${s.done ? 'checked' : ''}><span>${e(s.text)}</span></label>${stepControls(s, index, p.steps.length)}<button data-remove-step="${e(s.id)}" aria-label="Supprimer l’étape ${e(s.text)}">×</button></li>`).join('') : '<li class="muted">Aucune étape définie.</li>';
  renderJournal($('.pane-entries', card), state.journal.filter(j => j.projectId === p.id));
  const draft = $('[name="journal"]', card); if (document.activeElement !== draft) draft.value = state.drafts[p.id] || '';
}
function refreshCards() { for (const card of $$('.project-card')) { const p = state.projects.find(p => p.id === card.dataset.id); if (p) updateCardDetails(card, p); } }
let lastLayout = '';
function layoutCards(cards = $$('.project-card')) {
  const grid = $('#project-grid'), n = cards.length, width = grid.clientWidth, height = grid.clientHeight;
  if (!n) { grid.replaceChildren(); lastLayout = ''; return; }
  const mobile = window.innerWidth < 1000;
  let rows = 1;
  if (!mobile) {
    let best = Infinity;
    for (let r = 1; r <= n; r++) {
      const columns = Math.ceil(n / r), cellW = width / columns, cellH = height / r;
      const score = Math.abs(Math.log((cellW / Math.max(cellH, 1)) / 1.35)) + (r > Math.ceil(n / 2) ? .5 : 0);
      if (score < best) { best = score; rows = r; }
    }
  } else rows = n;
  const counts = Array.from({ length: rows }, (_, i) => Math.floor(n / rows) + (i < n % rows ? 1 : 0));
  const signature = `${mobile}:${counts.join(',')}:${cards.map(c => c.dataset.id).join(',')}`;
  if (signature !== lastLayout) {
    const fragment = document.createDocumentFragment(); let index = 0;
    for (const count of counts) { const row = document.createElement('div'); row.className = 'mosaic-row'; row.dataset.count = count; for (let i = 0; i < count; i++) row.append(cards[index++]); fragment.append(row); }
    grid.replaceChildren(fragment); lastLayout = signature;
  }
  // Weight rows by their column count and actual gutters, so every panel has equal area, including odd totals.
  for (const row of $$('.mosaic-row', grid)) { const count = Number(row.dataset.count); row.style.flexGrow = String(count * width / Math.max(width - (count - 1) * 12, 1)); }
}
new ResizeObserver(() => { if (!$('#projects-view').hidden) layoutCards(); }).observe($('#project-grid'));
function renderJournal(container, entries) {
  container.innerHTML = entries.length ? [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(j => `<article class="journal-entry"><time datetime="${e(j.createdAt)}">${e(dateLabel(j.createdAt))}</time><span class="entry-project">${e(state.projects.find(p => p.id === j.projectId)?.title || j.projectTitle || 'Journal général')}</span><p>${e(j.text)}</p><div class="entry-actions"><button class="text-button" data-edit-entry="${e(j.id)}">Modifier</button><button class="text-button danger" data-delete-entry="${e(j.id)}">Supprimer</button></div></article>`).join('') : '<p class="empty">Le journal attend votre première avancée.</p>';
}
function renderDetails() {
  refreshCards();
  const p = selected(); if (!p) return;
  const n = p.steps.filter(s => s.done).length; $('#step-count').textContent = `${n} / ${p.steps.length} terminées`;
  $('#steps').innerHTML = p.steps.map((s, index) => `<li><label><input type="checkbox" data-step="${e(s.id)}" ${s.done ? 'checked' : ''}><span>${e(s.text)}</span></label>${stepControls(s, index, p.steps.length)}<button type="button" data-delete-step="${e(s.id)}" aria-label="Supprimer l’étape ${e(s.text)}">×</button></li>`).join('');
  renderJournal($('#project-journal-list'), state.journal.filter(j => j.projectId === p.id));
}
const fields = ['title', 'category', 'status', 'priority', 'due', 'description', 'next', 'notes', 'conversationUrl'];
function openProject(id = null) {
  selectedId = id; const p = selected(); $('#project-form').reset(); $('#project-category').innerHTML = categoryOptions(p?.category || '');
  for (const f of fields) $('#project-' + f).value = p?.[f] ?? (f === 'status' ? 'active' : f === 'priority' ? 'normal' : '');
  $('#dialog-title').textContent = p?.title || 'Nouveau projet'; $('#create-project').hidden = !!p; $('#project-details').hidden = !p;
  $('.hint').textContent = p ? 'Les modifications sont enregistrées automatiquement.' : 'Donnez-lui un nom. Vous pourrez enrichir la fiche à votre rythme.';
  $('#project-title').setCustomValidity(''); $('#project-journal').value = state.drafts[id] || ''; $('#step-text').value = '';
  renderDetails(); $('#project-dialog').showModal(); $('#project-dialog').scrollTop = 0; if (!p) $('#project-title').focus();
}
$('#project-form').addEventListener('input', () => {
  const p = selected(); if (!p) return;
  const title = $('#project-title').value.trim(); $('#project-title').setCustomValidity(title ? '' : 'Le nom du projet ne peut pas être vide.');
  for (const f of fields) if (f !== 'title' || title) p[f] = $('#project-' + f).value;
  p.updatedAt = now(); $('#dialog-title').textContent = p.title; save(); refreshCards(); render();
});
$('#project-form').addEventListener('submit', event => {
  event.preventDefault(); if (selected()) return;
  const title = $('#project-title').value.trim(); if (!title) { $('#project-title').setCustomValidity('Saisissez un nom de projet.'); $('#project-title').reportValidity(); return; }
  const p = { id: uid(), steps: [], createdAt: now(), updatedAt: now() }; for (const f of fields) p[f] = $('#project-' + f).value; p.title = title;
  state.projects.push(p); const saved = save(); $('#project-dialog').close(); filter = 'all'; $$('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter)); $('#search').value = ''; render(); $('#project-grid').querySelector(`[data-id="${p.id}"] [data-field="next"]`)?.focus(); toast(saved ? 'Projet créé et enregistré.' : 'Projet créé ; exportez-le pour le conserver.');
});
$('#project-title').addEventListener('input', () => { if ($('#project-title').value.trim()) $('#project-title').setCustomValidity(''); });
$('#close-project').onclick = () => $('#project-dialog').close();
$('#new-project').onclick = () => openProject();
$('#project-grid').onclick = event => {
  const rename = event.target.closest('[data-rename]'); if (rename) { startTitleEdit(rename.closest('.project-card')); return; }
  const button = event.target.closest('[data-open]'); if (button) { openProject(button.dataset.open); return; }
  const card = event.target.closest('.project-card'); if (!card) return; const p = state.projects.find(p => p.id === card.dataset.id);
  if (event.target.closest('[data-action="resume"]')) { p.status = 'active'; p.updatedAt = now(); save(); updateCardDetails(card, p); render(); $('[data-field="status"]', card)?.focus(); }
  const move = event.target.closest('[data-move-step]'); if (move) { moveStep(p, move, card); return; }
  const del = event.target.closest('[data-remove-step]'); if (del) confirm('Supprimer cette étape ?', () => { p.steps = p.steps.filter(s => s.id !== del.dataset.removeStep); p.updatedAt = now(); save(); updateCardDetails(card, p); });
};
$('#project-grid').addEventListener('input', event => {
  const card = event.target.closest('.project-card'); if (!card) return; const p = state.projects.find(p => p.id === card.dataset.id);
  const field = event.target.dataset.field;
  if (field && fields.includes(field)) { if (field === 'category' && event.target.value && !CATEGORIES.includes(event.target.value)) return; p[field] = event.target.value; p.updatedAt = now(); save(); if (field === 'conversationUrl') updateConversationLink(card, p); }
  if (event.target.name === 'journal') { state.drafts[p.id] = event.target.value; save(); }
});
$('#project-grid').addEventListener('change', event => {
  const card = event.target.closest('.project-card'); if (!card) return; const p = state.projects.find(p => p.id === card.dataset.id);
  const step = p.steps.find(s => s.id === event.target.dataset.paneStep);
  if (step) { step.done = event.target.checked; p.updatedAt = now(); save(); $('.pane-step-count', card).textContent = `${p.steps.filter(s => s.done).length}/${p.steps.length}`; }
  if (event.target.dataset.field === 'status') { updateCardDetails(card, p); render(); }
});
$('#project-grid').addEventListener('submit', event => {
  const form = event.target.closest('[data-form]'); if (!form) return; event.preventDefault(); const card = form.closest('.project-card'), p = state.projects.find(p => p.id === card.dataset.id);
  if (form.dataset.form === 'step') { const input = $('[name="step"]', form), text = input.value.trim(); if (!text) return; p.steps.push({ id: uid(), text, done: false }); p.updatedAt = now(); input.value = ''; save(); updateCardDetails(card, p); input.focus(); }
  if (form.dataset.form === 'journal') { const input = $('[name="journal"]', form); if (!addEntry(input.value, p.id)) return; delete state.drafts[p.id]; input.value = ''; save(); updateCardDetails(card, p); renderJournal($('#journal-list'), state.journal); input.focus(); }
});
$('#fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Utilisez le mode plein écran de votre navigateur.'); } };
document.addEventListener('fullscreenchange', () => { $('#fullscreen').textContent = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran'; });
$('#search').addEventListener('input', render);
$$('.filter').forEach(button => button.onclick = () => { filter = button.dataset.filter; $$('.filter').forEach(b => b.classList.toggle('active', b === button)); render(); });
$$('[data-view]').forEach(button => button.onclick = () => {
  view = button.dataset.view; $$('[data-view]').forEach(b => b.classList.toggle('active', b === button)); $('#projects-view').hidden = view !== 'projects'; $('#journal-view').hidden = view !== 'journal'; document.body.classList.toggle('journal-mode', view === 'journal'); render();
});
$('#step-form').onsubmit = event => { event.preventDefault(); const text = $('#step-text').value.trim(), p = selected(); if (!text || !p) return; p.steps.push({ id: uid(), text, done: false }); p.updatedAt = now(); save(); $('#step-text').value = ''; renderDetails(); render(); $('#step-text').focus(); };
$('#steps').onchange = event => { const p = selected(), step = p?.steps.find(s => s.id === event.target.dataset.step); if (!step) return; step.done = event.target.checked; p.updatedAt = now(); save(); renderDetails(); render(); };
let confirmAction;
function confirm(message, action) { $('#confirm-message').textContent = message; confirmAction = action; $('#confirm-dialog').showModal(); $('#confirm-cancel').focus(); }
$('#confirm-cancel').onclick = () => $('#confirm-dialog').close();
$('#confirm-ok').onclick = () => { $('#confirm-dialog').close(); confirmAction?.(); confirmAction = null; };
$('#steps').onclick = event => { const move = event.target.closest('[data-move-step]'); if (move) { moveStep(selected(), move, $('#project-dialog')); return; } const button = event.target.closest('[data-delete-step]'); if (!button) return; const p = selected(); confirm('Supprimer cette étape ?', () => { p.steps = p.steps.filter(s => s.id !== button.dataset.deleteStep); p.updatedAt = now(); save(); renderDetails(); render(); }); };
$('#delete-project').onclick = () => { const p = selected(); confirm(`Supprimer « ${p.title} » et ses notes ? Les entrées du journal seront conservées.`, () => { for (const j of state.journal) if (j.projectId === p.id) { j.projectTitle = p.title; j.projectId = null; } state.projects = state.projects.filter(x => x.id !== p.id); delete state.drafts[p.id]; save(); $('#project-dialog').close(); selectedId = null; render(); toast('Projet supprimé. Son journal est conservé.'); }); };
function addEntry(text, projectId) { if (!text.trim()) return false; const p = state.projects.find(p => p.id === projectId); state.journal.push({ id: uid(), projectId: p?.id || null, projectTitle: p?.title || '', text: text.trim(), createdAt: now(), updatedAt: now() }); return true; }
$('#global-journal-form').onsubmit = event => { event.preventDefault(); if (!addEntry($('#global-journal').value, $('#journal-project').value)) return; $('#global-journal').value = ''; delete state.drafts.global; const saved = save(); render(); toast(saved ? 'Entrée ajoutée au journal.' : 'Entrée ajoutée ; exportez pour la conserver.'); };
$('#project-journal-form').onsubmit = event => { event.preventDefault(); if (!addEntry($('#project-journal').value, selectedId)) return; $('#project-journal').value = ''; delete state.drafts[selectedId]; const saved = save(); renderDetails(); render(); toast(saved ? 'Entrée ajoutée au journal.' : 'Entrée ajoutée ; exportez pour la conserver.'); };
$('#global-journal').value = state.drafts.global || '';
$('#global-journal').oninput = () => { state.drafts.global = $('#global-journal').value; save(); };
$('#project-journal').oninput = () => { if (selectedId) { state.drafts[selectedId] = $('#project-journal').value; save(); } };
const editDialog = document.createElement('dialog'); editDialog.setAttribute('aria-labelledby', 'edit-heading'); editDialog.innerHTML = '<h2 id="edit-heading">Modifier l’entrée</h2><form id="edit-form"><label for="edit-text">Texte du journal</label><textarea id="edit-text" rows="8" maxlength="20000" required></textarea><div class="confirm-actions"><button type="button" class="button secondary" id="edit-cancel">Annuler</button><button class="button primary" type="submit">Enregistrer</button></div></form>'; document.body.append(editDialog);
let editingId; $('#edit-cancel').onclick = () => editDialog.close();
$('#edit-form').onsubmit = event => { event.preventDefault(); const entry = state.journal.find(j => j.id === editingId); if (entry && $('#edit-text').value.trim()) { entry.text = $('#edit-text').value.trim(); entry.updatedAt = now(); save(); render(); renderDetails(); editDialog.close(); } };
document.addEventListener('click', event => { const del = event.target.closest('[data-delete-entry]'), edit = event.target.closest('[data-edit-entry]'); if (del) confirm('Supprimer définitivement cette entrée du journal ?', () => { state.journal = state.journal.filter(j => j.id !== del.dataset.deleteEntry); save(); render(); renderDetails(); }); if (edit) { editingId = edit.dataset.editEntry; $('#edit-text').value = state.journal.find(j => j.id === editingId).text; editDialog.showModal(); } });
function download(content, name, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
const md = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]#|])/g, '\\$1');
function markdown() {
  const lines = ['# Cockpit du jour', '', `Exporté le ${dateLabel(now())}.`, '', '> Bilan manuel : les statuts et notes reflètent vos saisies, sans synchronisation avec vos agents.', '', '## Projets', ''];
  for (const p of state.projects) {
    lines.push(`### ${md(p.title)}`, '', `- **Catégorie :** ${md(p.category)}`, `- **Statut :** ${STATUS[p.status]}`, `- **Priorité :** ${PRIORITY[p.priority]}`, `- **Échéance :** ${p.due || 'Non définie'}`, `- **Créé le :** ${dateLabel(p.createdAt)}`, `- **Mis à jour le :** ${dateLabel(p.updatedAt)}`, '', '**Objectif**', '', md(p.description) || 'À compléter.', '', '**Prochaine action**', '', md(p.next) || 'À définir.', '', '**Agent ou conversation**', '', md(p.conversationUrl || '') || 'Aucun lien défini.', '', '**Étapes**', '', ...(p.steps.length ? p.steps.map(s => `- [${s.done ? 'x' : ' '}] ${md(s.text).replace(/\n/g, '\n  ')}`) : ['Aucune étape définie.']), '', '**Notes**', '', md(p.notes) || 'Aucune note.', '');
  }
  lines.push('## Journal de bord', '');
  for (const j of [...state.journal].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) lines.push(`### ${dateLabel(j.createdAt)} — ${md(state.projects.find(p => p.id === j.projectId)?.title || j.projectTitle || 'Journal général')}`, '', md(j.text), '');
  if (!state.journal.length) lines.push('Aucune entrée.', '');
  const drafts = Object.entries(state.drafts).filter(([, text]) => text.trim());
  if (drafts.length) { lines.push('## Brouillons non publiés au journal', ''); for (const [id, text] of drafts) lines.push(`### ${md(state.projects.find(p => p.id === id)?.title || 'Journal général')}`, '', md(text), ''); }
  return lines.join('\n');
}
$('#export').onclick = () => { download(markdown(), `cockpit-du-jour-${day()}.md`, 'text/markdown;charset=utf-8'); toast('Export Markdown téléchargé.'); };
$('#backup').onclick = () => { download(JSON.stringify(state, null, 2), `cockpit-du-jour-${day()}.json`, 'application/json;charset=utf-8'); toast('Sauvegarde JSON téléchargée.'); };
$('#import-button').onclick = () => $('#import-file').click();
$('#import-file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 15000000) throw Error('Le fichier dépasse 15 Mo.'); const imported = validate(JSON.parse(await file.text())); confirm(`Restaurer ${imported.projects.length} projets et ${imported.journal.length} entrées ? Les données actuelles seront remplacées. Une sauvegarde de l’état actuel sera téléchargée avant le remplacement.`, () => { download(JSON.stringify(state, null, 2), `cockpit-avant-restauration-${Date.now()}.json`, 'application/json'); state = imported; $('#project-grid').replaceChildren(); lastLayout = ''; const saved = save(true); $('#global-journal').value = state.drafts.global || ''; render(); toast(saved ? 'Sauvegarde restaurée.' : 'Restauration en mémoire uniquement : exportez avant de quitter.'); }); }
  catch (error) { toast('Import refusé : ' + error.message); }
  event.target.value = '';
};
// Project order lives in state.projects, so existing backups and Markdown keep it too.
function syncCardTitle(card, project) {
  $('.card-open', card).textContent = project.title;
  $('.card-open', card).setAttribute('aria-label', project.title);
  card.setAttribute('aria-label', project.title);
  $('.drag-handle', card).setAttribute('aria-label', `Déplacer ${project.title}`);
  $('.expand-button', card).setAttribute('aria-label', `Agrandir ${project.title}`);
  const editor = $('.title-editor', card);
  if (editor.hidden) editor.value = project.title;
}
function startTitleEdit(card) {
  const project = state.projects.find(p => p.id === card.dataset.id), editor = $('.title-editor', card);
  editor.dataset.original = project.title; editor.value = project.title;
  $('.card-open', card).hidden = true; editor.hidden = false;
  editor.removeAttribute('aria-invalid'); editor.focus(); editor.select();
}
function finishTitleEdit(editor, cancel = false) {
  if (editor.hidden) return;
  const card = editor.closest('.project-card'), project = state.projects.find(p => p.id === card.dataset.id);
  const title = cancel ? editor.dataset.original : editor.value.trim();
  if (title) { project.title = title; project.updatedAt = now(); save(); }
  else toast('Le titre ne peut pas être vide. Le dernier titre a été conservé.');
  editor.hidden = true; editor.removeAttribute('aria-invalid'); $('.card-open', card).hidden = false;
  syncCardTitle(card, project);
  renderJournal($('#journal-list'), state.journal); refreshJournalLabels(project);
}
function refreshJournalLabels(project) {
  for (const option of $('#journal-project').options) if (option.value === project.id) option.textContent = project.title;
}
$('#project-grid').addEventListener('input', event => {
  if (!event.target.matches('.title-editor')) return;
  const editor = event.target, card = editor.closest('.project-card'), title = editor.value.trim();
  editor.setAttribute('aria-invalid', String(!title));
  if (!title) return;
  const project = state.projects.find(p => p.id === card.dataset.id);
  project.title = title; project.updatedAt = now(); save(); syncCardTitle(card, project);
});
$('#project-grid').addEventListener('focusout', event => { if (event.target.matches('.title-editor')) finishTitleEdit(event.target); });
$('#project-grid').addEventListener('keydown', event => {
  if (!event.target.matches('.title-editor') || event.isComposing) return;
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault(); const card = event.target.closest('.project-card');
    if (event.key === 'Enter' && !event.target.value.trim()) { toast('Saisissez un titre pour ce projet.'); return; }
    finishTitleEdit(event.target, event.key === 'Escape'); $('.card-open', card).focus();
  }
});
function moveProject(id, destination) {
  const visible = $$('.project-card').map(card => card.dataset.id), from = visible.indexOf(id);
  const to = Math.max(0, Math.min(destination, visible.length - 1));
  if (from < 0 || from === to) return;
  const visibleSet = new Set(visible); visible.splice(from, 1); visible.splice(to, 0, id);
  const byId = new Map(state.projects.map(p => [p.id, p])); let index = 0;
  // In a filtered view, only reorder visible slots; hidden projects stay in place.
  state.projects = state.projects.map(p => visibleSet.has(p.id) ? byId.get(visible[index++]) : p);
  const saved = save(); render();
  const card = $$('.project-card').find(c => c.dataset.id === id); $('.drag-handle', card)?.focus({ preventScroll: true });
  toast(`${byId.get(id).title} : position ${to + 1} sur ${visible.length}.${saved ? ' Ordre enregistré.' : ' Exportez pour conserver ce changement.'}`);
}
const orderMenu = document.createElement('div'); orderMenu.id = 'order-menu'; orderMenu.hidden = true;
orderMenu.setAttribute('role', 'dialog'); orderMenu.setAttribute('aria-label', 'Ordre des cartes');
orderMenu.innerHTML = '<p class="order-caption"></p><button data-move="first">Placer au début</button><button data-move="previous">Déplacer d’une place avant</button><button data-move="next">Déplacer d’une place après</button><button data-move="last">Placer à la fin</button><p class="order-help">Glisser la poignée ou utiliser Alt + flèches.</p>';
document.body.append(orderMenu);
let menuProject = null;
function closeOrderMenu() {
  orderMenu.hidden = true;
  $$('.drag-handle[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function openOrderMenu(handle) {
  const card = handle.closest('.project-card'), cards = $$('.project-card'), index = cards.indexOf(card);
  menuProject = card.dataset.id; $('.order-caption', orderMenu).textContent = `Position ${index + 1} sur ${cards.length}`;
  for (const button of $$('[data-move]', orderMenu)) button.disabled = ['first', 'previous'].includes(button.dataset.move) ? index === 0 : index === cards.length - 1;
  const box = handle.getBoundingClientRect(); orderMenu.hidden = false; handle.setAttribute('aria-expanded', 'true');
  orderMenu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - orderMenu.offsetWidth - 8))}px`;
  orderMenu.style.top = `${Math.max(8, Math.min(box.bottom + 5, innerHeight - orderMenu.offsetHeight - 8))}px`;
  $('button:not(:disabled)', orderMenu)?.focus();
}
orderMenu.onclick = event => {
  const button = event.target.closest('[data-move]'); if (!button) return;
  const cards = $$('.project-card'), current = cards.findIndex(c => c.dataset.id === menuProject);
  const destination = { first: 0, previous: current - 1, next: current + 1, last: cards.length - 1 }[button.dataset.move];
  closeOrderMenu(); moveProject(menuProject, destination);
};
document.addEventListener('pointerdown', event => { if (!orderMenu.contains(event.target) && !event.target.closest('.drag-handle')) closeOrderMenu(); });
let drag = null, suppressClickUntil = 0;
const dragHint = document.createElement('div'); dragHint.className = 'drag-hint'; dragHint.hidden = true; dragHint.setAttribute('aria-hidden', 'true'); document.body.append(dragHint);
function clearDrag() {
  if (!drag) return;
  const handle = drag.handle, pointerId = drag.pointerId; drag = null;
  if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
  $$('.is-dragging,.drop-before,.drop-after').forEach(c => c.classList.remove('is-dragging', 'drop-before', 'drop-after'));
  dragHint.hidden = true; document.body.classList.remove('reordering');
}
$('#project-grid').addEventListener('pointerdown', event => {
  const handle = event.target.closest('.drag-handle'); if (!handle || event.button !== 0 || !event.isPrimary) return;
  closeOrderMenu();
  drag = { handle, pointerId: event.pointerId, card: handle.closest('.project-card'), x: event.clientX, y: event.clientY, active: false, target: null };
  handle.setPointerCapture(event.pointerId);
});
$('#project-grid').addEventListener('pointermove', event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
  event.preventDefault(); drag.active = true; drag.card.classList.add('is-dragging'); document.body.classList.add('reordering');
  dragHint.hidden = false; dragHint.textContent = $('.card-open', drag.card).textContent;
  dragHint.style.left = `${Math.max(8, Math.min(event.clientX + 16, innerWidth - dragHint.offsetWidth - 8))}px`;
  dragHint.style.top = `${Math.max(8, Math.min(event.clientY + 16, innerHeight - dragHint.offsetHeight - 8))}px`;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.project-card');
  $$('.drop-before,.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
  drag.target = target && target !== drag.card ? target : null;
  if (drag.target) {
    const cards = $$('.project-card'); drag.target.classList.add(cards.indexOf(drag.card) < cards.indexOf(target) ? 'drop-after' : 'drop-before');
  }
  if (innerWidth < 1000) { if (event.clientY > innerHeight - 60) window.scrollBy(0, 20); else if (event.clientY < 60) window.scrollBy(0, -20); }
});
$('#project-grid').addEventListener('pointerup', event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const { card, target, active } = drag, destination = $$('.project-card').indexOf(target);
  if (active) suppressClickUntil = performance.now() + 300;
  clearDrag(); if (active && target) moveProject(card.dataset.id, destination);
});
$('#project-grid').addEventListener('pointercancel', clearDrag);
$('#project-grid').addEventListener('lostpointercapture', clearDrag);
$('#project-grid').addEventListener('click', event => {
  const handle = event.target.closest('.drag-handle'); if (!handle) return;
  if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
  if (!orderMenu.hidden && menuProject === handle.closest('.project-card').dataset.id) closeOrderMenu(); else openOrderMenu(handle);
});
$('#project-grid').addEventListener('keydown', event => {
  if (!event.target.matches('.drag-handle') || !event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); const card = event.target.closest('.project-card'), cards = $$('.project-card');
  moveProject(card.dataset.id, cards.indexOf(card) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1));
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (drag) { suppressClickUntil = performance.now() + 300; clearDrag(); event.preventDefault(); }
  if (!orderMenu.hidden) { closeOrderMenu(); const card = $$('.project-card').find(c => c.dataset.id === menuProject); if (card) $('.drag-handle', card).focus(); }
});
window.addEventListener('resize', () => { closeOrderMenu(); clearDrag(); });

$('#today').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
render();
