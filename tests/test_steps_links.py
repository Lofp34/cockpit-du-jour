"""Column placement, step order and safe conversation links in an isolated profile."""
import json
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
KEY = 'cockpit-du-jour.v1'

def stored(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)

def texts(card):
    return card.locator('.pane-steps li label span').all_text_contents()

with sync_playwright() as pw:
    options = {'headless': True}
    if os.environ.get('CHROMIUM_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = pw.chromium.launch(**options)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    card = page.locator('.project-card').first
    left, right = card.locator('.writing-column'), card.locator('.tracking-column')
    for label in ['Prochaine action', 'Notes persistantes', 'Nouvelle entrée au journal']:
        expect(left.get_by_role('textbox', name=label, exact=True)).to_be_visible()
    expect(left.locator('.pane-journal')).to_be_visible()
    expect(right.get_by_label('Agent ou conversation', exact=True)).to_be_visible()
    expect(right.get_by_label('Nouvelle étape', exact=True)).to_be_visible()
    assert right.locator('.pane-journal, .next-label, .notes-section').count() == 0
    assert left.bounding_box()['x'] < right.bounding_box()['x']
    assert abs(left.bounding_box()['y'] - right.bounding_box()['y']) < 2
    print('PASS Disposition en deux colonnes : rédaction à gauche, conversation et étapes à droite', flush=True)

    left.get_by_label('Notes persistantes').fill('Décision à préserver — été.')
    left.get_by_label('Nouvelle entrée au journal').fill('Brouillon conservé.')
    for text in ['Préparer', 'Vérifier', 'Étape ajoutée']:
        right.get_by_label('Nouvelle étape', exact=True).fill(text)
        right.get_by_role('button', name='Ajouter l’étape', exact=True).click()
    card.locator('.pane-steps input').nth(2).check()
    step_ids = [s['id'] for s in stored(page)['projects'][0]['steps']]
    right.get_by_role('button', name='Monter l’étape Étape ajoutée', exact=True).click()
    assert texts(card) == ['Préparer', 'Étape ajoutée', 'Vérifier']
    expect(right.get_by_role('button', name='Monter l’étape Étape ajoutée', exact=True)).to_be_focused()
    page.keyboard.press('Enter')
    assert texts(card) == ['Étape ajoutée', 'Préparer', 'Vérifier']
    expect(right.get_by_role('button', name='Monter l’étape Étape ajoutée', exact=True)).to_be_disabled()
    expect(right.get_by_role('button', name='Descendre l’étape Étape ajoutée', exact=True)).to_be_focused()
    page.keyboard.press('Enter')
    assert texts(card) == ['Préparer', 'Étape ajoutée', 'Vérifier']
    after = stored(page)['projects'][0]['steps']
    assert [s['id'] for s in after] == [step_ids[0], step_ids[2], step_ids[1]] and after[1]['done']
    page.reload(wait_until='networkidle')
    assert texts(card) == ['Préparer', 'Étape ajoutée', 'Vérifier']
    expect(left.get_by_label('Notes persistantes')).to_have_value('Décision à préserver — été.')
    expect(left.get_by_label('Nouvelle entrée au journal')).to_have_value('Brouillon conservé.')
    print('PASS Étapes montées et descendues à la souris et au clavier ; identifiants, cases et textes conservés au rechargement', flush=True)

    link_input = right.get_by_label('Agent ou conversation', exact=True)
    link = right.locator('.conversation-link')
    expect(link).to_be_hidden()
    for invalid in ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'pas une adresse', 'https://user:secret@example.com/']:
        link_input.fill(invalid)
        expect(link).to_be_hidden()
        assert link.get_attribute('href') is None
        expect(link_input).to_have_attribute('aria-invalid', 'true')
    target = 'https://chatgpt.com/c/test-cockpit?mode=suivi&lang=fr'
    link_input.fill(target)
    expect(link).to_have_attribute('href', target)
    expect(link).to_have_attribute('rel', 'noopener noreferrer')
    context.route('https://chatgpt.com/**', lambda route: route.fulfill(status=200, content_type='text/html', body='<h1>Conversation de test</h1>'))
    with context.expect_page() as opened:
        link.click()
    popup = opened.value
    popup.wait_for_load_state()
    assert popup.url == target
    assert popup.evaluate('window.opener === null')
    popup.close()
    page.reload(wait_until='networkidle')
    expect(link_input).to_have_value(target)
    expect(link).to_have_attribute('href', target)
    print('PASS Lien modifiable, enregistré, ouvert dans un nouvel onglet ; adresses non sûres désactivées', flush=True)

    card.locator('.expand-button').click()
    dialog = page.locator('#project-dialog')
    dialog.get_by_role('button', name='Descendre l’étape Étape ajoutée', exact=True).click()
    expect(dialog.locator('#steps label span').last).to_have_text('Étape ajoutée')
    dialog.locator('#project-conversationUrl').fill(target + '#fiche')
    dialog.get_by_role('button', name='Fermer la fiche', exact=True).click()
    assert texts(card) == ['Préparer', 'Vérifier', 'Étape ajoutée']
    expect(link).to_have_attribute('href', target + '#fiche')
    print('PASS Fiche agrandie : réorganisation des étapes et modification du lien répercutées dans la carte', flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        with page.expect_download() as download:
            page.locator('#export').click()
        mdpath = Path(tmp) / 'export.md'
        download.value.save_as(mdpath)
        md = mdpath.read_text()
        assert target.replace('&', '&amp;') + r'\#fiche' in md
        assert md.index('- [ ] Préparer') < md.index('- [ ] Vérifier') < md.index('- [x] Étape ajoutée')
        page.locator('.data-menu summary').click()
        with page.expect_download() as download:
            page.locator('#backup').click()
        backup = Path(tmp) / 'backup.json'
        download.value.save_as(backup)
        before = json.loads(backup.read_text())
        assert before['projects'][0]['conversationUrl'] == target + '#fiche'
        page.locator('#import-file').set_input_files(backup)
        page.locator('#confirm-ok').click()
        assert stored(page)['projects'] == before['projects']
        page.reload(wait_until='networkidle')
        assert texts(card) == ['Préparer', 'Vérifier', 'Étape ajoutée']
        expect(link_input).to_have_value(target + '#fiche')
    print('PASS Exports Markdown et JSON, restauration et rechargement : ordre et lien conservés', flush=True)

    for width, height in [(2560, 1440), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        expect(right.get_by_label('Nouvelle étape', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    right.get_by_role('button', name='Monter l’étape Étape ajoutée', exact=True).click()
    assert texts(card) == ['Préparer', 'Étape ajoutée', 'Vérifier']
    print('PASS Grand écran et mobile : absence de débordement horizontal, étapes réordonnables', flush=True)
    page.set_viewport_size({'width': 1920, 'height': 1080})
    if os.environ.get('SCREENSHOT_PATH'):
        page.reload(wait_until='networkidle')
        page.screenshot(path=os.environ['SCREENSHOT_PATH'])
    assert not errors, errors
    print('PASS Aucune erreur JavaScript', flush=True)
    browser.close()
