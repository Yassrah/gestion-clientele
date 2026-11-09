# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Customer-management app for a utility (water/electricity billing): subscribers (`abonne`), contracts (`contrat`), meters (`compteur`), meter readings (`releve`) and tariffs (`tarif`). Code, comments, UI text and API error messages are in French — keep it that way.

Two independent npm projects, no monorepo tooling:
- `backend/` — Express 5 + `pg` (CommonJS), port 5000
- `frontend/` — React 18 + Vite 5 + react-router-dom 6 (ESM), port 5173

## Commands

```bash
# Tout lancer (racine) : backend + frontend en une commande, via concurrently
npm run install:all                            # installe racine + backend + frontend
npm run dev                                    # [backend] nodemon :5000 + [frontend] vite :5173 (strictPort : échoue si le port est pris)
npm run stop                                   # libère les ports 5000 et 5173 (anciens serveurs restés actifs)

# Backend seul (requires a local PostgreSQL)
cd backend && npm install && npm run dev      # nodemon server.js → http://localhost:5000
cp backend/.env.example backend/.env                  # identifiants PostgreSQL (obligatoire, git-ignored)
cd backend && npm run create-user -- <username> <motdepasse> [nom] [admin|agent]   # crée/met à jour un compte (rôle agent par défaut)
cd backend && npm run seed     # sauvegarde (backend/backups/, git-ignored) puis REMPLACE abonne/contrat/compteur/tarif/releve/facture(_ligne) par un jeu de démo déterministe (utilisateurs conservés)

# Frontend
cd frontend && npm install && npm run dev     # http://localhost:5173
cd frontend && npm run build                  # → frontend/dist
cd frontend && npm run preview
```

There is no test suite, linter or formatter configured.

The root `package.json` is tooling only (`concurrently` + the `dev`/`install:all`/`build` scripts). Never add application dependencies there — a root React/chart.js install once shadowed the frontend's React and broke the charts; `chart.js` / `react-chartjs-2` belong to `frontend/package.json`.

## Architecture

**Database**: connection settings come from `backend/.env` (`DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`), loaded by `config/env.js` with Node's `process.loadEnvFile` (no dotenv); `requis()` fails fast with a clear message when a variable is missing — never put credentials back in code. The database `formation_db` also holds other projects' tables (`etudiante`, `professeur`, `users`): never touch them. There are no migrations or schema files in the repo — the schema is only implied by the SQL in the controllers, except `config/init-db.js`, which `server.js` awaits before listening (creates `utilisateur` + its `role` column, the invoice tables, constraints, and runs one-off idempotent migrations; the server exits if this fails). Note: nodemon restarts on every backend file save, so a long startup migration can be interrupted and re-run — keep migrations transactional and idempotent. Uniqueness is enforced by the DB: controllers map PG error `23505` to a 400 instead of doing a SELECT-then-INSERT check. Key relations:
`abonne` ←`contrat.abonne_id` ; `contrat` ←`releve.contrat_id` ; `compteur` ←`releve.compteur_id` ; `tarif` ←`compteur.tarif_id`.

**Backend** follows a strict route/controller pattern per entity:
- `backend/server.js` mounts `route/<entity>.route.js` under `/api/<entity>` (singular: `/api/abonne`, `/api/releve`, …).
- Each controller in `controller/<entity>.controller.js` writes raw parameterized SQL via `db.query(...)` (no ORM) and returns JSON; errors are returned as `{ message, error? }` with status 500.
- Business logic lives in SQL/controllers: `releve.consommation` is computed server-side as `nouvel_index - ancien_index` on create/update;
- **Index chaining** (`releve.controller.js`): readings of a meter are ordered by `(date_releve, id)`. `ancien_index` is always taken from the previous reading's `nouvel_index` of the same `compteur_id` — the client value is only used for a meter's first reading. Create/update/delete run in a transaction (meter row locked `FOR UPDATE`) and re-chain only the immediately following reading; existing historical rows are not bulk-rewritten. `compteur_id` and `date_releve` are required, and `nouvel_index` must lie between the previous and next readings. `Releves.jsx` mirrors this ordering to show the inherited index read-only.
- **Automatic invoicing** (`service/facture.service.js`): like JIRAMA, one invoice per contract and month — `facture` (UNIQUE `contrat_id, periode` 'AAAA-MM', number `FCT<contrat 6 digits>-AAAAMM`, header totals) + `facture_ligne` (one per reading, `type` electricite/eau, frozen `prix_unitaire` and amounts). `genererFacture(client, releveId)` adds/recomputes the reading's line inside the reading's transaction (moving it if its month/contract changed) and `recalculerFacture` re-sums the header (deleting it when empty); `retirerReleve` must be called before deleting a reading. Backfilled at startup and via `POST /api/facture/generer`. Tariff changes never touch issued lines. Status `impayee`/`payee` (`PUT /api/facture/:id/statut`); any change touching a paid invoice (edit/delete a reading, re-chain, add a reading to a paid month) is refused with 409 (`FactureVerrouillee`). Printing data: `detailFacture(id)` via `GET /api/facture/:id/impression` or `GET /api/releve/facture/:releveId`. Tax rates live in this service. The old one-invoice-per-reading table was migrated by `migrerFacturesParReleve` (backup in `backend/backups/`).
- Dates come back from `pg` as UTC timestamps (e.g. `2026-09-24T21:00:00Z` for 25/09 in UTC+3): use `toInputDate` from `utils/format.js`, never `slice(0, 10)`, to fill `<input type="date">`.
- **Integrity rules** (`utils/integrite.js`): deleting an abonné/contrat/compteur that still has meters or readings is refused with 409 and a readable count (never cascade — it would erase paid invoices); a tariff used by meters can't be deleted. Statuses are fixed lists (`STATUTS_CONTRAT` Actif/Suspendu/Résilié, `STATUTS_COMPTEUR` Actif/Hors service, mirrored in the page selects): new readings are refused on a non-active contract or meter. A tariff only applies to readings inside its `date_debut`/`date_fin` (`TARIF_VALIDE_SQL` in `facture.service.js`, checked again when saving a reading). A contract with readings can't change abonné. `init-db.js` adds FK `fk_compteur_tarif` and dropped the unused `contrat.tarif_id`.
- **Sites** (`site` table, `controller/site.controller.js`, page `Sites.jsx`): a site is a quartier identified by a numeric reference `code` (demo data: province de Toliara — 61x Toliara ville, 62x Morondava, 63x Taolagnaro, 64x Ambovombe; e.g. 611 = Besakoa). `abonne.site_id` is required (FK). Abonné/contrat/relevé/facture list endpoints return `site_code`/`site_quartier`; the pages filter client-side with `components/FiltreSite.jsx` (`correspondSite`: prefix match on the code, so « 61 » = whole city, « 6 » = whole province). Site management is admin-only; a site with abonnés can't be deleted. **Excel import**: the browser parses the `.xlsx` (`utils/importSites.js`, `read-excel-file`/`write-excel-file` pinned versions, lazy-loaded via dynamic `import()` to keep them out of the main bundle), shows a preview, then `POST /api/site/import` re-validates everything and upserts by `code` in one transaction — all-or-nothing, errors returned per Excel line. Don't use the npm `xlsx` package (unmaintained there, known vulnerabilities).
- `compteur.tarif_id` and `contrat_id` are required on create/update; updating a meter runs `genererFacturesManquantes` so readings left unbilled while it had no tariff get invoiced.
- `GET /api/releve/abonne/:nom` shows the invoiced amount when it exists, otherwise `MONTANT_SQL` (current tariff). The printable invoice returns 422 when the meter has no tariff, and computes the previous reading date of the same meter for the "nombre de jours" line.
- **Auth**: `POST /api/auth/login` (public) checks `utilisateur.password_hash` with bcryptjs and returns a JWT (`config/auth.js`: secret from the `JWT_SECRET` env var, otherwise a random key generated once into the git-ignored `backend/.jwt-secret` — never hardcode one). Every other `/api/*` router is mounted behind `middleware/auth.middleware.js` in `server.js` — new entity routers must be mounted the same way. There is no public sign-up; accounts are created with `scripts/create-user.js`. Login is throttled in memory (5 failures / 15 min per IP + username → 429).
- **Roles**: `utilisateur.role` is `admin` or `agent`. Admin-only actions are guarded server-side by `middleware/role.middleware.js` (`exigerAdmin`, which re-reads the role from the DB): every DELETE route, tariff create/update/delete, and cancelling a payment (checked in `facture.controller.js`). The frontend only hides those buttons (`authService.estAdmin()`); `Layout.jsx` refreshes the user via `GET /api/auth/me`. New destructive routes must use `exigerAdmin`.
- In route files, specific paths (e.g. `/facture/:id`) must be declared before generic `/:id` handlers.

**Frontend**:
- Vite proxies `/api` → `http://localhost:5000` (`vite.config.js`), so no CORS is configured on the backend; the backend must be running for the UI to work.
- `src/services/api.js` is the single fetch wrapper (`api.get/post/put/del`) that parses JSON and throws `Error(data.message)` on non-2xx. It also owns the session (`session`, JWT + user in localStorage), sends `Authorization: Bearer` on every call, and on a 401 clears the session and redirects to `/login`. Each entity has a thin `src/services/<entity>.service.js` exposing `getAll/create/update/remove` plus extras.
- Pages in `src/pages/` are CRUD screens (list + `Modal` form + `Alert` feedback). Routing is in `src/App.jsx`: `/login` is public; everything else is wrapped in `components/RequireAuth.jsx`. All pages render inside `components/Layout.jsx` (which shows the user and the logout button), except the printable invoice `/releves/:id/facture` (`Facture.jsx`), which is deliberately outside the layout.
- Every list table is paginated client-side with `components/Pagination.jsx`: `const pagination = usePagination(liste, resetKey)` (resetKey = search/filter value, resets to page 1), map over `pagination.pageItems`, and render `<Pagination pagination={pagination} />` under the `</table>`. New tables must follow the same pattern.
- Shared formatting (dates, amounts, badges) is in `src/utils/format.js`; all styling is global CSS in `src/index.css` (no CSS framework).
- **Invoice printing**: the invoice layout (copy of the official JIRAMA invoice) lives in `components/FactureDocument.jsx` (CSS prefix `fj-`, own `--facture-*` color variables). It fills the ÉLECTRICITÉ and EAU columns from the invoice's `lignes`. "Imprimer" buttons use `hooks/useImpressionFacture.jsx` (`imprimer(releveId)` / `imprimerFacture(factureId)`): it fetches the invoice, portals it into `<body>` as `.print-zone`, adds `body.impression-facture` (print CSS hides everything else, `@page` A4 margin 0) and calls `window.print()` — no navigation. `/releves/:id/facture` still renders the same document for direct links.
- **Colors**: JIRAMA palette only — blue (`--primary*`) as main color, orange (`--accent*`) as a sparing accent, red/green reserved for statuses. Always use the `:root` variables in `index.css`; don't hardcode colors or add per-page accent colors. Icons are inline SVGs in `components/Icons.jsx` (no emojis, no icon library); chart colors in `Dashboard.jsx` mirror the palette.
