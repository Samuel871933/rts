# MacroGod

Jeu de stratégie temps réel inspiré de League of Legends : le joueur ne contrôle pas un champion mais **manage les 5**
(assignation des lanes, jungle, objectifs, vision, rappels). Toute la micro (auto-attaques, sorts, last-hit) est gérée par l'IA.

## Démarrer

```bash
npm install
npm run dev        # API sur :3001 + client Vite sur http://localhost:5173
```

Aucune base à installer : SQLite par défaut (`apps/server/data/macrogod.sqlite`, créé au démarrage).
Pour MySQL / MariaDB, copier `apps/server/.env.example` en `apps/server/.env` et passer `DB_DIALECT=mysql`.

Autres scripts : `npm run typecheck`, `npm test` (simulation headless), `npm run build`.

## Architecture

```
packages/shared   Simulation pure et déterministe (aucune dépendance navigateur) + données de jeu
  src/data/         Carte, tours, sbires, monstres, champions, objets, règles LoL
                    terrain.generated.ts : murs / chemins / rivière / bases généré depuis
                    mapGeometry.ts (npm run build:terrain -w @macrogod/shared), notre propre carte
                    ("the Spire", thème rétro-futuriste)
  src/sim/          Game (pas fixe 20 ticks/s de jeu), systèmes (vagues, combat, IA champions, vision…)
apps/server       API Express + Sequelize (comptes JWT, catalogue champions, parties)
apps/client       React + Vite (pages) et PixiJS (rendu de la partie)
  src/game/core     GameSession : boucle, vitesse, sélection, snapshot HUD
  src/game/render   Caméra + calques Pixi (carte, unités, brouillard, effets, overlay)
  src/game/input    Souris / clavier → sélection, ordres, caméra
  src/game/hud      Interface React par-dessus le canvas
```

La simulation ne connaît que des **ordres** (`lane`, `jungle`, `move`, `attack`, `camp`, `attackMove`, `ward`, `recall`, `idle`).
Elle tourne aujourd'hui dans le navigateur ; le même code pourra tourner côté serveur pour le multijoueur.
Une seed + la liste des ordres suffisent à rejouer une partie à l'identique.

## Sauvegarde et temps réel

Une partie suit une **horloge murale** stockée en base (`matches.clock` : tick d'ancrage, heure, vitesse, pause) :
elle avance même page fermée. Chaque ordre / changement de comportement est envoyé immédiatement au serveur
avec son tick (`match_commands`). Au rechargement, le client rejoue seed + commandes jusqu'au tick attendu
(`CommandReplay`, ~150 ms par minute de jeu) puis reprend en direct.

Le serveur fait aussi tourner chaque partie en cours (`apps/server/src/services/matchRunner.ts`), avec 5 s
de retard sur l'horloge pour laisser arriver les ordres : une partie continue et **se termine sans page ouverte**
(statut, durée et stats enregistrés). Au redémarrage de l'API, les parties en cours sont reconstruites par rejeu.
**Le résultat fait foi côté serveur** : le client ne peut qu'abandonner ; l'horloge (où en est la partie) est
calculée par le serveur, le client ne fixe que vitesse et pause.

## Sécurité

- JWT HS256 avec émetteur / audience vérifiés ; `JWT_SECRET` obligatoire en production (en dev, généré une
  fois dans `apps/server/data/jwt-secret`).
- Limites de débit : connexion, inscription, actions en jeu (`express-rate-limit`) ; en-têtes `helmet`.
- Commandes : uniquement pour ses propres champions, ticks cohérents avec l'horloge, positions dans la carte,
  20 000 max par partie ; 3 parties en cours max par joueur.

| Route | Rôle |
| --- | --- |
| `GET /matches/:id/log` | horloge + journal des commandes + heure serveur |
| `POST /matches/:id/commands` | ajoute `{ tick, command }` (ticks croissants) |
| `PUT /matches/:id/clock` | démarrage, vitesse, pause (ré-ancre l'horloge à l'heure serveur) |

## Temps

Les valeurs LoL sont conservées en secondes de jeu (vagues toutes les 30 s dès 0:30, dragon à 5:00, Nashor à 20:00,
rappel 8 s, timers de mort du wiki…). Le jeu tourne **x3 plus vite que le temps réel** par défaut
(`DEFAULT_TIME_SCALE` dans `packages/shared/src/constants.ts`), ajustable en jeu (pause, x1, x2, x3, x5).

## Commandes en jeu

| Action | Commande |
| --- | --- |
| Sélection | clic, glisser, `1`-`5`, `Tab` = tous |
| Déplacer / attaquer | clic droit (sol / cible) ; un camp de jungle se cible même dans le brouillard (vide → « action suivante ») |
| Glisser depuis un champion | relâcher sur une cible = attaquer, sur un allié = escorter, ailleurs = se déplacer (toute la sélection si le champion en fait partie) |
| Menu rapide (radial) | champion sélectionné + clic gauche n'importe où (sol : aller, attaque-dépl., balise, tenir la lane ; unité : attaquer, assiéger, escorter…), clic droit sur un allié ; `Échap` ferme puis désélectionne |
| Assigner une lane / la jungle | `Z` top, `X` mid, `C` bot, `J` jungle |
| Attaque-déplacement / balise | `A` / `W` puis clic gauche |
| Rappel, stop | `B`, `S` (aussi dans la barre d'actions à gauche de la carte) |
| Comportement (barre du bas, sélection ou toute l'équipe) | `R` repli auto (rappel une fois sous 25 % PV, les ordres suivants priment), `L` retour en lane après rappel / mort (OFF = attend à la base), `G` farm auto (OFF = n'agit que sur ordre ; ON = farme son poste et y retourne 15 s après le dernier ordre, compte à rebours sur la carte du champion), `T` sécurité tour (quitte une tour ennemie dès qu'il n'y a plus de sbires pour encaisser) |
| Pause | `P` |
| Réglages | roue crantée en haut à droite : touches personnalisables (enregistrées sur le compte), Quitter (la partie continue) ou Abandonner (défaite), avec confirmation |

Les lettres ci-dessus sont les touches par défaut ; `1`-`5`, `Tab` et `Échap` sont fixes.

## Simplifications du MVP

- Adversaires tirés au sort, joués par la même IA que les champions sans ordre (ils farment, ne se battent pas d'eux-mêmes).
- Les champions n'engagent jamais un champion adverse sans ordre ; ils ripostent seulement s'ils sont frappés (`RULES.championRetaliationWindow`).
- Un monstre par camp (les petits monstres sont fusionnés dans les PV du camp). Comme sur LoL, il ne quitte jamais sa zone de camp et se réinitialise si sa cible s'en va ou reste hors d'atteinte 4 s ; les sbires ne combattent et ne poursuivent que dans leur voie.
- Une compétence auto-lancée par champion, objets achetés automatiquement à la fontaine selon un build par archétype.
- Les murs ne bloquent pas la vision ; pas de buissons ni de balises de contrôle.
- Icônes des champions et objets : Data Dragon (Riot), en attendant nos propres champions.
# rts
