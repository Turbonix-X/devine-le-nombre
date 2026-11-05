# Devine le Nombre

Bob, le petit robot du jeu, choisit un nombre entre les deux que tu donnes (jusqu'à 1 000 000 000). À toi de le trouver, avec un thermomètre qui va de 0 kelvin à 10 000 degrés.

**Jouer en ligne : https://turbonix-x.github.io/devine-le-nombre/**

Ça marche sur ordi, tablette et téléphone, et il n'y a rien à installer.

## Ce qu'on peut faire

### Les réponses de Bob

- **Chaleur** : un thermomètre animé et plein de températures, de 0 K (−273,15 °C) quand tu es hyper loin à 9 999 °C juste à côté, et 10 000 °C quand c'est le bon nombre.
- **Plus / moins** : de grandes flèches qui disent si c'est plus haut ou plus bas.
- **Les deux** en même temps.

Une barre montre à chaque essai le plus petit et le plus grand nombre encore possibles, et elle se resserre (avec un zoom quand il reste très peu de nombres).

### Les modes

- **Classique** : autant d'essais que tu veux.
- **Essais limités** : tu choisis ton nombre d'essais, qui compte aussi dans le score.
- **Chiffre interdit** : tu choisis combien de chiffres interdits sont cachés dans l'intervalle. Si tu tombes dessus, c'est perdu. Une option les montre sur la barre.
- **Contre la montre** : tu choisis une durée et tu dois trouver avant la fin.
- **Indices** : Bob ne donne que des indices sur le nombre, de plus en plus précis.

### Les indices bonus

À activer avant la partie, en choisissant combien tu en veux (1 seul par tranche de 3 essais en mode Essais limités). Chaque indice utilisé enlève 10 % au score.

### Le score

Il dépend de l'écart entre les deux nombres, du nombre d'essais et du mode. Le détail s'affiche à la fin de chaque partie.

### Les grands messages

Trouver du premier coup déclenche un message spécial : au-dessus de 10 000 nombres, à partir de 1 million, et le plus grand de tous sur 1 milliard.

### L'historique

Pour chaque partie : le mode, l'intervalle, le nombre d'essais et tous les nombres essayés. Avec des statistiques et le meilleur score par mode.

### Le reste

- Mode clair et mode sombre.
- Sons et vibrations (sur téléphone), qu'on peut couper en haut de la page.
- Tout est sauvegardé automatiquement dans le navigateur. Un bouton permet de tout effacer (il demande confirmation avant).
- On peut télécharger sa sauvegarde dans un fichier et la recharger plus tard.
- **Lien de partage** : le bouton 🔗 crée un lien avec tes réglages.

## Utiliser le site chez soi

Télécharger le dossier et ouvrir `index.html` dans un navigateur, c'est tout.

## Comment c'est fait

Du HTML, du CSS et du JavaScript, sans framework.

- Les sons sont générés avec la Web Audio API, sans fichier audio.
- Le hasard vient de `crypto.getRandomValues`.
- La neige, les braises, les éclairs et les feux d'artifice sont dessinés dans des `<canvas>`.

| Fichier | Contenu |
|---|---|
| `index.html` | La page |
| `style.css` | Le style propre au jeu |
| `js/app.js` | L'interface, le déroulement des parties, la sauvegarde, le partage |
| `js/game.js` | Les températures, la barre, le score et les indices |
| `js/fx.js` | Les effets visuels |
| `js/sound.js` | Les sons et les vibrations |
| `logo.svg` | Le logo Turbonix |
| `turbonix.css` | Le style commun des sites Turbonix |
| `STYLE-TURBONIX.md` | Le guide de style Turbonix |

---

Turbonix Entertainment
