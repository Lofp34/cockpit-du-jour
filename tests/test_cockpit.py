"""Tests fonctionnels dans un profil isolé. Ne lit pas les données personnelles."""
import json
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
results = []
def passed(message):
    results.append(message)
    print('PASS', message, flush=True)

with sync_playwright() as pw:
    executable = os.environ.get('CHROMIUM_PATH')
    browser = pw.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
    context = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    response = page.goto(url, wait_until='networkidle')
    assert response.status == 200
    expect(page.locator('.project-card')).to_have_count(6)
    expect(page.get_by_role('button', name='Vaisala', exact=True)).to_be_visible()
    passed('Six projets initiaux et chargement HTTP 200')
    if os.environ.get('SCREENSHOT_DIR'):
        dest = Path(os.environ['SCREENSHOT_DIR']); dest.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(dest/'cockpit-desktop.png'), full_page=True)
    page.get_by_role('button', name='Vaisala', exact=True).click()
    notes = 'Décision : préparer l’entretien. Échéance à confirmer.\nDeuxième ligne : être précis. <img src=x onerror=alert(1)>'
    page.locator('#project-notes').fill(notes)
    page.locator('#project-next').fill('Relire le brief et préparer trois questions')
    page.locator('#project-status').select_option('waiting')
    page.locator('#project-priority').select_option('high')
    page.locator('#project-due').fill('2026-11-02')
    page.locator('#step-text').fill('Valider le périmètre')
    page.locator('#step-form').get_by_role('button', name='Ajouter', exact=True).click()
    page.get_by_role('checkbox', name='Valider le périmètre').check()
    page.locator('#project-journal').fill('Entretien préparé, décision à confirmer.')
    page.get_by_role('button', name='Ajouter au journal du projet').click()
    page.locator('#project-journal').fill('Brouillon à conserver')
    page.reload(wait_until='networkidle')
    page.get_by_role('button', name='Vaisala', exact=True).click()
    expect(page.locator('#project-notes')).to_have_value(notes)
    expect(page.locator('#project-status')).to_have_value('waiting')
    expect(page.get_by_role('checkbox', name='Valider le périmètre')).to_be_checked()
    expect(page.locator('#project-journal')).to_have_value('Brouillon à conserver')
    expect(page.locator('#project-journal-list')).to_contain_text('Entretien préparé')
    assert page.locator('#project-dialog img').count() == 0
    passed('Notes, statut, échéance, étapes, journal et brouillon persistent après rechargement ; saisies HTML inertes')
    page.get_by_role('button', name='Fermer la fiche').click()
    page.get_by_role('button', name='＋ Nouveau projet').click()
    page.locator('#project-title').fill('Essai éphémère')
    page.locator('#project-category').fill('Vérification')
    page.locator('#project-description').fill('Vérifier la création')
    page.get_by_role('button', name='Créer le projet', exact=True).click()
    page.locator('#project-title').fill('Essai renommé')
    page.get_by_role('button', name='Fermer la fiche').click()
    expect(page.locator('.project-card')).to_have_count(7)
    page.locator('#search').fill('renomme')
    expect(page.locator('.project-card')).to_have_count(1)
    page.locator('#search').fill('')
    page.locator('[data-filter="waiting"]').click()
    expect(page.locator('.project-card')).to_have_count(1)
    page.locator('[data-filter="all"]').click()
    passed('Création, renommage, recherche sans accents et filtrage')
    page.locator('[data-view="journal"]').click()
    page.locator('#global-journal').fill('Bilan général : une avancée concrète.')
    page.locator('#global-journal-form').get_by_role('button', name='Ajouter au journal', exact=True).click()
    first_entry = page.locator('#journal-list .journal-entry').first
    first_entry.get_by_role('button', name='Modifier').click()
    page.locator('#edit-text').fill('Bilan corrigé : prêt pour demain.\nDécision documentée.')
    page.locator('#edit-form').get_by_role('button', name='Enregistrer').click()
    expect(page.locator('#journal-list')).to_contain_text('Bilan corrigé')
    passed('Journal général et modification des entrées')
    with tempfile.TemporaryDirectory() as tmp:
        with page.expect_download() as dl:
            page.locator('#export').click()
        md_path = Path(tmp)/'export.md'; dl.value.save_as(md_path)
        markdown = md_path.read_text()
        for needle in ['Vaisala', 'Notes', 'Décision', '- [x] Valider le périmètre', 'Bilan corrigé', 'Brouillon à conserver', '2026-11-02', '&lt;img']:
            assert needle in markdown, needle
        with page.expect_download() as dl:
            page.locator('#backup').click()
        backup = Path(tmp)/'backup.json'; dl.value.save_as(backup)
        data = json.loads(backup.read_text()); assert len(data['projects']) == 7
        passed('Export Markdown complet et sauvegarde JSON valide')
        page.locator('[data-view="projects"]').click()
        page.get_by_role('button', name='Essai renommé', exact=True).click()
        page.locator('#delete-project').click()
        page.locator('#confirm-cancel').click()
        expect(page.locator('#project-dialog')).to_be_visible()
        page.locator('#delete-project').click(); page.locator('#confirm-ok').click()
        expect(page.locator('.project-card')).to_have_count(6)
        page.locator('#import-file').set_input_files(str(backup))
        expect(page.locator('#confirm-dialog')).to_be_visible()
        with page.expect_download():
            page.locator('#confirm-ok').click()
        expect(page.locator('.project-card')).to_have_count(7)
        page.reload(wait_until='networkidle')
        expect(page.locator('.project-card')).to_have_count(7)
        bad = Path(tmp)/'bad.json'; bad.write_text('{"version": 999, "projects": []}')
        page.locator('#import-file').set_input_files(str(bad))
        expect(page.locator('#toast')).to_contain_text('Import refusé')
        expect(page.locator('.project-card')).to_have_count(7)
        passed('Suppression confirmée, restauration persistante et rejet des imports invalides')
    # A separate profile demonstrates that no private state is served by the site.
    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mp = mobile.new_page(); mp.goto(url, wait_until='networkidle')
    expect(mp.locator('.project-card')).to_have_count(6)
    assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
    if os.environ.get('SCREENSHOT_DIR'):
        mp.screenshot(path=str(dest/'cockpit-mobile.png'), full_page=True)
    mp.get_by_role('button', name='Vaisala', exact=True).click()
    expect(mp.locator('#project-notes')).to_have_value('')
    mp.locator('#project-notes').fill('Note mobile vérifiée')
    mp.get_by_role('button', name='Fermer la fiche').click()
    mp.reload(wait_until='networkidle'); mp.get_by_role('button', name='Vaisala', exact=True).click()
    expect(mp.locator('#project-notes')).to_have_value('Note mobile vérifiée')
    passed('Mobile 390 px sans débordement, notes persistantes et isolation des profils')
    mobile.close()
    # Corrupt state must never be silently overwritten by initial projects.
    page.evaluate("localStorage.setItem('cockpit-du-jour.v1', '{broken')")
    page.reload(wait_until='networkidle')
    expect(page.locator('#storage-error')).to_be_visible()
    assert page.evaluate("localStorage.getItem('cockpit-du-jour.v1')") == '{broken'
    passed('Données corrompues conservées avec avertissement')
    denied = browser.new_context()
    denied.add_init_script("Storage.prototype.setItem = function() { throw new DOMException('Full', 'QuotaExceededError'); };")
    dp = denied.new_page(); dp.goto(url, wait_until='networkidle')
    expect(dp.locator('#storage-error')).to_contain_text('échoué')
    with dp.expect_download(): dp.locator('#export').click()
    passed('Stockage indisponible signalé ; export de secours disponible')
    denied.close()
    assert not errors, errors
    passed('Aucune erreur JavaScript')
    browser.close()
print(json.dumps({'url': url, 'passed': len(results), 'checks': results}, ensure_ascii=False, indent=2))
