"""Real mouse/touch gestures and persistence, in an isolated browser profile."""
import json
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173'
results=[]
def passed(text):
    results.append(text);print('PASS',text,flush=True)
def ids(page):return page.locator('.project-card').evaluate_all('(cards)=>cards.map(c=>c.dataset.id)')
def card(page,id):return page.locator(f'.project-card[data-id="{id}"]')
def drag(page,source,target):
    a=card(page,source).locator('.drag-handle').bounding_box();b=card(page,target).bounding_box()
    page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2);page.mouse.down()
    page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2,steps=12);page.mouse.up()
with sync_playwright() as pw:
    opts={'headless':True}
    if os.environ.get('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
    browser=pw.chromium.launch(**opts);ctx=browser.new_context(viewport={'width':1920,'height':1080},accept_downloads=True);page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url,wait_until='networkidle')
    initial=ids(page);first=initial[0]
    card(page,first).get_by_label('Notes persistantes').fill('Note à conserver pendant le déplacement.')
    card(page,first).get_by_label('Nouvelle entrée au journal').fill('Brouillon lié au projet, pas à sa position.')
    drag(page,first,initial[2]);expected=[initial[1],initial[2],first,*initial[3:]]
    assert ids(page)==expected,ids(page)
    expect(card(page,first).get_by_label('Notes persistantes')).to_have_value('Note à conserver pendant le déplacement.')
    expect(card(page,first).get_by_label('Nouvelle entrée au journal')).to_have_value('Brouillon lié au projet, pas à sa position.')
    page.reload(wait_until='networkidle');assert ids(page)==expected
    drag(page,first,initial[-1]);assert ids(page)==[initial[1],initial[2],*initial[3:],first]
    drag(page,first,initial[1]);assert ids(page)==initial
    passed('Glisser-déposer réel dans les deux sens, entre rangées ; ordre, notes et brouillons conservés')
    # Drop outside the board and Escape both cancel.
    h=card(page,first).locator('.drag-handle').bounding_box();page.mouse.move(h['x']+10,h['y']+10);page.mouse.down();page.mouse.move(10,10,steps=10);page.mouse.up();assert ids(page)==initial
    h=card(page,first).locator('.drag-handle').bounding_box();t=card(page,initial[2]).bounding_box();page.mouse.move(h['x']+10,h['y']+10);page.mouse.down();page.mouse.move(t['x']+50,t['y']+150,steps=10);page.keyboard.press('Escape');page.mouse.up();assert ids(page)==initial
    passed('Annulation du déplacement par Échap ou dépôt hors du tableau')
    page.wait_for_timeout(350)
    card(page,first).locator('.drag-handle').click();page.get_by_role('button',name='Placer à la fin',exact=True).click();assert ids(page)[-1]==first
    handle=card(page,first).locator('.drag-handle');expect(handle).to_be_focused();handle.press('Alt+ArrowLeft');assert ids(page)[-2]==first
    handle.press('Enter');page.get_by_role('button',name='Placer au début',exact=True).click();assert ids(page)==initial
    passed('Commandes de position au clic et au clavier, focus conservé après déplacement')
    # In a filter, reorder only visible slots.
    card(page,initial[0]).get_by_label('Statut',exact=True).select_option('waiting');card(page,initial[2]).get_by_label('Statut',exact=True).select_option('waiting')
    page.locator('[data-filter="waiting"]').click();assert ids(page)==[initial[0],initial[2]]
    drag(page,initial[2],initial[0]);assert ids(page)==[initial[2],initial[0]]
    page.locator('[data-filter="all"]').click();expected=[initial[2],initial[1],initial[0],*initial[3:]];assert ids(page)==expected
    passed('Réorganisation filtrée : les projets masqués gardent leur position')
    # Completed projects can still move and be renamed.
    card(page,first).get_by_label('Statut',exact=True).select_option('done')
    drag(page,first,initial[-1]);expect(card(page,first).locator('.done-overlay')).to_be_visible()
    p=card(page,first);p.locator('.card-open').click();editor=p.get_by_role('textbox',name='Titre du projet',exact=True)
    editor.fill('Vaisala — préparation été <b>test</b>');expect(editor).to_be_focused();editor.press('Enter')
    expect(p.get_by_role('button',name='Vaisala — préparation été <b>test</b>',exact=True)).to_be_visible();assert p.locator('h2 b').count()==0
    page.reload(wait_until='networkidle');p=card(page,first);expect(p.locator('.card-open')).to_have_text('Vaisala — préparation été <b>test</b>')
    p.locator('.card-open').click();p.locator('.title-editor').fill('');p.locator('.title-editor').press('Enter');expect(p.locator('.title-editor')).to_be_visible();p.locator('.title-editor').press('Tab');expect(p.locator('.card-open')).to_have_text('Vaisala — préparation été <b>test</b>')
    p.locator('.card-open').click();p.locator('.title-editor').fill('Modification annulée');p.locator('.title-editor').press('Escape');expect(p.locator('.card-open')).to_have_text('Vaisala — préparation été <b>test</b>')
    p.locator('.card-open').click();p.locator('.title-editor').fill('Vaisala — titre final');p.locator('.title-editor').press('Tab')
    expect(p.get_by_role('button',name='Agrandir Vaisala — titre final',exact=True)).to_be_visible()
    passed('Renommage direct et durable, y compris terminé ; titres vides refusés, Échap annule, HTML inerte')
    page.locator('#search').fill('titre final');assert ids(page)==[first];page.locator('#search').fill('')
    before_backup=ids(page)
    with tempfile.TemporaryDirectory() as tmp:
        with page.expect_download() as dl:page.locator('#export').click()
        path=Path(tmp)/'export.md';dl.value.save_as(path);md=path.read_text();assert 'Vaisala — titre final' in md
        page.locator('.data-menu summary').click()
        with page.expect_download() as dl:page.locator('#backup').click()
        path=Path(tmp)/'backup.json';dl.value.save_as(path);saved=json.loads(path.read_text());assert [p['id'] for p in saved['projects']]==before_backup
        page.locator('.data-menu summary').click();drag(page,first,before_backup[0]);assert ids(page)!=before_backup
        page.locator('#import-file').set_input_files(str(path))
        with page.expect_download():page.locator('#confirm-ok').click()
        assert ids(page)==before_backup
    passed('Recherche, export Markdown et sauvegarde/restauration reprennent titres et ordre choisis')
    # Real touch input through Chromium (not synthetic DOM events).
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mp=mobile.new_page();mp.goto(url,wait_until='networkidle');mi=ids(mp)
    mp.locator('.project-card').first.locator('.drag-handle').tap();mp.get_by_role('button',name='Placer à la fin',exact=True).tap();assert ids(mp)[-1]==mi[0]
    mp.locator('.project-card').first.locator('.card-open').tap();mp.locator('.title-editor:visible').fill('Titre mobile');mp.locator('.title-editor:visible').press('Enter');mp.reload(wait_until='networkidle');expect(mp.locator('.project-card').first.locator('.card-open')).to_have_text('Titre mobile')
    # Two cards visible enough for an actual touch drag after viewport expansion.
    mp.set_viewport_size({'width':900,'height':1600});mp.reload(wait_until='networkidle')
    before=ids(mp);a=mp.locator('.project-card').first.locator('.drag-handle').bounding_box();b=mp.locator('.project-card').nth(1).bounding_box();cdp=mobile.new_cdp_session(mp)
    x,y=a['x']+15,a['y']+15;tx,ty=b['x']+b['width']/2,b['y']+100
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for i in range(1,13):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+(tx-x)*i/12,'y':y+(ty-y)*i/12}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert ids(mp)[:2]==[before[1],before[0]],ids(mp)
    passed('Mobile : menu tactile, renommage et glisser-déposer tactile réel')
    assert not errors,errors;passed('Aucune erreur JavaScript')
    browser.close()
print(json.dumps({'url':url,'passed':len(results),'checks':results},ensure_ascii=False,indent=2))
