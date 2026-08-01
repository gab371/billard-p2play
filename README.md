# 🎱 Billard 8-Ball - P2P Edition

[![Deploy to GitHub Pages](https://github.com/gab371/billard-p2play/actions/workflows/deploy.yml/badge.svg)](https://github.com/gab371/billard-p2play/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Billard 8-Ball P2Play** est un jeu de billard 8-pool multijoueur Peer-to-Peer standalone basé sur WebRTC et un moteur physique 2D, jouable directement dans votre navigateur sans serveur intermédiaire.

Affrontez vos amis en ligne dans une simulation de billard réaliste avec gestion des angles de tir, de la puissance, de la trajectoire de bille blanche et de la détection de fautes.

---

## 🎮 Démo en Ligne

Jouez directement sur votre navigateur sans aucune installation :
👉 **[Jouer à la démo en ligne](https://gab371.github.io/billard-p2play/)**

---

## ✨ Fonctionnalités Clés

- **Connexion P2P via [`p2play-core`](https://github.com/gab371/p2play-core)** (≥ v0.6.6) : PeerJS, lobby partagé, chat, présence, partage de lien de salon.
- **Physique 2D Complète** : Moteur de collision bille-bille et bille-bande sur tapis vert, calcul de trajectoire et de la ligne de visée.
- **Contrôles Intuitifs** : Visée à la souris/tactile, réglette de puissance de tir et placement manuel de la bille blanche (bille en main / ball in hand).
- **Gestion des Règles 8-Ball** : Attribution automatique des billes (pleines ou rayées), détection des fautes (bille blanche empochée, touche incorrecte, 8 noire avant terme).
- **Tchat & Historique en Direct** : Discussion P2P via `p2play-core/chat` avec journal des coups empochés et des fautes.
- **Hub P2Play** : Build lib montable dans [hub-p2play](https://github.com/gab371/hub-p2play).

---

## 🛠️ Lancement Local

### Prérequis
- **Node.js** (v20 ou supérieur recommandé)
- **npm**

### Instructions

1. **Cloner le projet** :
   ```bash
   git clone https://github.com/gab371/billard-p2play.git
   cd billard-p2play
   ```
2. **Installer les dépendances** :
   ```bash
   npm install
   ```
3. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```
4. **Ouvrir dans le navigateur** :
   Ouvrez `http://localhost:5173/` (ou le port indiqué par Vite).
   *Pour tester à deux sur la même machine, ouvrez un deuxième onglet ou un autre navigateur.*

5. **Compiler pour la production** :
   ```bash
   npm run build
   ```

---

## 🏛️ Architecture du Projet

Le projet suit des principes stricts de séparation des responsabilités pour garantir la testabilité et la maintenabilité :
- **`/src/core`** : Moteur physique et arbitre pur (vecteurs, collisions, déclenchement des coups, règles 8-ball) écrit en TypeScript pur, sans aucune dépendance UI ou réseau.
- **Réseau** : [`p2play-core`](https://github.com/gab371/p2play-core) (`usePeer`, `P2PlayLobby`, présence, chat) — pas de `PeerManager` local.
- **`/src/hooks`** : Custom hooks liant l'état de jeu réactif et les événements réseau au cycle de vie de React.
- **`/src/components`** : Composants d'interface (table Canvas HTML5 / SVG, queue de billard, modaux de victoire, tchat).

Dépendance typique :
```json
"p2play-core": "github:gab371/p2play-core#v0.6.6"
```

---

## 📄 Licence

Ce projet est distribué sous licence MIT.
