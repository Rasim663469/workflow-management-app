# Projet AWI - Festival Management

Ce projet est une application de gestion de festival, composée d'un frontend Angular, d'un backend Node.js/Express (TypeScript) et d'une base de données PostgreSQL.

## Structure du projet

*   **frontend/** : Application Angular (Client)
*   **backend/** : API REST Express/Node.js (Serveur)
*   **scripts/** : Scripts utilitaires pour le lancement (Docker)
*   **docker-compose.yml** : Configuration DB seule

## Prérequis

*   [Node.js](https://nodejs.org/) (LTS)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/)
*   **mkcert** (pour HTTPS local) :
    1.  `mkcert -install`
    2.  `cd backend && mkdir certs && cd certs && mkcert localhost`

## Méthode 1 : Lancement Automatique (Docker Full Stack)

C'est la méthode recommandée pour faire tourner rapidement l'ensemble du projet sans installation manuelle des dépendances locales.

### Démarrage
Utilisez le script fourni à la racine :
```bash
./scripts/dev-up.sh
```
Ce script lance **Frontend**, **Backend**, **Base de données** et **Adminer** via Docker.

### Accès
*   **Frontend** : [https://localhost:8080](https://localhost:8080)
*   **Backend** : [https://localhost:4000](https://localhost:4000)
*   **Adminer** : [http://localhost:8082](http://localhost:8082)

### Arrêt
Pour tout arrêter et nettoyer les conteneurs :
```bash
./scripts/dev-down.sh
```

---

## Méthode 2 : Lancement Manuel (Développement)

Utilisez cette méthode si vous souhaitez modifier le code et voir les changements en direct (Hot Reload).

### 1. Base de données
Lancez uniquement la base de données via Docker :
```bash
docker-compose up -d
```

### 2. Backend
Démarrez le serveur API en mode "watch" :
```bash
cd backend
npm install
npm run dev
```
Accessible sur **https://localhost:4000**.

### 3. Frontend
Démarrez l'application Angular :
```bash
cd frontend
npm install
npm start
```
Accessible sur **https://localhost:4200**.

> **Note** : En mode manuel, le frontend est sur le port **4200** (par défaut Angular), alors qu'en Docker (Méthode 1), il est exposé sur le port **8080**.


## Initialisation des données

Une fois la base de données lancée (via la Méthode 1 ou 2), vous devez importer les données initiales (jeux, éditeurs, mécanismes) :

```bash
./scripts/import-editeurs-jeux.sh
```
> **Note** : Ce script nécessite que le conteneur de base de données (`secureapp_db_prod`) soit en cours d'exécution.

## Accès Base de Données (Adminer)

*   **Interface Base de données (Adminer)** : [http://localhost:8082](http://localhost:8082)
    *   Système : PostgreSQL
    *   Serveur : db
    *   Utilisateur : secureapp
    *   Mot de passe : secureapp
    *   Base de données : secureapp

## Comptes utilisateurs par défaut

Le serveur initialise automatiquement les comptes suivants au démarrage :

| Rôle | Login | Mot de passe | Description |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `admin` | Accès complet, gestion des utilisateurs on peut créer les autres rôles |
| **Super Organisateur** | `superorg` | `superorg` | Accès étendu organisation |
| **Organisateur** | `organisateur` | `organisateur` | Gestion standard |
| **Bénévole** | `benevole` | `benevole` | Accès limité |