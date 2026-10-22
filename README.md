# Cockpit du jour

Application personnelle de suivi quotidien, en français, sans serveur applicatif ni dépendance externe. Reconstitution à partir du cahier des charges de la conversation ChatGPT « Créer cockpit projets ».

## Fonctionnalités

- Six projets initiaux : Vaisala, Training Creator Compagnons du Devoir, Training commercial vocal, Skills BMAD, Formation Septéo et Suivi Septéo Avocats.
- Création, modification et suppression de cartes ; statuts, priorités, échéances, objectifs et prochaine action.
- Notes enregistrées automatiquement, étapes à cocher, recherche et filtres.
- Journal général et par projet, avec modification et suppression des entrées. Les brouillons du journal sont conservés.
- Export intégral en Markdown : projets, notes, étapes, journal et brouillons.
- Sauvegarde JSON et restauration validée, avec confirmation et téléchargement de l’état précédent.
- Interface responsive, utilisation au clavier et respect de la préférence de réduction des animations.

Les objectifs et prochaines actions initiaux sont des suggestions à adapter ; aucun avancement, résultat, note d’apprenant ou échéance n’est prérempli.

## Données personnelles

Le site et son code sont publics. Les saisies sont conservées exclusivement dans le `localStorage` du navigateur, sous la clé `cockpit-du-jour.v1`. Aucun appel réseau applicatif, outil de suivi, police distante ou service tiers n’est utilisé. GitHub reçoit les requêtes normales de chargement du site.

Les notes ne sont **pas synchronisées** entre appareils, profils ou navigateurs. Effacer les données du site les supprime ; la navigation privée ne constitue pas un stockage durable. Utilisez « Sauvegarder en JSON » régulièrement, puis « Restaurer une sauvegarde » sur un autre appareil. L’export Markdown est destiné au bilan et au partage avec un agent ; la sauvegarde JSON permet une restauration exacte.

N’utilisez qu’un onglet pour modifier le cockpit. Si un autre onglet modifie les données, l’application suspend les écritures pour éviter un écrasement silencieux. Exportez au besoin puis rechargez la page. En cas de données locales illisibles, elles sont conservées et un avertissement explique comment reprendre.

Ce stockage local n’est pas chiffré. Toute personne ayant accès à votre profil navigateur peut consulter vos notes. L’application n’accède pas à ChatGPT, aux agents, au CRM ou à leurs données.

## Exécution locale

```sh
python3 -m http.server 4173 --directory docs
```

Ouvrir `http://localhost:4173`. Les données de cette adresse sont distinctes de celles du site GitHub Pages.

## Publication

GitHub Pages publie le dossier `docs` de la branche `main`. Il n’y a aucune compilation : `index.html`, `style.css`, `app.js` et `favicon.svg` constituent l’application. Les liens relatifs permettent une publication sous `/cockpit-du-jour/`.

## Vérification

Le scénario `tests/test_cockpit.py` utilise Python et Playwright avec Chromium. Il vérifie la création, les modifications, les notes après rechargement, les étapes, le journal, la recherche, les exports, la restauration, les erreurs de stockage, la protection des saisies HTML et la mise en page mobile.

```sh
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
python3 -m http.server 4173 --directory docs
# Dans un second terminal :
.venv/bin/python tests/test_cockpit.py http://localhost:4173
```

Pour tester le site publié, passer son URL à la place de l’adresse locale. Les tests utilisent un contexte de navigateur isolé ; aucune note du navigateur personnel n’est modifiée.
