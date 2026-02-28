# CLAUDE.md — Molecule Manager Capstone Project

## Project Overview

A multi-tenant web application for research labs to manage molecules and experiments.
Labs are isolated workspaces. Users join labs and can only access data within their labs.

This is an MVP. Do not add features outside the spec. Keep code clean and minimal.

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python), SQLAlchemy ORM, Alembic migrations
- **Database:** PostgreSQL
- **Chemistry:** RDKit (server-side only, never client-side)
- **Auth:** Session-based, HTTP-only cookies, bcrypt password hashing
- **Containerization:** Docker + Docker Compose

## Monorepo Structure

molecule-manager/
├─ apps/
│  ├─ web/                      # Next.js frontend
│  │  ├─ src/
│  │  │  ├─ app/                # App Router pages and layouts
│  │  │  ├─ components/         # Reusable UI components
│  │  │  ├─ lib/                # API client, auth helpers, formatters
│  │  │  ├─ types/              # TypeScript domain types
│  │  │  └─ styles/
│  │  └─ package.json
│  │
│  └─ api/                      # FastAPI backend
│     ├─ app/
│     │  ├─ main.py             # App entry, middleware, router registration
│     │  ├─ core/               # Settings (pydantic-settings), security helpers
│     │  ├─ db/                 # session.py, base.py, init_db.py
│     │  ├─ models/             # SQLAlchemy models (one file per domain)
│     │  ├─ schemas/            # Pydantic request/response schemas
│     │  ├─ services/           # Business logic (chemistry.py, lab.py, etc.)
│     │  ├─ routers/            # Route handlers grouped by domain
│     │  ├─ deps/               # FastAPI dependencies (auth, db session)
│     │  └─ utils/              # Shared helpers
│     ├─ tests/
│     ├─ alembic/
│     ├─ alembic.ini
│     └─ pyproject.toml
│
├─ infra/
│  ├─ docker/
│  │  ├─ web.Dockerfile
│  │  └─ api.Dockerfile
│  └─ docker-compose.yml
│
├─ .env.example
├─ CLAUDE.md
└─ README.md

## Database Schema

### Tables

**users**
- id (UUID, PK)
- email (string, unique, not null)
- hashed_password (string, not null)
- created_at (timestamp, not null)

**labs**
- id (UUID, PK)
- name (string, not null)
- lab_code (string, unique, not null)
- hashed_password (string, not null)
- created_by_user_id (FK → users.id, SET NULL on delete)
- created_at (timestamp, not null)

**lab_members**
- id (UUID, PK)
- lab_id (FK → labs.id, CASCADE delete)
- user_id (FK → users.id, CASCADE delete)
- joined_at (timestamp, not null)
- UNIQUE constraint on (lab_id, user_id)

**molecules**
- id (UUID, PK)
- lab_id (FK → labs.id, CASCADE delete)
- created_by_user_id (FK → users.id, SET NULL on delete)
- name (string, not null)
- smiles (string, not null)
- canonical_smiles (string)
- date_created (date, not null)
- method_used (string, not null)
- notes (text, nullable)
- molecular_weight (float, nullable)
- molecular_formula (string, nullable)
- hbd (int, nullable)
- hba (int, nullable)
- tpsa (float, nullable)
- rotatable_bonds (int, nullable)
- svg_image (text, nullable)
- created_at (timestamp, not null)
- updated_at (timestamp, not null)
- INDEX on (lab_id, name)
- INDEX on (lab_id, smiles)

**experiments**
- id (UUID, PK)
- lab_id (FK → labs.id, CASCADE delete)
- created_by_user_id (FK → users.id, SET NULL on delete)
- title (string, not null)
- date (date, not null)
- notes (text, nullable)
- created_at (timestamp, not null)

**experiment_molecules** (join table)
- experiment_id (FK → experiments.id, CASCADE delete)
- molecule_id (FK → molecules.id, CASCADE delete)
- PRIMARY KEY on (experiment_id, molecule_id)

## API Conventions

- All routes are prefixed: `/api/v1/`
- Auth routes: `/api/v1/auth/` (signup, login, logout)
- Lab routes: `/api/v1/labs/`
- Molecule routes: `/api/v1/molecules/`
- Experiment routes: `/api/v1/experiments/`
- Chemistry utility: `/api/v1/chemistry/validate`
- All responses use consistent JSON structure
- Errors return `{ "detail": "message" }` (FastAPI default)
- All data routes require authentication
- All molecule/experiment routes filter by lab_id — never return cross-lab data

## Auth System

- Passwords hashed with bcrypt
- Lab passwords also hashed with bcrypt
- Sessions use HTTP-only, Secure, SameSite=Lax cookies
- Session token stored server-side (or signed with itsdangerous)
- Auth enforced via `deps/auth.py` dependency injected into routes
- Lab membership enforced via a separate `get_lab_member` dependency

## Chemistry Rules

- All SMILES processing happens in `services/chemistry.py` using RDKit
- Never trust raw SMILES from user — always validate and canonicalize
- If SMILES is invalid, return a structured 422 error before saving anything
- SVG is generated server-side and stored as text in the molecules table
- Properties computed: molecular weight, formula, HBD, HBA, TPSA, rotatable bonds

## Frontend Conventions

- Use Next.js App Router (not Pages Router)
- All API calls go through a centralized client in `lib/api.ts`
- Auth state managed via a context or lightweight store
- No direct RDKit calls on the frontend — always call the backend
- SMILES input triggers a backend validation call on blur or submit
- SVG returned from backend is rendered inline in the UI
- Use Tailwind CSS for all styling — no additional UI libraries unless necessary

## Docker & Environment

- `docker-compose.yml` defines three services: `db`, `api`, `web`
- Local dev uses `.env` file (never committed)
- `.env.example` documents all required variables with placeholder values
- Required env vars:
  - `DATABASE_URL`
  - `SECRET_KEY`
  - `ALLOWED_ORIGINS`
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

## What Is Explicitly Out of Scope (Do Not Implement)

- AI reaction prediction
- Role hierarchy (PI vs student)
- Notifications
- Real-time collaboration
- Audit history
- Substructure or similarity search
- InChI support
- PubChem integration
- File upload for ChemDraw
- Any feature not described in this file

## MVP Completion Criteria

- User can sign up and log in
- User can create or join a lab
- User can create a molecule with validated SMILES
- System auto-generates structure image and properties from SMILES
- User can search molecules within their lab
- User can create experiments and attach molecules to them
- No cross-lab data leakage is possible under any circumstance