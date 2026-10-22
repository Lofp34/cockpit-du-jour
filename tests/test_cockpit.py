"""Vérifie la mosaïque et la compatibilité avec les données de la version initiale."""
import json
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
results = []
KEY = 'cockpit-du-jour.v1'
def passed(message):
    results.append(message)
    print('PASS', message, flush=True)
def geometry(page, expected):
    expect(page.locator('.project-card')).to_have_count(expected)
    page.wait_for_timeout(150)
    boxes = page.locator('.project-card').evaluate_all('(xs)=>xs.map(x=>{let r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}})')
    size = page.viewport_size
    assert all(b['x'] >= 0 and b['y'] >= 0 and b['right'] <= size['width']+1 and b['bottom'] <= size['height']+1 for b in boxes), boxes
    assert min(b['h'] for b in boxes) > 100, boxes
    assert abs(max(b['bottom'] for b in boxes) - page.locator('#project-grid').bounding_box()['y'] - page.locator('#project-grid').bounding_box()['height']) < 2
    areas = [b['w']*b['h'] for b in boxes]
    assert max(areas)/min(areas) < 1.025, areas
    assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 1')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

with sync_playwright() as pw:
    executable = os.environ.get('CHROMIUM_PATH')
    browser = pw.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
    context = browser.new_context(viewport={'width': 1920, 'height': 1080}, accept_downloads=True)
    page = context.new_page(); errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    response = page.goto(url, wait_until='networkidle'); assert response.status == 200
    geometry(page, 6)
    assert page.locator('.mosaic-row').count() == 2
    assert page.locator('.mosaic-row').first.locator('.project-card').count() == 3
    passed('Six panneaux ouverts en 3 × 2, surfaces égales, sans défilement global en 1920 × 1080')
    first = page.locator('.project-card').first; second = page.locator('.project-card').nth(1)
    notes = 'Décision : préparer l’entretien.\nDeuxième ligne : être précis. <img src=x onerror=alert(1)>'
    first.get_by_label('Notes persistantes').fill(notes)
    expect(first.get_by_label('Notes persistantes')).to_be_focused()
    second.get_by_label('Notes persistantes').fill('Note du deuxième projet, indépendante.')
    first.get_by_label('Prochaine action').fill('Préparer trois questions')
    first.get_by_label('Catégorie', exact=True).select_option('Commercial')
    first.get_by_label('Priorité').select_option('high')
    first.get_by_label('Échéance').fill('2026-11-02')
    first.get_by_label('Nouvelle étape', exact=True).fill('Valider le périmètre')
    first.get_by_role('button', name='Ajouter l’étape', exact=True).click()
    first.get_by_role('checkbox', name='Valider le périmètre').check()
    first.get_by_label('Nouvelle entrée au journal').fill('Entretien préparé.')
    first.get_by_role('button', name='Ajouter au journal', exact=True).click()
    first.get_by_label('Nouvelle entrée au journal').fill('Brouillon à conserver')
    page.reload(wait_until='networkidle')
    first=page.locator('.project-card').first; second=page.locator('.project-card').nth(1)
    expect(first.get_by_label('Notes persistantes')).to_have_value(notes)
    expect(second.get_by_label('Notes persistantes')).to_have_value('Note du deuxième projet, indépendante.')
    expect(first.get_by_label('Échéance')).to_have_value('2026-11-02')
    expect(first.get_by_role('checkbox', name='Valider le périmètre')).to_be_checked()
    expect(first.get_by_label('Nouvelle entrée au journal')).to_have_value('Brouillon à conserver')
    expect(first.locator('.pane-entries')).to_contain_text('Entretien préparé.')
    assert page.locator('.project-card img').count() == 0
    passed('Saisie directe indépendante, focus stable, notes/étapes/journal/brouillons persistants et HTML inerte')
    first.get_by_label('Statut', exact=True).select_option('done')
    expect(first.locator('.done-overlay')).to_be_visible()
    expect(first.get_by_role('button', name='Vaisala', exact=True)).to_be_visible()
    assert first.locator('.pane-scroll').evaluate('(e)=>e.inert')
    geometry(page, 6)
    page.reload(wait_until='networkidle')
    expect(page.locator('.project-card').first.locator('.done-overlay')).to_be_visible()
    page.locator('.project-card').first.get_by_role('button', name='Consulter la fiche').click()
    expect(page.locator('#project-notes')).to_have_value(notes)
    page.get_by_role('button', name='Fermer la fiche').click()
    page.locator('.project-card').first.get_by_role('button', name='Reprendre',exact=True).click()
    expect(page.locator('.project-card').first.locator('.done-overlay')).to_be_hidden()
    expect(page.locator('.project-card').first.get_by_label('Statut',exact=True)).to_have_value('active')
    passed('Terminé : voile sombre, coche, titre conservé, état durable, consultation et reprise sans perte')
    page.get_by_role('button', name='＋ Nouveau projet').click()
    page.locator('#project-title').fill('Essai éphémère')
    page.locator('#project-category').select_option('Personnel')
    page.get_by_role('button', name='Créer le projet',exact=True).click()
    geometry(page, 7)
    page.get_by_role('button', name='Agrandir Essai éphémère',exact=True).click()
    page.locator('#project-title').fill('Essai renommé')
    page.get_by_role('button', name='Fermer la fiche').click()
    page.locator('#search').fill('renomme'); expect(page.locator('.project-card')).to_have_count(1)
    page.locator('#search').fill(''); geometry(page, 7)
    page.locator('.project-card').first.get_by_label('Statut',exact=True).select_option('waiting')
    page.locator('[data-filter="waiting"]').click(); expect(page.locator('.project-card')).to_have_count(1)
    page.locator('[data-filter="all"]').click()
    passed('Création avec catégorie prédéfinie, renommage, filtres et recherche sans accents')
    page.locator('[data-view="journal"]').click()
    page.locator('#global-journal').fill('Bilan général : une avancée concrète.')
    page.locator('#global-journal-form').get_by_role('button', name='Ajouter au journal',exact=True).click()
    page.locator('#journal-list .journal-entry').first.get_by_role('button',name='Modifier',exact=True).click()
    page.locator('#edit-text').fill('Bilan corrigé : prêt pour demain.')
    page.locator('#edit-form').get_by_role('button',name='Enregistrer').click()
    expect(page.locator('#journal-list')).to_contain_text('Bilan corrigé')
    with tempfile.TemporaryDirectory() as tmp:
        with page.expect_download() as dl: page.locator('#export').click()
        path=Path(tmp)/'export.md'; dl.value.save_as(path); md=path.read_text()
        for term in ['Vaisala','Décision','- [x] Valider le périmètre','Bilan corrigé','Brouillon à conserver','2026-11-02','&lt;img']: assert term in md,term
        page.locator('.data-menu summary').click()
        with page.expect_download() as dl: page.locator('#backup').click()
        path=Path(tmp)/'backup.json'; dl.value.save_as(path); assert len(json.loads(path.read_text())['projects'])==7
        page.locator('.data-menu summary').click()
        page.locator('[data-view="projects"]').click()
        page.get_by_role('button',name='Agrandir Essai renommé',exact=True).click()
        page.locator('#delete-project').click();page.locator('#confirm-cancel').click()
        expect(page.locator('#project-dialog')).to_be_visible()
        page.locator('#delete-project').click();page.locator('#confirm-ok').click();geometry(page,6)
        page.locator('#import-file').set_input_files(str(path))
        with page.expect_download():page.locator('#confirm-ok').click()
        geometry(page,7);page.reload(wait_until='networkidle');geometry(page,7)
        bad=Path(tmp)/'bad.json';bad.write_text('{"version":999}')
        page.locator('#import-file').set_input_files(str(bad));expect(page.locator('#toast')).to_contain_text('Import refusé')
    passed('Journal général, édition, export Markdown intégral, sauvegarde/restauration et suppression confirmée')
    # Existing user data from the initial version, including a formerly free category.
    old={'version':1,'updatedAt':'2026-10-21T08:00:00Z','projects':[{'id':'legacy-project','title':'Ancien projet','category':'Conseil personnalisé','description':'Objectif conservé','next':'Suite conservée','notes':'Notes privées de test à conserver','status':'active','priority':'normal','due':'','createdAt':'2026-10-20T08:00:00Z','updatedAt':'2026-10-21T08:00:00Z','steps':[{'id':'legacy-step','text':'Étape ancienne','done':True}]}],'journal':[{'id':'legacy-entry','projectId':'legacy-project','projectTitle':'Ancien projet','text':'Historique conservé','createdAt':'2026-10-21T08:00:00Z','updatedAt':'2026-10-21T08:00:00Z'}],'drafts':{'legacy-project':'Brouillon ancien'}}
    legacy=browser.new_context(viewport={'width':1920,'height':1080});lp=legacy.new_page();lp.goto(url,wait_until='networkidle')
    lp.evaluate('(d)=>localStorage.setItem("cockpit-du-jour.v1",JSON.stringify(d))',old);lp.reload(wait_until='networkidle')
    panel=lp.locator('.project-card');expect(panel.get_by_label('Notes persistantes')).to_have_value('Notes privées de test à conserver')
    expect(panel.get_by_label('Catégorie',exact=True)).to_have_value('Conseil personnalisé')
    expect(panel.locator('.pane-entries')).to_contain_text('Historique conservé')
    expect(panel.get_by_label('Nouvelle entrée au journal')).to_have_value('Brouillon ancien')
    panel.get_by_label('Notes persistantes').fill('Notes privées de test à conserver + suite')
    lp.reload(wait_until='networkidle')
    stored=lp.evaluate('JSON.parse(localStorage.getItem("cockpit-du-jour.v1"))');assert stored['projects'][0]['category']=='Conseil personnalisé';assert stored['journal']==old['journal'];assert stored['drafts']==old['drafts']
    panel.get_by_label('Catégorie',exact=True).select_option('Formation')
    lp.reload(wait_until='networkidle');expect(panel.get_by_label('Catégorie',exact=True)).to_have_value('Formation')
    legacy.close();passed('Compatibilité v1 : anciennes notes, catégorie libre, étapes, historique et brouillons conservés')
    # Geometry is driven by real counts, including odd totals; changing fixtures is isolated from personal storage.
    base=page.evaluate('JSON.parse(localStorage.getItem("cockpit-du-jour.v1"))')
    for count in [1,2,3,4,5,6,7,8,9,11]:
        fixture=json.loads(json.dumps(base));fixture['projects']=[]
        for i in range(count):
            p=json.loads(json.dumps(base['projects'][i%len(base['projects'])]));p['id']=f'layout-{i}';p['steps']=[];fixture['projects'].append(p)
        fixture['journal']=[];fixture['drafts']={}
        page.evaluate('(d)=>localStorage.setItem("cockpit-du-jour.v1",JSON.stringify(d))',fixture);page.reload(wait_until='networkidle');geometry(page,count)
    passed('Répartition égale vérifiée avec 1, 2, 3, 4, 5, 6, 7, 8, 9 et 11 projets')
    page.evaluate('(d)=>localStorage.setItem("cockpit-du-jour.v1",JSON.stringify(d))',base);page.reload(wait_until='networkidle')
    page.set_viewport_size({'width':2560,'height':1440});geometry(page,7)
    page.set_viewport_size({'width':1920,'height':1080});geometry(page,7)
    passed('Recalcul de la mosaïque entre Full HD et 2560 × 1440')
    # Capture a separate demonstration context, never real user state.
    if os.environ.get('SCREENSHOT_DIR'):
        dest=Path(os.environ['SCREENSHOT_DIR']);dest.mkdir(parents=True,exist_ok=True)
        screenshot_context=browser.new_context(viewport={'width':2560,'height':1440});sp=screenshot_context.new_page();sp.goto(url,wait_until='networkidle');geometry(sp,6)
        sp.locator('.project-card').first.get_by_label('Notes persistantes').fill('Exemple : préciser les objectifs de l’entretien, puis préparer les questions.\n\nPoint à reprendre : les prochaines étapes à proposer.')
        sp.locator('.project-card').nth(3).get_by_label('Statut',exact=True).select_option('done')
        sp.screenshot(path=str(dest/'mosaïque-grand-écran.png'),full_page=True)
        screenshot_context.close()
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mp=mobile.new_page();mp.goto(url,wait_until='networkidle')
    expect(mp.locator('.project-card')).to_have_count(6);assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
    mp.locator('.project-card').first.get_by_label('Notes persistantes').fill('Note mobile vérifiée');mp.reload(wait_until='networkidle')
    expect(mp.locator('.project-card').first.get_by_label('Notes persistantes')).to_have_value('Note mobile vérifiée')
    mobile.close();passed('Mobile lisible, sans débordement horizontal, notes persistantes')
    # Stale tabs must not overwrite newer saved edits.
    peer=context.new_page();peer.goto(url,wait_until='networkidle')
    peer.locator('.project-card').first.get_by_label('Notes persistantes').fill('Modification depuis un autre onglet')
    expect(page.locator('#storage-error')).to_contain_text('autre onglet')
    page.locator('.project-card').first.get_by_label('Notes persistantes').fill('Changement obsolète')
    assert 'Modification depuis un autre onglet' == peer.evaluate('JSON.parse(localStorage.getItem("cockpit-du-jour.v1")).projects[0].notes')
    peer.close();passed('Conflit entre onglets détecté sans écraser les notes les plus récentes')
    page.evaluate('localStorage.setItem("cockpit-du-jour.v1","{broken")');page.reload(wait_until='networkidle')
    expect(page.locator('#storage-error')).to_be_visible();assert page.evaluate('localStorage.getItem("cockpit-du-jour.v1")')=='{broken'
    denied=browser.new_context();denied.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}")
    dp=denied.new_page();dp.goto(url,wait_until='networkidle');expect(dp.locator('#storage-error')).to_contain_text('échoué')
    with dp.expect_download():dp.locator('#export').click()
    denied.close();passed('Données corrompues protégées, stockage indisponible signalé, export de secours disponible')
    assert not errors,errors;passed('Aucune erreur JavaScript')
    browser.close()
print(json.dumps({'url':url,'passed':len(results),'checks':results},ensure_ascii=False,indent=2))
