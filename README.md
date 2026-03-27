# HioSOP — SOP-Navigator

A full-stack web application for managing Standard Operating Procedures (SOPs) in a fire department dispatch center (Feuerwehrleitstelle).

## Features

- **SOP Library** — browse, search, and filter SOPs by category
- **Versioned SOPs** — semantic versioning (Major.Minor); editing an active SOP auto-creates a new draft
- **Approval workflow** — Draft → In Review → Active → Archived, with mandatory rejection comments
- **draw.io diagrams** — upload `.drawio` files; rendered inline via iframe viewer; internal SOP links are intercepted for in-app navigation
- **Interactive checklists** — recursive checklist items with progress bar (session-local)
- **RBAC** — three roles: Dispatcher (read), Admin (create/edit/submit), Owner (approve/reject/archive/users)
- **Favorites** — pin SOPs to sidebar for quick access
- **Feedback** — users can submit per-SOP feedback
- **Audit log** — immutable log of every action (user, timestamp, IP, action, SOP/version)
- **LDAP stub** — optional LDAP authentication (disabled when `LDAP_SERVER` is not set)
- **PWA** — offline-capable; last 20 viewed SOPs cached via Workbox
- **Responsive** — sidebar + main on tablet/desktop, stacked on mobile

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI 0.111, Python 3.12, SQLAlchemy 2.0 async, asyncpg |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT (HS256, 12h), bcrypt, python-ldap |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand (with localStorage persistence) |
| Data fetching | TanStack React Query 5 |
| PWA | vite-plugin-pwa, Workbox |
| Infrastructure | Docker Compose, Nginx |

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Setup

```bash
git clone https://github.com/LeMaBa/HioSOP.git
cd HioSOP
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
SECRET_KEY=your-secret-key-here   # generate with: openssl rand -hex 32
```

### Run

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Default credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `changeme` | Owner |

**Change the default password immediately after first login.**

## Project Structure

```
HioSOP/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers (auth, sops, users)
│   │   ├── core/            # Config, DB, security, auth dependencies
│   │   ├── models/          # SQLAlchemy ORM models
│   │   └── schemas/         # Pydantic request/response schemas
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # axios client + typed API functions
│   │   ├── components/      # Layout, SearchBar, DiagramViewer, Checklist, …
│   │   ├── pages/           # Login, Library, SOPDetail, Admin, Users
│   │   └── store/           # Zustand auth store
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
├── docker-compose.yml
└── .env.example
```

## Roles

| Role | Permissions |
|---|---|
| **Dispatcher** | View active SOPs, favorites, feedback |
| **Admin** | + Create SOPs, edit drafts, upload diagrams, submit for review |
| **Owner** | + Approve/reject reviews, archive SOPs, manage users |

## SOP Lifecycle

```
DRAFT → IN_REVIEW → ACTIVE → ARCHIVED
           ↓
        DRAFT  (rejected — rejection comment required)
```

Editing an `ACTIVE` SOP creates a new `DRAFT` with an incremented minor version (e.g. `1.0` → `1.1`).

## LDAP (optional)

Set `LDAP_SERVER` in `.env` to enable LDAP authentication. On first login, an LDAP user gets a local shadow account created automatically. If `LDAP_SERVER` is unset, only local users are active.

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.

## License

Private — all rights reserved.
