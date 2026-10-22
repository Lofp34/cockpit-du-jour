# Cockpit du jour

Application personnelle de suivi quotidien, en français, sans serveur applicatif ni dépendance externe. Reconstitution à partir du cahier des charges de la conversation ChatGPT « Créer cockpit projets ».

## Mosaïque pour grand écran

Tous les projets sont ouverts et modifiables directement. À partir de 1000 pixels de largeur, la mosaïque occupe la fenêtre disponible : six projets forment trois colonnes et deux rangées sur un écran large. L’agencement se recalcule selon la taille de la fenêtre et le nombre de projets visibles. Les panneaux ont la même surface, y compris pour des nombres impairs. Les contenus longs défilent dans leur propre panneau ; le tableau ne défile pas globalement. Un bouton permet de passer en plein écran.

Chaque panneau expose le nom, la catégorie, le statut, la prochaine action, les notes, les étapes, le journal, l’objectif, la priorité et l’échéance. Un clic sur le titre permet de le modifier directement. Entrée valide, Échap annule la modification en cours. La flèche ouvre une fiche agrandie, notamment pour supprimer un projet.

Un projet terminé reste à sa place : son contenu reçoit un voile sombre et une grande coche verte. Son nom et son statut restent visibles. « Reprendre » le remet en cours ; « Consulter la fiche » ouvre son contenu sans changer le statut.

Les catégories prédéfinies sont Commercial, Formation, Application, Méthode & outils, Suivi & accompagnement, Administration, Personnel et Autre. Une ancienne catégorie personnalisée est conservée jusqu’au choix d’une catégorie de la liste.

Sur mobile et sur les fenêtres de moins de 1000 pixels, les panneaux s’empilent pour conserver des champs lisibles.

## Déplacer et renommer les cartes

- Faire glisser la poignée à six points en haut à gauche d’une carte vers sa nouvelle position. Le contour bleu indique la destination ; Échap ou un dépôt hors des cartes annule le déplacement.
- Un clic sur la poignée permet aussi de choisir une position : début, fin, une place avant ou après. Au clavier, placer le focus sur la poignée et utiliser Alt + flèche gauche/droite (ou haut/bas).
- Cliquer sur le titre pour l’éditer directement. Les titres vides sont refusés ; les caractères français sont conservés. La touche Échap restaure le titre du début de la modification.
- L’ordre et les titres sont enregistrés automatiquement dans le navigateur et inclus dans les exports et les sauvegardes JSON.
- Quand un filtre ou une recherche est actif, seuls les projets visibles changent d’ordre. Les projets masqués gardent leur position dans la liste complète.
- Les cartes terminées restent déplaçables et renommables.

## Fonctionnalités

- Six projets initiaux : Vaisala, Training Creator Compagnons du Devoir, Training commercial vocal, Skills BMAD, Formation Septéo et Suivi Septéo Avocats.
- Création, modification et suppression de cartes ouvertes ; statuts, priorités, échéances, objectifs et prochaine action.
- Saisie directe des notes enregistrées automatiquement, étapes à cocher, recherche et filtres.
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

La version mosaïque conserve la clé et le format de stockage de la version initiale. Les anciennes sauvegardes JSON restent compatibles ; aucun nettoyage ni remplacement des notes n’est effectué à la mise à jour.

## Publication

GitHub Pages publie le dossier `docs` de la branche `main`. Il n’y a aucune compilation : `index.html`, `style.css`, `app.js` et `favicon.svg` constituent l’application. Les liens relatifs permettent une publication sous `/cockpit-du-jour/`.

## Vérification

Le scénario `tests/test_cockpit.py` utilise Python et Playwright avec Chromium. Il vérifie la répartition à surfaces égales pour 1 à 11 projets, les dimensions Full HD et 2560 × 1440, la saisie directe sans perte de focus, la conservation des données de la version initiale, les catégories prédéfinies, le voile de fin de projet et la reprise, ainsi que les notes, étapes, journaux, exports, restaurations, conflits entre onglets, erreurs de stockage et l’affichage mobile.

```sh
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
python3 -m http.server 4173 --directory docs
# Dans un second terminal :
.venv/bin/python tests/test_cockpit.py http://localhost:4173
```

Pour tester le site publié, passer son URL à la place de l’adresse locale. Les tests utilisent un contexte de navigateur isolé ; aucune note du navigateur personnel n’est modifiée.

Le scénario complémentaire `tests/test_ordering.py` vérifie les gestes réels souris/tactiles, les commandes clavier, le renommage direct, les filtres et la conservation de l’ordre dans les sauvegardes. Il prend la même URL en argument que le scénario principal.
