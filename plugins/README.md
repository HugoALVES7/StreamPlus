# Plugins

Dépose ici un plugin, sous forme de **fichier `.zip`** ou de dossier, puis recompile (`./build.sh`). Le build affiche `Plugin: <nom>` pour chaque plugin pris en compte. Le contenu de ce dossier n'est pas versionné, sauf ce README.

## Format d'un plugin

```
mon-plugin.zip
  plugin.properties        name=…, description=…, class=com.exemple.MonPlugin (facultatif)
  src/…/*.java             code Android, compilé avec l'app
  web/*.js                 scripts chargés après app.js (les autres fichiers de web/ sont servis à côté)
  player/*.js              scripts ajoutés dans la page du lecteur Twitch intégré (dialogue avec l'app par postMessage)
  manifest.xml             éléments ajoutés dans <application> du manifeste (services…), noms de classe complets
```

La classe indiquée dans `class=` implémente `com.hugo.streamplus.Plugin`. Elle est créée au démarrage, avant le chargement de l'interface :

```java
public class MonPlugin implements Plugin {
    @Override public void attach(Activity activity, WebView web) {
        web.addJavascriptInterface(this, "MonPlugin");   // accessible depuis web/*.js
    }
    @Override public void detach() { }
}
```

## Événements de l'interface (`window.StreamPlus`)

| Appel | Quand / quoi |
|---|---|
| `StreamPlus.on('ready', ({login}) => …)` | l'app a démarré (`login` : première chaîne épinglée, sinon le compte) |
| `StreamPlus.on('channel-videos', (login, tab) => …)` | les rediffusions d'une chaîne s'affichent (`tab` : `archive` ou `highlight`) |
| `StreamPlus.on('channel-open', login => …)` | la page d'une chaîne ou son menu d'options s'ouvre |
| `StreamPlus.followHandler = async (login, 'follow' \| 'unfollow') => …` | fait « Suivre / Ne plus suivre » (sans plugin : QR code vers Twitch) ; l'app vérifie ensuite le résultat auprès de Twitch |
| `StreamPlus.progress({ "<id de vidéo>": pourcentage })` | affiche une barre de progression sur les miniatures de ces rediffusions, et la lecture reprend à cet endroit |

Un plugin s'exécute avec les mêmes droits que l'app : n'installe que des plugins dont tu connais l'auteur, et respecte les conditions d'utilisation des services auxquels ils accèdent.
