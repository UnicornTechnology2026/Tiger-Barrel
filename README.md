# Field Agent Tracker

Production-oriented web app for tracking field agents visiting liquor outlets.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Supabase (Auth, PostgreSQL, Storage, RLS) · Leaflet · TanStack Query · React Hook Form · Zod

---

## Quick start

### 1. Install

```bash
cd field-agent-tracker
npm install
```

### 2. Supabase setup

1. Create a project at https://supabase.com
2. In **SQL Editor**, run in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_policies.sql` (after creating the bucket)
   - `supabase/migrations/003_profile_guards.sql`
3. **Storage** → New bucket:
   - Name: `outlet-photos`
   - Public: **OFF** (private)
   - File size limit: 5 MB
   - Allowed MIME: `image/jpeg`, `image/png`, `image/webp`
4. **Auth** → URL configuration: add `http://localhost:5173` and your production URL to Redirect URLs

### 3. Environment

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Create users

**Supabase Dashboard → Authentication → Users → Add user**

| Role  | User Metadata (JSON) |
|-------|----------------------|
| Admin | `{"role":"admin","full_name":"Admin User"}` |
| Agent | `{"role":"agent","full_name":"Rahul Sharma"}` |

Set a password for each. The `handle_new_user` trigger creates a `profiles` row automatically.

Then in the app (as Admin) → **Agents → Manage Agent** to set employee ID, territory, etc.

### 5. Run

```bash
npm run dev
```

Open http://localhost:5173

---

## Features

### Agent (mobile-first)
- Login / forgot password / reset
- Dashboard with today’s progress
- Assigned outlets · GPS geofence verification
- Visit: check-in → photos → comment → complete
- History, photos (signed URLs), messages, profile

### Admin
- Dashboard stats · Agents & outlets CRUD-style management
- Assign outlets · Live map tracking
- Visits, photo gallery, comments, messaging
- Reports + CSV export · Audit logs · Settings

### Security
- Supabase Auth + session refresh
- RLS on all tables (agents isolated)
- Profile column guards (agents cannot change role/status)
- Private storage + signed URLs
- No service-role key in the frontend

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript only |

---

## Project structure

```
src/
  components/   layout, shared, ui
  contexts/     AuthContext
  lib/          supabase, geolocation, utils, leaflet-fix
  pages/        auth, agent, admin
  types/
supabase/migrations/
```

---

## Production deploy

```bash
npm run build
```

Deploy `dist/` to Vercel / Netlify / Cloudflare Pages. Set the same `VITE_*` env vars. Confirm Auth redirect URLs and RLS.

