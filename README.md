# Stream+ pour Google TV

Client **non officiel** pour regarder Twitch sur Google TV, avec une interface proche de Twitch sur PC adaptée à la télécommande, dans le style Liquid Glass de Hume Launcher+.

> Stream+ n'est ni affilié à Twitch Interactive, Inc. ni approuvé ou soutenu par elle. « Twitch » et ses logos sont des marques de Twitch Interactive, Inc. ; ils ne sont cités ici que pour dire avec quel service l'app fonctionne. Les vidéos passent par le lecteur intégré officiel de Twitch, et les données par l'API officielle Helix, avec ton propre Client ID.

- **Accueil** : en haut, l'heure de mise à jour et un bouton « Actualiser la page ». La page se met aussi à jour seule toutes les 5 minutes, sauf pendant une vidéo ou un menu. Elle est reconstruite en coulisse puis échangée, donc la carte sélectionnée et la position dans la page ne bougent pas.
- **Parcourir** : onglets Suivies en live, Suivies hors ligne, Top France, Top monde et Catégories, chacun sans limite (chargement au fil de la descente) ; le dernier onglet ouvert est retenu.
- **Interface** : barre latérale glass (Accueil, Parcourir, Rechercher, Multistream, Épinglés, PiP, Paramètres) avec les chaînes épinglées et leur statut live, un hero, des rangées de lives, catégories et suivis.
- **Rediffusions sans limite** : sur la page d'une chaîne, les onglets Rediffusions, Temps forts et Clips se chargent page après page tant que tu descends.
- **Progression des rediffusions** : une barre rouge sous chaque miniature montre où tu t'es arrêté dans l'app, et la rediff reprend à cet endroit. Un plugin peut y ajouter la progression d'autres sources (voir [plugins/](plugins/README.md)). Dans le lecteur, une grande barre de progression se pilote avec ◀▶. Les passages dont Twitch a coupé le son (droits d'auteur, `muted_segments` de l'API) y sont en rouge, et l'avis « son coupé » du lecteur se ferme tout seul.
- **Contenu pour public averti** : quand Twitch affiche son avertissement, l'app te demande dans une fenêtre à elle : « Commencer à regarder » ou « Quitter le stream / la rediffusion ». Rien n'est validé à ta place.
- **Multistream de 1 à 4 lives**, choisis dans une liste qui reste ouverte (« Terminé » pour lancer) ; le live que tu regardais y est seulement proposé, jamais ajouté d'office :
  - 2 streams : un en haut, un en bas, chacun en 16:9 ;
  - 3 streams : deux en haut (gauche et droite), un centré en bas ;
  - 4 streams : un par coin.

  Chaque stream a sa barre de mixage : muet, 🎧 solo, plein écran, retirer, et un curseur de volume réglé avec ◀ ▶. La qualité est plafonnée (480p par défaut) pour rester fluide.
- **Chat des lives** : le chat s'affiche dans une colonne à droite de la vidéo (bouton 💬 Chat pour l'afficher ou le masquer). Par défaut c'est le **chat rapide** : il se connecte au serveur de chat officiel de Twitch, avec une seule connexion pour tous les streams du multistream, donc changer de chat est instantané (lecture seule). Paramètres → Chat → « Complet » remet le chat intégré de Twitch, connecté à ton compte, pour écrire, mais il met 20 à 30 s à charger. En multistream, la colonne affiche le chat du stream choisi avec son bouton 💬. Il ne peut pas se superposer à la vidéo, car Twitch met en pause tout lecteur recouvert. Les rediffusions n'ont pas de chat : Twitch ne propose pas de replay du chat en intégration officielle.
- **Rediffusions en multistream** : dans « Choisis tes streams », la rangée « Chaînes · choisir une rediffusion » (épinglés, suivis, recherche, y compris hors ligne) ouvre la chaîne. Tu y choisis une rediffusion, ajoutée avec un badge REDIFF ; sa position de lecture est mémorisée.
- **Vitesse des rediffusions** : bouton 1× dans le lecteur et dans chaque mixeur multistream, de 0,75× à 3×. L'API du lecteur Twitch ne donne pas accès à la vitesse : l'app ajoute à la page du lecteur, uniquement chez toi, un petit script qui la règle (`Web.java`, `SPEED_HOOK`), comme une extension de navigateur.
- **Suivre une chaîne** : la page de chaque chaîne indique si tu la suis (« ♥ Suivi », « Ne plus suivre » en rouge une fois sélectionné). L'API de Twitch ne permet plus aux apps de suivre une chaîne : le bouton affiche un QR code qui ouvre la chaîne sur Twitch, pour la suivre depuis ton téléphone, puis l'app relit l'état. Un plugin peut le faire directement dans l'app.
- **Profils** : chaque profil a son compte Twitch, ses épinglés, son multistream, ses réglages et sa connexion au lecteur twitch.tv. L'app s'ouvre sur le dernier profil utilisé. Pour changer de profil : l'avatar en haut de la barre latérale (ou Paramètres → Profils) ouvre « Qui regarde ? ». Tu peux y ajouter un profil, puis le connecter à un autre compte Twitch, ou en supprimer un (touche Menu sur sa vignette).
- **Réglages du lecteur (⚙)** : qualité (Source par défaut, Auto ou un plafond 720p/480p…, mémorisée) et faible latence pour les lives (activée par défaut ; l'app la règle dans le lecteur Twitch via `lowLatencyModeEnabled`).
- **Picture in Picture** : une fenêtre flottante reste au-dessus de toutes les apps, y compris Hume. Son menu s'ouvre depuis la tuile **Stream+ PiP**, l'entrée PiP de la barre latérale ou un bouton de la télécommande au choix (Paramètres → Touche du menu PiP, via un service d'accessibilité qui ne lit que les touches). On y règle le son, la pause, la qualité (Auto 720p max, 1080p ou moins) et la faible latence, et on peut aussi déplacer la fenêtre, changer sa taille, revenir en plein écran ou la fermer. Le bouton Accueil pendant un live bascule automatiquement en PiP (réglable).
- **Épingles** : épingle une chaîne depuis sa page, le lecteur ou le menu d'une carte (touche Menu). Elles apparaissent dans la barre latérale avec leur statut live. CH+ / CH− dans le lecteur passe d'un épinglé en direct à l'autre.

## Comment ça marche

| Partie | Technique |
|---|---|
| Lecture | Lecteur **embed officiel** de Twitch (un par stream, volume indépendant via son API JS) |
| Données | **API Helix officielle** (lives, catégories, recherche, VODs, clips, chaînes suivies) |
| Connexion | Device Code Flow : un code s'affiche sur la TV et tu le valides sur twitch.tv/activate |
| UI | Web app (`assets/web`) servie depuis une origine locale sécurisée dans une WebView plein écran |
| PiP | `PipService` : fenêtre overlay (`TYPE_APPLICATION_OVERLAY`) jamais focusable, avec un service au premier plan |

**Contrainte Twitch :** l'embed se met en pause dès qu'un élément le recouvre. Aucun contrôle ne se superpose donc à la vidéo : quand on appuie sur OK, la vidéo se réduit et les panneaux glass se placent autour (« squeeze », comme sur tvOS). En multistream, chaque vidéo rétrécit dans sa case et son mixeur passe en dessous. Si Twitch exige un clic pour lancer la lecture avec le son, l'app envoie un vrai tap au centre du lecteur (sur le bouton lecture). Le bouton ☝ fait la même chose à la main.

**Données et sécurité :** tout reste sur la TV. Le jeton de ton compte Twitch, la session twitch.tv du lecteur et le Client Secret de chaque profil sont chiffrés (AES-256-GCM) avec une clé du Keystore Android, qui ne peut pas être extraite de la TV. L'app ne parle qu'à Twitch.

## Configuration (une seule fois)

1. Va sur <https://dev.twitch.tv/console/apps/create> (l'écran d'accueil de l'app affiche un QR code).
2. Renseigne :
   - Nom : `StreamPlus TV` (Twitch refuse les noms contenant « Twitch » ou un « + »)
   - URL de redirection : `http://localhost`
   - Catégorie : `Application Integration`
   - **Type de client : Public**
3. Copie le **Client ID**, puis, au choix :
   - copie `config.example.json` en `config.json`, colle l'ID et recompile (`config.json` est ignoré par git) ;
   - ou saisis-le sur la TV (Accueil → « Saisir le Client ID »).
4. Sur la TV, choisis **Se connecter avec Twitch**, puis valide le code sur ton téléphone.

5. Pour les **rediffusions réservées aux abonnés** et les avantages de tes subs (dont l'absence de pub), va dans **Paramètres → Connecter le lecteur à twitch.tv** et connecte-toi sur la vraie page de Twitch. Ton mot de passe est envoyé uniquement à Twitch. Sans ça, le lecteur ne sait pas que tu es abonné.

Option : un Client Secret (dans `config.json` ou les Paramètres) permet de naviguer sans se connecter, mais sans les chaînes suivies.

## Build et installation

Même chaîne d'outils que Hume Launcher+ : SDK Android (build-tools 34, android-34) et JDK 17, sans Gradle ni bibliothèque.

```bash
./build.sh                                # → build/streamplus.apk
TV=192.168.1.20:5555 ./build.sh install   # build + install sur la TV + autorisation overlay + lancement
```

`TV` est l'adresse de ta TV pour adb : active le débogage réseau dans les options pour les développeurs de Google TV. L'autorisation « afficher par-dessus les autres apps » est cachée sur Google TV ; `build.sh install` la donne via `adb shell appops set com.hugo.streamplus SYSTEM_ALERT_WINDOW allow`.

## Plugins

Des fonctions en plus peuvent être ajoutées sans toucher au code : dépose le fichier `.zip` d'un plugin dans [`plugins/`](plugins/README.md) et recompile. Le format et les événements disponibles y sont décrits.

## Personnaliser son build (dossier `personal/`)

Si un dossier `personal/` existe à la racine, `build.sh` s'en sert pour **ton** APK. Il est dans `.gitignore` : il n'est jamais publié. Tout y est facultatif :

```
personal/
  build.env                  variables du build, par exemple :
                               PACKAGE=com.exemple.monapp   (id Android de l'app, défaut com.hugo.streamplus)
                               APK=monapp.apk               (nom du fichier produit)
                               TV="${TV:-192.168.1.20:5555}" (ta TV par défaut)
  res/values/strings.xml     nom affiché : <string name="app_name">…</string> et <string name="pip_name">…</string>
  res/drawable-nodpi/
    banner.png               tuile de l'app sur l'écran d'accueil de la TV, 640×360
    banner_pip.png           tuile « PiP », 640×360
    icon.png                 icône, 256×256
  web/
    personal.css             CSS ajouté à l'interface (chargé après app.css)
                             ex. logo de la barre latérale :
                             #side .logo .mk { background: url(mon_logo.svg) center / 50px no-repeat !important; box-shadow: none !important; }
                             #side .logo .mk svg { display: none; }
    mon_logo.svg             tout fichier ici est servi à côté de index.html
  AndroidManifest.xml        remplace le manifeste (rarement utile)
  plugins/                   tes plugins à toi, comme dans plugins/
```

Tu peux y mettre tes propres logos, y compris des logos Twitch modifiés **pour ton usage strictement personnel**. Les marques de Twitch ne doivent ni être modifiées ni servir de logo à une app tierce : ne publie et ne partage jamais un APK, une capture ou un dépôt qui les contient.

## Télécommande

| Où | Touche | Action |
|---|---|---|
| Partout | ◀ ▲ ▶ ▼ / OK | Naviguer / valider |
| Partout | **OK maintenu** (ou Menu) sur une carte | Options : regarder, PiP, multistream, chaîne, rediffusions, clips, catégorie, épingler, suivre / ne plus suivre |
| Partout | Retour | Revenir |
| Lecteur | OK | Afficher les contrôles |
| Lecteur | ◀ ▶ (contrôles masqués, rediffusion) | −10 s / +10 s |
| Lecteur | ⏯ | Lecture / pause |
| Lecteur | CH+ / CH− | Épinglé suivant / précédent |
| Curseur de volume | OK | Passer en mode réglage (le curseur devient violet), puis ◀ ▶ = −5 % / +5 % ; OK, Retour, ▲ ou ▼ pour en sortir |

## Fichiers

```
AndroidManifest.xml
build.sh
src/com/hugo/streamplus/
  MainActivity.java        hôte WebView, touches, cycle de vie (PiP auto sur Accueil)
  Web.java                 réglages WebView et service des assets en https local
  Bridge.java              window.Native : HTTP, QR, PiP, taps, maintien de l'écran allumé
  PipService.java          lecteur flottant overlay
  PipControlActivity.java  panneau glass du PiP (pause, volume, qualité, faible latence, position, taille)
  PipKeyService.java       bouton de télécommande qui ouvre le menu du PiP (accessibilité, processus à part)
  LoginActivity.java       page de connexion twitch.tv du lecteur
  Plugin.java              interface des plugins (plugins/)
src/io/nayuki/qrcodegen/   générateur de QR codes (MIT, Project Nayuki)
assets/web/
  index.html, app.css, app.js   l'application
  pip.html                      page du lecteur flottant
res/values/strings.xml     nom de l'app
plugins/README.md          format des plugins
tools/gen_art.swift        génère la bannière et l'icône par défaut
assets/web/fonts/          police Inter (SIL Open Font License, voir Inter-LICENSE.txt)
```

## Licence

[MIT](LICENSE) © 2026 Hugo Alves. Composants tiers : générateur de QR codes de Project Nayuki (MIT) et police Inter (SIL Open Font License). « Twitch » est une marque de Twitch Interactive, Inc. ; ce projet n'est ni affilié à Twitch ni approuvé par elle.
