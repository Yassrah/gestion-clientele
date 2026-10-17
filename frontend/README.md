# Gestion Clientèle — Frontend (React + Vite)

Interface web pour l'API de gestion de clientèle (backend Express + PostgreSQL).

## Prérequis

- Node.js 18+
- Le **backend** doit être démarré (voir `../backend`). Il tourne sur `http://localhost:5000`.

## Installation

```bash
npm install
```

## Démarrage

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173`.

Un **proxy Vite** redirige automatiquement les appels `/api` vers `http://localhost:5000`,
il n'est donc pas nécessaire de gérer le CORS.

## Build de production

```bash
npm run build
npm run preview
```

## Fonctionnalités

- **Tableau de bord** : compteurs par entité
- **Abonnés** : CRUD + recherche
- **Contrats** : CRUD (avec sélection de l'abonné)
- **Compteurs** : CRUD (avec sélection du contrat)
- **Relevés** : CRUD + consommation calculée automatiquement + recherche des relevés d'un abonné par nom (avec calcul du montant)
- **Tarifs** : CRUD

## Structure

```
frontend/
├── src/
│   ├── components/    # Layout, Modal, Alert
│   ├── pages/         # Dashboard, Abonnes, Contrats, Compteurs, Releves, Tarifs
│   ├── services/      # api.js + services par entité
│   ├── utils/         # formatage (dates, montants, badges)
│   ├── App.jsx        # routage
│   ├── main.jsx       # point d'entrée
│   └── index.css      # styles globaux
├── index.html
└── vite.config.js     # config + proxy /api
```
