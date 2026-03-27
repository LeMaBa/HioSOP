# SOP-Navigator — Produktspezifikation v0.1

## 1. Zweck & Scope

Der **SOP-Navigator** ist eine interne Web-Applikation für die Feuerwehrleitstelle. Sie ermöglicht Disponenten und Admins, Standard-Einsatzpläne (SOPs) zu erstellen, zu verwalten, freizugeben und im Einsatz schnell abzurufen.

**MVP (Phase 1)** umfasst:
- SOP-Bibliothek mit Kategorisierung, Suche und Filterung
- Versioniertes Freigabeworkflow (Draft → In Review → Active → Archived)
- Flowchart-Anzeige (draw.io XML) und interaktive Checklisten
- Rollenbasierte Zugriffssteuerung (RBAC)
- Favoriten, Feedback, unveränderliches Audit-Log
- PWA mit Offline-Unterstützung (letzte 20 SOPs gecacht)

---

## 2. Nutzerrollen

| Rolle | Beschreibung |
|---|---|
| **DISPATCHER** | Lesezugriff auf aktive SOPs, Favoriten, Feedback abgeben |
| **ADMIN** | + SOPs erstellen, Entwürfe bearbeiten, Diagramme hochladen, zur Freigabe einreichen |
| **OWNER** | + Freigabe / Ablehnung, Archivierung, Benutzerverwaltung |

---

## 3. Datenmodell

### 3.1 Benutzer (`users`)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | |
| `username` | VARCHAR UNIQUE | |
| `email` | VARCHAR UNIQUE | |
| `full_name` | VARCHAR | |
| `hashed_password` | VARCHAR | `NULL` bei LDAP-Nutzern |
| `role` | ENUM | DISPATCHER / ADMIN / OWNER |
| `is_active` | BOOLEAN | Default: true |
| `is_ldap` | BOOLEAN | Lokaler Schattenaccount für LDAP-User |
| `last_login` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

### 3.2 SOP (`sops`)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | |
| `code` | VARCHAR UNIQUE | Kürzel, z. B. `BMA-001` |
| `title` | VARCHAR | |
| `category` | ENUM | Siehe §3.4 |
| `tags` | JSON | Array of strings |
| `linked_sop_codes` | JSON | Array of strings (Verweise auf andere SOPs) |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |
| `current_version_id` | UUID FK → sop_versions | Zeigt auf aktive Version |

### 3.3 SOP-Version (`sop_versions`)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | |
| `sop_id` | UUID FK → sops | |
| `version` | VARCHAR | Semantisch: `1.0`, `1.1`, `2.0` |
| `status` | ENUM | DRAFT / IN_REVIEW / ACTIVE / ARCHIVED |
| `diagram_xml` | TEXT | draw.io XML |
| `checklist_items` | JSON | Rekursive Struktur (s. §3.5) |
| `submitted_at` | TIMESTAMP | |
| `submitted_by` | UUID FK → users | |
| `reviewed_at` | TIMESTAMP | |
| `reviewed_by` | UUID FK → users | |
| `review_comment` | TEXT | Pflichtfeld bei Ablehnung |
| `released_at` | TIMESTAMP | |
| `released_by` | UUID FK → users | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |

### 3.4 Kategorien

```
BRAND, TECHNISCHE_HILFELEISTUNG, GEFAHRGUT, WASSER_EISRETTUNG,
HOCHWASSER, MASSENANFALL, ABC_EINSATZ, SONSTIGES
```

### 3.5 Checklist-Item (rekursiv)

```json
{
  "id": "string",
  "text": "string",
  "required": true,
  "sub_items": [ /* rekursiv */ ]
}
```

### 3.6 Audit-Log (`audit_logs`)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `action` | VARCHAR | z. B. `SOP_SUBMITTED`, `SOP_APPROVED` |
| `sop_id` | UUID FK → sops | Optional |
| `version_id` | UUID FK → sop_versions | Optional |
| `ip_address` | VARCHAR | Aus `X-Forwarded-For` |
| `details` | JSON | Weitere Details |
| `created_at` | TIMESTAMP | |

### 3.7 Weitere Tabellen

- **`sop_favorites`** — user_id + sop_id (unique)
- **`sop_feedback`** — user_id + sop_id + version_id + comment + rating (1–5)

---

## 4. SOP-Lebenszyklus

```
DRAFT ──[submit]──→ IN_REVIEW ──[approve]──→ ACTIVE ──[archive]──→ ARCHIVED
                        │
                    [reject]
                        │
                        ↓
                      DRAFT  (neuer Entwurf, Ablehnungskommentar gespeichert)
```

**Versionierungsregeln:**
- Neue SOP: Version `1.0`
- Aktive SOP bearbeiten: automatisch neuer DRAFT mit `1.0 → 1.1`, `1.1 → 1.2` usw.
- Major-Erhöhung (`2.0`) nur manuell möglich (geplant für Phase 2)

**Sichtbarkeitsregeln:**
- DISPATCHER: sieht nur ACTIVE
- ADMIN: sieht DRAFT, IN_REVIEW, ACTIVE (eigene und alle)
- OWNER: sieht alle Status inkl. ARCHIVED

---

## 5. API-Endpunkte

### Authentication (`/api/v1/auth`)

| Method | Path | Beschreibung |
|---|---|---|
| POST | `/login` | Login (lokal + LDAP-Fallback), gibt JWT zurück |
| GET | `/me` | Eigenes Profil |
| POST | `/logout` | Token ungültig machen |

### SOPs (`/api/v1/sops`)

| Method | Path | Beschreibung | Rolle |
|---|---|---|---|
| GET | `/` | SOP-Liste (Filter: category, search, favorites) | alle |
| POST | `/` | SOP erstellen | ADMIN+ |
| GET | `/{id}` | SOP-Detail | alle |
| GET | `/code/{code}` | SOP per Kürzel | alle |
| PATCH | `/{id}` | SOP bearbeiten (erstellt neuen DRAFT bei ACTIVE) | ADMIN+ |
| POST | `/{id}/submit` | Zur Freigabe einreichen | ADMIN+ |
| POST | `/{id}/review` | Freigeben / Ablehnen | OWNER |
| POST | `/{id}/archive` | Archivieren | OWNER |
| GET | `/{id}/versions` | Alle Versionen | ADMIN+ |
| POST | `/{id}/diagram` | Diagramm hochladen (.drawio) | ADMIN+ |
| POST | `/{id}/favorite` | Favorit setzen / entfernen | alle |
| POST | `/{id}/feedback` | Feedback abgeben | alle |
| GET | `/{id}/feedback` | Feedback lesen | ADMIN+ |
| GET | `/{id}/audit` | Audit-Log | OWNER |

### Users (`/api/v1/users`)

| Method | Path | Beschreibung | Rolle |
|---|---|---|---|
| GET | `/` | Benutzerliste | ADMIN+ |
| POST | `/` | Benutzer erstellen | OWNER |
| GET | `/{id}` | Benutzerprofil | ADMIN+ |
| PATCH | `/{id}` | Rolle / Status ändern | OWNER |

---

## 6. Authentifizierung & Sicherheit

- **JWT** (HS256), 12 Stunden Gültigkeit, gespeichert in `localStorage`
- **bcrypt** für lokale Passwörter (Faktor 12)
- **LDAP** — aktiviert wenn `LDAP_SERVER` gesetzt; LDAP-User erhalten lokalen Schattenaccount
- Auto-Seed: beim ersten Start wird `admin / changeme` (Rolle OWNER) angelegt
- CORS konfiguriert für Frontend-Origin

---

## 7. Frontend-Architektur

### Seiten

| Route | Seite | Zugriff |
|---|---|---|
| `/login` | LoginPage | öffentlich |
| `/` | LibraryPage | alle |
| `/sop/:id` | SOPDetailPage | alle |
| `/admin` | AdminPage | ADMIN+ |
| `/users` | UsersPage | OWNER |

### Schlüssel-Komponenten

- **Layout** — Top-Bar (SearchBar, Offline-Banner), Sidebar (Favoriten, Admin-Links), Mobile-Hamburger
- **SearchBar** — Ctrl+K/Cmd+K, Live-Suche ab 2 Zeichen, Click-Outside schließt
- **DiagramViewer** — Blob-URL iframe mit draw.io Viewer; `/sop/`-Links werden abgefangen und in-App navigiert
- **ChecklistView** — Rekursiv, Fortschrittsbalken, Session-lokaler State
- **CategoryBadge / StatusBadge** — Farbige Inline-Badges

### State Management

- **Zustand** + localStorage-Persistenz für Auth-State
- **TanStack React Query** für Server-State (Caching, Refetching)

---

## 8. PWA & Offline

- `vite-plugin-pwa` mit Workbox
- **StaleWhileRevalidate** für `/api/v1/sops/.*`
- Max. 20 gecachte SOPs, TTL 24 Stunden
- Offline-Banner in der Top-Bar bei fehlender Verbindung
- `sw.js` mit `no-cache` Header (immer aktuell)

---

## 9. Infrastructure

```yaml
services:
  db:       postgres:16-alpine    # Port 5432, named volume
  redis:    redis:7-alpine        # Port 6379, named volume
  backend:  python:3.12-slim      # Port 8000, uvicorn
  frontend: nginx:1.27-alpine     # Port 3000, SPA-Routing
```

- Backend-Dockerfile installiert `libldap2-dev`, `libsasl2-dev`, `gcc` für python-ldap
- Frontend-Dockerfile: Multi-Stage Build (node:20-alpine → nginx:1.27-alpine)
- Nginx: gzip, 1-Jahr-Cache für Assets, Security-Header, `try_files $uri /index.html`

---

## 10. Umgebungsvariablen

| Variable | Beschreibung | Standard |
|---|---|---|
| `SECRET_KEY` | JWT-Signaturschlüssel | — (Pflicht) |
| `DATABASE_URL` | PostgreSQL async URL | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis URL | `redis://redis:6379` |
| `LDAP_SERVER` | LDAP-Server-URL (leer = deaktiviert) | — |
| `LDAP_BASE_DN` | LDAP Base DN | — |
| `LDAP_BIND_DN` | LDAP Bind DN | — |
| `LDAP_BIND_PASSWORD` | LDAP Bind-Passwort | — |
| `VITE_API_BASE_URL` | API-URL für Frontend-Build | `http://localhost:8000` |

---

## 11. Geplante Phase 2 (nicht im MVP)

- Major-Versionierung manuell auslösbar
- E-Mail-Benachrichtigungen bei Statuswechsel
- Volltextsuche in Diagramm-XML und Checklisten
- Exportfunktion (PDF)
- Zwei-Faktor-Authentifizierung
- Mehrsprachigkeit (i18n)
- Erweiterte Audit-Log-Auswertung / Dashboard
