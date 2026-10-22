const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const KEY = 'cockpit-du-jour.v1';
const STATUS = { active: 'En cours', waiting: 'En attente', done: 'Terminé' };
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
].map(([title, category, description, next]) => ({ id: uid(), title, category, description, next, status: 'active', priority: 'normal', due: '', notes: '', steps: [], createdAt: now(), updatedAt: now() })), journal: [], drafts: {} });
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
    return { id: id(p.id), title: string(p.title, 160), category: string(p.category, 60), description: string(p.description, 10000), next: string(p.next, 500), notes: string(p.notes), status: p.status, priority: p.priority, due, createdAt: p.createdAt, updatedAt: p.updatedAt, steps: p.steps.map(s => { if (!s || typeof s.done !== 'boolean') throw Error('Étape invalide.'); return { id: id(s.id), text: string(s.text, 500), done: s.done }; }) };
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
  $('#stat-active').textContent = state.projects.filter(p => p.status === 'active').length;
  $('#stat-steps').textContent = state.projects.reduce((n, p) => n + p.steps.filter(s => s.done).length, 0);
  $('#stat-journal').textContent = state.journal.filter(j => day(new Date(j.createdAt)) === day()).length;
  $('#nav-count').textContent = state.projects.length; $('#project-count').textContent = String(state.projects.length).padStart(2, '0');
  $('#project-grid').innerHTML = projects.map(p => {
    const completed = p.steps.filter(s => s.done).length;
    return `<article class="project-card"><div class="card-top"><span class="project-icon" aria-hidden="true">${e(p.title.charAt(0))}</span><span class="badge ${p.status}">${STATUS[p.status]}</span></div><div class="card-category">${e(p.category || 'Projet personnel')}</div><h3><button class="card-open" data-open="${e(p.id)}">${e(p.title)}</button></h3><p class="card-description">${e(p.description || 'Ajoutez un objectif pour garder le cap.')}</p><div class="card-next"><span>Prochaine action</span>${e(p.next || 'À définir dans la fiche projet')}</div><div class="card-progress"><div class="progress-label"><span>${completed} / ${p.steps.length} étapes</span><span>${p.steps.length ? Math.round(completed / p.steps.length * 100) : 0} %</span></div><div class="progress-track"><progress aria-label="Progression de ${e(p.title)}" max="${p.steps.length || 1}" value="${completed}"></progress></div></div><div class="card-bottom"><span class="${p.priority === 'high' ? 'high' : ''}">${p.priority === 'high' ? '● Priorité haute' : p.due ? 'Échéance : ' + e(new Intl.DateTimeFormat('fr-FR').format(new Date(p.due + 'T12:00:00'))) : 'Priorité ' + PRIORITY[p.priority].toLowerCase()}</span><span class="card-arrow" aria-hidden="true">↗</span></div></article>`;
  }).join('');
  $('#empty-projects').hidden = projects.length !== 0;
  const oldProject = $('#journal-project').value;
  $('#journal-project').innerHTML = '<option value="">Journal général</option>' + state.projects.map(p => `<option value="${e(p.id)}">${e(p.title)}</option>`).join('');
  if (state.projects.some(p => p.id === oldProject)) $('#journal-project').value = oldProject;
  renderJournal($('#journal-list'), state.journal);
}
function renderJournal(container, entries) {
  container.innerHTML = entries.length ? [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(j => `<article class="journal-entry"><time datetime="${e(j.createdAt)}">${e(dateLabel(j.createdAt))}</time><span class="entry-project">${e(state.projects.find(p => p.id === j.projectId)?.title || j.projectTitle || 'Journal général')}</span><p>${e(j.text)}</p><div class="entry-actions"><button class="text-button" data-edit-entry="${e(j.id)}">Modifier</button><button class="text-button danger" data-delete-entry="${e(j.id)}">Supprimer</button></div></article>`).join('') : '<p class="empty">Le journal attend votre première avancée.</p>';
}
function renderDetails() {
  const p = selected(); if (!p) return;
  const n = p.steps.filter(s => s.done).length; $('#step-count').textContent = `${n} / ${p.steps.length} terminées`;
  $('#steps').innerHTML = p.steps.map(s => `<li><label><input type="checkbox" data-step="${e(s.id)}" ${s.done ? 'checked' : ''}><span>${e(s.text)}</span></label><button type="button" data-delete-step="${e(s.id)}" aria-label="Supprimer l’étape ${e(s.text)}">×</button></li>`).join('');
  renderJournal($('#project-journal-list'), state.journal.filter(j => j.projectId === p.id));
}
const fields = ['title', 'category', 'status', 'priority', 'due', 'description', 'next', 'notes'];
function openProject(id = null) {
  selectedId = id; const p = selected(); $('#project-form').reset();
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
  p.updatedAt = now(); $('#dialog-title').textContent = p.title; save(); render();
});
$('#project-form').addEventListener('submit', event => {
  event.preventDefault(); if (selected()) return;
  const title = $('#project-title').value.trim(); if (!title) { $('#project-title').setCustomValidity('Saisissez un nom de projet.'); $('#project-title').reportValidity(); return; }
  const p = { id: uid(), steps: [], createdAt: now(), updatedAt: now() }; for (const f of fields) p[f] = $('#project-' + f).value; p.title = title;
  state.projects.push(p); const saved = save(); $('#project-dialog').close(); filter = 'all'; $$('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter)); $('#search').value = ''; render(); openProject(p.id); toast(saved ? 'Projet créé et enregistré.' : 'Projet créé ; exportez-le pour le conserver.');
});
$('#project-title').addEventListener('input', () => { if ($('#project-title').value.trim()) $('#project-title').setCustomValidity(''); });
$('#close-project').onclick = () => $('#project-dialog').close();
$('#new-project').onclick = () => openProject();
$('#project-grid').onclick = event => { const button = event.target.closest('[data-open]'); if (button) openProject(button.dataset.open); };
$('#search').addEventListener('input', render);
$$('.filter').forEach(button => button.onclick = () => { filter = button.dataset.filter; $$('.filter').forEach(b => b.classList.toggle('active', b === button)); render(); });
$$('[data-view]').forEach(button => button.onclick = () => {
  view = button.dataset.view; $$('[data-view]').forEach(b => b.classList.toggle('active', b === button)); $('#projects-view').hidden = view !== 'projects'; $('#journal-view').hidden = view !== 'journal'; $('#page-title').textContent = view === 'projects' ? 'Cockpit du jour.' : 'Journal de bord.'; $('#page-subtitle').textContent = view === 'projects' ? 'Gardez le fil. Faites avancer ce qui compte.' : 'Les petites avancées font les grandes journées.'; render();
});
$('#step-form').onsubmit = event => { event.preventDefault(); const text = $('#step-text').value.trim(), p = selected(); if (!text || !p) return; p.steps.push({ id: uid(), text, done: false }); p.updatedAt = now(); save(); $('#step-text').value = ''; renderDetails(); render(); $('#step-text').focus(); };
$('#steps').onchange = event => { const p = selected(), step = p?.steps.find(s => s.id === event.target.dataset.step); if (!step) return; step.done = event.target.checked; p.updatedAt = now(); save(); renderDetails(); render(); };
let confirmAction;
function confirm(message, action) { $('#confirm-message').textContent = message; confirmAction = action; $('#confirm-dialog').showModal(); $('#confirm-cancel').focus(); }
$('#confirm-cancel').onclick = () => $('#confirm-dialog').close();
$('#confirm-ok').onclick = () => { $('#confirm-dialog').close(); confirmAction?.(); confirmAction = null; };
$('#steps').onclick = event => { const button = event.target.closest('[data-delete-step]'); if (!button) return; const p = selected(); confirm('Supprimer cette étape ?', () => { p.steps = p.steps.filter(s => s.id !== button.dataset.deleteStep); p.updatedAt = now(); save(); renderDetails(); render(); }); };
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
    lines.push(`### ${md(p.title)}`, '', `- **Catégorie :** ${md(p.category)}`, `- **Statut :** ${STATUS[p.status]}`, `- **Priorité :** ${PRIORITY[p.priority]}`, `- **Échéance :** ${p.due || 'Non définie'}`, `- **Créé le :** ${dateLabel(p.createdAt)}`, `- **Mis à jour le :** ${dateLabel(p.updatedAt)}`, '', '**Objectif**', '', md(p.description) || 'À compléter.', '', '**Prochaine action**', '', md(p.next) || 'À définir.', '', '**Étapes**', '', ...(p.steps.length ? p.steps.map(s => `- [${s.done ? 'x' : ' '}] ${md(s.text).replace(/\n/g, '\n  ')}`) : ['Aucune étape définie.']), '', '**Notes**', '', md(p.notes) || 'Aucune note.', '');
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
  try { if (file.size > 15000000) throw Error('Le fichier dépasse 15 Mo.'); const imported = validate(JSON.parse(await file.text())); confirm(`Restaurer ${imported.projects.length} projets et ${imported.journal.length} entrées ? Les données actuelles seront remplacées. Une sauvegarde de l’état actuel sera téléchargée avant le remplacement.`, () => { download(JSON.stringify(state, null, 2), `cockpit-avant-restauration-${Date.now()}.json`, 'application/json'); state = imported; const saved = save(true); $('#global-journal').value = state.drafts.global || ''; render(); toast(saved ? 'Sauvegarde restaurée.' : 'Restauration en mémoire uniquement : exportez avant de quitter.'); }); }
  catch (error) { toast('Import refusé : ' + error.message); }
  event.target.value = '';
};
$('#today').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
render();
